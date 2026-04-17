/**
 * Monitoring alerts router (P1 Gap #9 — Continuous monitoring).
 *
 * Surfaces alerts produced by:
 *   • POST /api/webhooks/exclusions  (SAM.gov / OIG / state Medicaid pushes)
 *   • runContinuousLicenseMonitoring  (nightly diff alerts)
 *   • runSanctions30DayMonitoring     (30-day sweep results)
 *   • NPDB Continuous Query (when enabled)
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import {
  MonitoringAlertSeverity,
  MonitoringAlertStatus,
  MonitoringAlertType,
} from "@prisma/client";

export const monitoringRouter = createTRPCRouter({
  // ─── Counts for dashboard tile ────────────────────────────────────────
  counts: staffProcedure.query(async ({ ctx }) => {
    const [openCritical, openWarning, openInfo, ackedTotal, last24h] =
      await Promise.all([
        ctx.db.monitoringAlert.count({
          where: { status: "OPEN", severity: "CRITICAL" },
        }),
        ctx.db.monitoringAlert.count({
          where: { status: "OPEN", severity: "WARNING" },
        }),
        ctx.db.monitoringAlert.count({
          where: { status: "OPEN", severity: "INFO" },
        }),
        ctx.db.monitoringAlert.count({
          where: { status: "ACKNOWLEDGED" },
        }),
        ctx.db.monitoringAlert.count({
          where: {
            detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

    return { openCritical, openWarning, openInfo, ackedTotal, last24h };
  }),

  // ─── Paginated list with filters ──────────────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        status: z.nativeEnum(MonitoringAlertStatus).optional(),
        severity: z.nativeEnum(MonitoringAlertSeverity).optional(),
        type: z.nativeEnum(MonitoringAlertType).optional(),
        providerId: z.string().uuid().optional(),
        take: z.number().int().min(1).max(200).default(50),
        skip: z.number().int().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.severity) where.severity = input.severity;
      if (input.type) where.type = input.type;
      if (input.providerId) where.providerId = input.providerId;

      const [items, total] = await Promise.all([
        ctx.db.monitoringAlert.findMany({
          where: where as never,
          orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
          take: input.take,
          skip: input.skip,
          include: {
            provider: {
              select: {
                id: true,
                legalFirstName: true,
                legalLastName: true,
                npi: true,
              },
            },
            acknowledgedBy: { select: { id: true, displayName: true } },
            resolvedBy: { select: { id: true, displayName: true } },
          },
        }),
        ctx.db.monitoringAlert.count({ where: where as never }),
      ]);

      return { items, total };
    }),

  // ─── Get one ──────────────────────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const alert = await ctx.db.monitoringAlert.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            select: {
              id: true,
              legalFirstName: true,
              legalLastName: true,
              npi: true,
            },
          },
          acknowledgedBy: { select: { id: true, displayName: true } },
          resolvedBy: { select: { id: true, displayName: true } },
        },
      });
      if (!alert) throw new TRPCError({ code: "NOT_FOUND" });
      return alert;
    }),

  // ─── Acknowledge ──────────────────────────────────────────────────────
  acknowledge: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.db.monitoringAlert.findUnique({
        where: { id: input.id },
      });
      if (!alert) throw new TRPCError({ code: "NOT_FOUND" });
      if (alert.status !== "OPEN") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot acknowledge alert in status ${alert.status}.`,
        });
      }

      const updated = await ctx.db.monitoringAlert.update({
        where: { id: input.id },
        data: {
          status: "ACKNOWLEDGED",
          acknowledgedAt: new Date(),
          acknowledgedById: ctx.session!.user.id,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "monitoringAlert.acknowledged",
        entityType: "MonitoringAlert",
        entityId: input.id,
        providerId: alert.providerId,
      });

      return updated;
    }),

  // ─── Resolve ──────────────────────────────────────────────────────────
  resolve: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        resolutionNotes: z.string().min(1).max(2000),
        dismiss: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const alert = await ctx.db.monitoringAlert.findUnique({
        where: { id: input.id },
      });
      if (!alert) throw new TRPCError({ code: "NOT_FOUND" });
      if (alert.status === "RESOLVED" || alert.status === "DISMISSED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Alert already in terminal state ${alert.status}.`,
        });
      }

      const updated = await ctx.db.monitoringAlert.update({
        where: { id: input.id },
        data: {
          status: input.dismiss ? "DISMISSED" : "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: ctx.session!.user.id,
          resolutionNotes: input.resolutionNotes,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: input.dismiss
          ? "monitoringAlert.dismissed"
          : "monitoringAlert.resolved",
        entityType: "MonitoringAlert",
        entityId: input.id,
        providerId: alert.providerId,
        afterState: { resolutionNotes: input.resolutionNotes },
      });

      return updated;
    }),
});
