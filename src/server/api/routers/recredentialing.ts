/**
 * Recredentialing router — cycle management, dashboard, bulk initiation.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { RecredentialingStatus } from "@prisma/client";

export const recredentialingRouter = createTRPCRouter({
  // ─── List cycles ──────────────────────────────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        status: z.string().optional(),
        dueDateBefore: z.string().optional(),
        dueDateAfter: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.providerId) where.providerId = input.providerId;
      if (input.status) where.status = input.status as RecredentialingStatus;
      if (input.dueDateBefore || input.dueDateAfter) {
        const dueDate: Record<string, Date> = {};
        if (input.dueDateBefore) dueDate.lte = new Date(input.dueDateBefore);
        if (input.dueDateAfter) dueDate.gte = new Date(input.dueDateAfter);
        where.dueDate = dueDate;
      }

      const [total, cycles] = await Promise.all([
        ctx.db.recredentialingCycle.count({ where }),
        ctx.db.recredentialingCycle.findMany({
          where,
          include: {
            provider: {
              select: { id: true, legalFirstName: true, legalLastName: true, providerType: true },
            },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { dueDate: "asc" },
        }),
      ]);

      return { cycles, total };
    }),

  // ─── Get cycle by ID ──────────────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const cycle = await ctx.db.recredentialingCycle.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            include: {
              providerType: true,
            },
          },
          committeeSession: true,
        },
      });

      if (!cycle) throw new TRPCError({ code: "NOT_FOUND", message: "Recredentialing cycle not found" });
      return cycle;
    }),

  // ─── Get cycles by provider ───────────────────────────────────────────
  getByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.recredentialingCycle.findMany({
        where: { providerId: input.providerId },
        include: { committeeSession: true },
        orderBy: { cycleNumber: "desc" },
      });
    }),

  // ─── Create cycle ─────────────────────────────────────────────────────
  create: managerProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        dueDate: z.string(),
        cycleLengthMonths: z.number().min(1).default(36),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

      const maxCycle = await ctx.db.recredentialingCycle.aggregate({
        where: { providerId: input.providerId },
        _max: { cycleNumber: true },
      });
      const cycleNumber = (maxCycle._max.cycleNumber ?? 0) + 1;

      const cycle = await ctx.db.recredentialingCycle.create({
        data: {
          providerId: input.providerId,
          dueDate: new Date(input.dueDate),
          cycleLengthMonths: input.cycleLengthMonths,
          cycleNumber,
          notes: input.notes,
          status: "PENDING",
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "recredentialing.created",
        entityType: "RecredentialingCycle",
        entityId: cycle.id,
        providerId: input.providerId,
        afterState: { cycleNumber, dueDate: input.dueDate, cycleLengthMonths: input.cycleLengthMonths },
      });

      return cycle;
    }),

  // ─── Update cycle status ──────────────────────────────────────────────
  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum([
          "PENDING",
          "APPLICATION_SENT",
          "IN_PROGRESS",
          "PSV_RUNNING",
          "COMMITTEE_READY",
          "COMPLETED",
          "OVERDUE",
        ]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.recredentialingCycle.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Recredentialing cycle not found" });

      const data: Record<string, unknown> = {
        status: input.status,
      };

      if (input.notes !== undefined) data.notes = input.notes;
      if (input.status === "IN_PROGRESS" && !before.startedAt) data.startedAt = new Date();
      if (input.status === "COMPLETED") data.completedAt = new Date();

      const updated = await ctx.db.recredentialingCycle.update({
        where: { id: input.id },
        data,
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "recredentialing.status.changed",
        entityType: "RecredentialingCycle",
        entityId: input.id,
        providerId: before.providerId,
        beforeState: { status: before.status },
        afterState: { status: input.status },
      });

      return updated;
    }),

  // ─── Dashboard summary ────────────────────────────────────────────────
  getDashboard: staffProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const in30 = new Date(); in30.setDate(now.getDate() + 30);
      const in60 = new Date(); in60.setDate(now.getDate() + 60);
      const in90 = new Date(); in90.setDate(now.getDate() + 90);

      const [overdue, dueSoon30, dueSoon60, dueSoon90, inProgress, completed] = await Promise.all([
        ctx.db.recredentialingCycle.count({
          where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
        }),
        ctx.db.recredentialingCycle.count({
          where: { dueDate: { gte: now, lte: in30 }, status: "PENDING" },
        }),
        ctx.db.recredentialingCycle.count({
          where: { dueDate: { gte: in30, lte: in60 }, status: "PENDING" },
        }),
        ctx.db.recredentialingCycle.count({
          where: { dueDate: { gte: in60, lte: in90 }, status: "PENDING" },
        }),
        ctx.db.recredentialingCycle.count({
          where: { status: "IN_PROGRESS" },
        }),
        ctx.db.recredentialingCycle.count({
          where: { status: "COMPLETED" },
        }),
      ]);

      return { overdue, dueSoon30, dueSoon60, dueSoon90, inProgress, completed };
    }),

  // ─── Bulk initiate cycles ─────────────────────────────────────────────
  initiateBulk: managerProcedure
    .mutation(async ({ ctx }) => {
      const now = new Date();
      const thresholdDate = new Date();
      thresholdDate.setMonth(thresholdDate.getMonth() - 33);

      const eligibleProviders = await ctx.db.provider.findMany({
        where: {
          status: "APPROVED",
          initialApprovalDate: { lte: thresholdDate },
        },
        select: { id: true, initialApprovalDate: true },
      });

      let createdCount = 0;

      for (const provider of eligibleProviders) {
        const existingActive = await ctx.db.recredentialingCycle.findFirst({
          where: {
            providerId: provider.id,
            status: { in: ["PENDING", "IN_PROGRESS", "APPLICATION_SENT", "PSV_RUNNING", "COMMITTEE_READY"] },
          },
        });

        if (existingActive) continue;

        const dueDate = new Date(provider.initialApprovalDate!);
        dueDate.setMonth(dueDate.getMonth() + 36);

        // If the computed due date is already past, set it relative to now
        const effectiveDueDate = dueDate > now ? dueDate : (() => {
          const d = new Date(now);
          d.setMonth(d.getMonth() + 3);
          return d;
        })();

        const maxCycle = await ctx.db.recredentialingCycle.aggregate({
          where: { providerId: provider.id },
          _max: { cycleNumber: true },
        });

        const cycle = await ctx.db.recredentialingCycle.create({
          data: {
            providerId: provider.id,
            dueDate: effectiveDueDate,
            cycleLengthMonths: 36,
            cycleNumber: (maxCycle._max.cycleNumber ?? 0) + 1,
            status: "PENDING",
          },
        });

        await writeAuditLog({
          actorId: ctx.session!.user.id,
          actorRole: ctx.session!.user.role,
          action: "recredentialing.created",
          entityType: "RecredentialingCycle",
          entityId: cycle.id,
          providerId: provider.id,
          afterState: { cycleNumber: cycle.cycleNumber, dueDate: effectiveDueDate.toISOString(), bulk: true },
        });

        createdCount++;
      }

      return { created: createdCount };
    }),

  // ─── Delete cycle ─────────────────────────────────────────────────────
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const cycle = await ctx.db.recredentialingCycle.findUnique({
        where: { id: input.id },
        select: { id: true, providerId: true, status: true, cycleNumber: true },
      });

      if (!cycle) throw new TRPCError({ code: "NOT_FOUND", message: "Recredentialing cycle not found" });

      if (cycle.status !== "PENDING") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only PENDING cycles can be deleted",
        });
      }

      await ctx.db.recredentialingCycle.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "recredentialing.deleted",
        entityType: "RecredentialingCycle",
        entityId: input.id,
        providerId: cycle.providerId,
        beforeState: { status: cycle.status, cycleNumber: cycle.cycleNumber },
      });

      return { success: true };
    }),
});
