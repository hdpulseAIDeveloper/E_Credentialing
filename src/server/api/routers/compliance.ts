/**
 * P3 Gap #23 — HITRUST r2 / SOC 2 Type II readiness tRPC router.
 *
 * Surfaces the control inventory, evidence binders, gap log, and audit
 * periods so a third-party assessor can walk through every claimed control
 * with one click of provenance.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  staffProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import {
  ComplianceFramework,
  ComplianceControlStatus,
  ComplianceControlMaturity,
  ComplianceGapSeverity,
  ComplianceGapStatus,
  ComplianceAuditPeriodStatus,
  ComplianceEvidenceType,
  type Prisma,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import { getReadinessSummary } from "@/lib/compliance-readiness";

export const complianceRouter = createTRPCRouter({
  // ─── Dashboard ─────────────────────────────────────────────────────
  readiness: staffProcedure
    .input(z.object({ framework: z.nativeEnum(ComplianceFramework) }))
    .query(({ ctx, input }) => getReadinessSummary(ctx.db, input.framework)),

  // ─── Controls ──────────────────────────────────────────────────────
  listControls: staffProcedure
    .input(
      z.object({
        framework: z.nativeEnum(ComplianceFramework),
        status: z.nativeEnum(ComplianceControlStatus).optional(),
      })
    )
    .query(({ ctx, input }) => {
      const where: Prisma.ComplianceControlWhereInput = {
        framework: input.framework,
        ...(input.status ? { status: input.status } : {}),
      };
      return ctx.db.complianceControl.findMany({
        where,
        include: {
          owner: { select: { id: true, displayName: true, email: true } },
          _count: { select: { evidence: true, gaps: true } },
        },
        orderBy: { controlRef: "asc" },
      });
    }),

  getControl: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const control = await ctx.db.complianceControl.findUnique({
        where: { id: input.id },
        include: {
          owner: { select: { id: true, displayName: true, email: true } },
          evidence: {
            include: {
              addedBy: { select: { id: true, displayName: true } },
            },
            orderBy: { addedAt: "desc" },
          },
          gaps: {
            include: {
              owner: { select: { id: true, displayName: true } },
            },
            orderBy: [{ status: "asc" }, { severity: "desc" }],
          },
        },
      });
      if (!control) throw new TRPCError({ code: "NOT_FOUND" });
      return control;
    }),

  updateControl: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        ownerUserId: z.string().uuid().nullable().optional(),
        status: z.nativeEnum(ComplianceControlStatus).optional(),
        maturity: z.nativeEnum(ComplianceControlMaturity).optional(),
        testProcedure: z.string().nullable().optional(),
        notes: z.string().nullable().optional(),
        markReviewed: z.boolean().optional(),
        nextReviewDue: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.complianceControl.findUnique({
        where: { id: input.id },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const data: Prisma.ComplianceControlUpdateInput = {};
      if (input.ownerUserId !== undefined) {
        data.owner = input.ownerUserId
          ? { connect: { id: input.ownerUserId } }
          : { disconnect: true };
      }
      if (input.status !== undefined) data.status = input.status;
      if (input.maturity !== undefined) data.maturity = input.maturity;
      if (input.testProcedure !== undefined) data.testProcedure = input.testProcedure;
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.markReviewed) data.lastReviewedAt = new Date();
      if (input.nextReviewDue !== undefined) {
        data.nextReviewDue = input.nextReviewDue
          ? new Date(input.nextReviewDue)
          : null;
      }
      const updated = await ctx.db.complianceControl.update({
        where: { id: input.id },
        data,
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "UPDATE",
        entityType: "ComplianceControl",
        entityId: input.id,
        beforeState: { status: before.status, maturity: before.maturity },
        afterState: { status: updated.status, maturity: updated.maturity },
      });
      return updated;
    }),

  // ─── Evidence ──────────────────────────────────────────────────────
  addEvidence: staffProcedure
    .input(
      z.object({
        controlId: z.string().uuid(),
        type: z.nativeEnum(ComplianceEvidenceType),
        title: z.string().min(2),
        description: z.string().optional(),
        url: z.string().url().optional(),
        blobPath: z.string().optional(),
        periodStart: z.string().datetime().optional(),
        periodEnd: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.complianceEvidence.create({
        data: {
          controlId: input.controlId,
          type: input.type,
          title: input.title,
          description: input.description,
          url: input.url,
          blobPath: input.blobPath,
          periodStart: input.periodStart ? new Date(input.periodStart) : null,
          periodEnd: input.periodEnd ? new Date(input.periodEnd) : null,
          addedById: ctx.session.user.id,
        },
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "CREATE",
        entityType: "ComplianceEvidence",
        entityId: created.id,
        afterState: { type: created.type, title: created.title },
      });
      return created;
    }),

  removeEvidence: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.complianceEvidence.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "DELETE",
        entityType: "ComplianceEvidence",
        entityId: input.id,
      });
      return { ok: true };
    }),

  // ─── Gaps ──────────────────────────────────────────────────────────
  createGap: staffProcedure
    .input(
      z.object({
        controlId: z.string().uuid(),
        description: z.string().min(2),
        severity: z.nativeEnum(ComplianceGapSeverity).default("MODERATE"),
        ownerUserId: z.string().uuid().optional(),
        remediation: z.string().optional(),
        dueDate: z.string().datetime().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.db.complianceGap.create({
        data: {
          controlId: input.controlId,
          description: input.description,
          severity: input.severity,
          ownerUserId: input.ownerUserId,
          remediation: input.remediation,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
        },
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "CREATE",
        entityType: "ComplianceGap",
        entityId: created.id,
        afterState: { severity: created.severity, status: created.status },
      });
      return created;
    }),

  updateGap: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.nativeEnum(ComplianceGapStatus).optional(),
        remediation: z.string().nullable().optional(),
        ownerUserId: z.string().uuid().nullable().optional(),
        dueDate: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.complianceGap.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const data: Prisma.ComplianceGapUpdateInput = {};
      if (input.status !== undefined) {
        data.status = input.status;
        if (input.status === "CLOSED" || input.status === "RISK_ACCEPTED") {
          data.closedAt = new Date();
        }
      }
      if (input.remediation !== undefined) data.remediation = input.remediation;
      if (input.ownerUserId !== undefined) {
        data.owner = input.ownerUserId
          ? { connect: { id: input.ownerUserId } }
          : { disconnect: true };
      }
      if (input.dueDate !== undefined) {
        data.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      const updated = await ctx.db.complianceGap.update({
        where: { id: input.id },
        data,
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "UPDATE",
        entityType: "ComplianceGap",
        entityId: input.id,
        beforeState: { status: before.status },
        afterState: { status: updated.status },
      });
      return updated;
    }),

  // ─── Audit periods ─────────────────────────────────────────────────
  listAuditPeriods: staffProcedure
    .input(
      z.object({
        framework: z.nativeEnum(ComplianceFramework).optional(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.db.complianceAuditPeriod.findMany({
        where: input.framework ? { framework: input.framework } : {},
        orderBy: { periodStart: "desc" },
      })
    ),

  upsertAuditPeriod: managerProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        framework: z.nativeEnum(ComplianceFramework),
        periodStart: z.string().datetime(),
        periodEnd: z.string().datetime(),
        assessorOrg: z.string().optional(),
        assessorName: z.string().optional(),
        status: z.nativeEnum(ComplianceAuditPeriodStatus).default("PLANNING"),
        reportUrl: z.string().url().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = {
        framework: input.framework,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        assessorOrg: input.assessorOrg ?? null,
        assessorName: input.assessorName ?? null,
        status: input.status,
        reportUrl: input.reportUrl ?? null,
        notes: input.notes ?? null,
      };
      const period = input.id
        ? await ctx.db.complianceAuditPeriod.update({ where: { id: input.id }, data })
        : await ctx.db.complianceAuditPeriod.create({ data });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: input.id ? "UPDATE" : "CREATE",
        entityType: "ComplianceAuditPeriod",
        entityId: period.id,
        afterState: { framework: period.framework, status: period.status },
      });
      return period;
    }),
});
