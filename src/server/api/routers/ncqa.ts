/**
 * NCQA CVO readiness router.
 *
 * Exposes the criteria catalog, per-period assessments, and compliance
 * snapshots to the staff UI and the auditor-package export.
 *
 * Authoring of the criteria rows themselves (the actual NCQA CVO
 * standards) is owned by Compliance — see docs/status/blocked.md B-006.
 * The router ships with full CRUD so Compliance can load rows once the
 * content is provided (CSV import, or admin UI).
 */

import { z } from "zod";
import {
  NcqaAssessmentStatus,
  NcqaCategory,
  Prisma,
} from "@prisma/client";
import {
  createTRPCRouter,
  managerProcedure,
  staffProcedure,
} from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";

const createCriterionInput = z.object({
  code: z.string().min(1).max(32),
  category: z.nativeEnum(NcqaCategory),
  title: z.string().min(1),
  description: z.string().min(1),
  evidenceRequired: z.string().optional(),
  weight: z.number().int().min(1).max(10).default(1),
  sortOrder: z.number().int().default(0),
});

const upsertAssessmentInput = z.object({
  criterionId: z.string().uuid(),
  periodStart: z.date(),
  periodEnd: z.date(),
  status: z.nativeEnum(NcqaAssessmentStatus),
  score: z.number().int().min(0).max(100).optional(),
  evidence: z.record(z.unknown()).default({}),
  notes: z.string().optional(),
});

export const ncqaRouter = createTRPCRouter({
  // ─── Catalog ──────────────────────────────────────────────────────────
  listCriteria: staffProcedure
    .input(
      z
        .object({
          category: z.nativeEnum(NcqaCategory).optional(),
          activeOnly: z.boolean().default(true),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.NcqaCriterionWhereInput = {};
      if (input?.category) where.category = input.category;
      if (input?.activeOnly !== false) where.isActive = true;
      return ctx.db.ncqaCriterion.findMany({
        where,
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      });
    }),

  createCriterion: managerProcedure
    .input(createCriterionInput)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.ncqaCriterion.create({ data: input });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "ncqa.criterion.created",
        entityType: "NcqaCriterion",
        entityId: row.id,
        afterState: { code: row.code, title: row.title },
      });
      return row;
    }),

  updateCriterion: managerProcedure
    .input(
      createCriterionInput.partial().extend({ id: z.string().uuid() }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const before = await ctx.db.ncqaCriterion.findUnique({ where: { id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });
      const row = await ctx.db.ncqaCriterion.update({
        where: { id },
        data,
      });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "ncqa.criterion.updated",
        entityType: "NcqaCriterion",
        entityId: id,
        beforeState: { title: before.title, weight: before.weight },
        afterState: { title: row.title, weight: row.weight },
      });
      return row;
    }),

  deactivateCriterion: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.ncqaCriterion.update({
        where: { id: input.id },
        data: { isActive: false },
      });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "ncqa.criterion.deactivated",
        entityType: "NcqaCriterion",
        entityId: input.id,
      });
      return row;
    }),

  // ─── Assessments ──────────────────────────────────────────────────────
  listAssessments: staffProcedure
    .input(
      z.object({
        criterionId: z.string().uuid().optional(),
        periodStart: z.date().optional(),
        periodEnd: z.date().optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.NcqaCriterionAssessmentWhereInput = {};
      if (input.criterionId) where.criterionId = input.criterionId;
      if (input.periodStart) where.periodStart = { gte: input.periodStart };
      if (input.periodEnd) where.periodEnd = { lte: input.periodEnd };
      return ctx.db.ncqaCriterionAssessment.findMany({
        where,
        include: {
          criterion: { select: { code: true, title: true, category: true } },
          assessedBy: { select: { id: true, displayName: true } },
        },
        orderBy: [{ periodStart: "desc" }, { criterion: { code: "asc" } }],
      });
    }),

  upsertAssessment: managerProcedure
    .input(upsertAssessmentInput)
    .mutation(async ({ ctx, input }) => {
      const row = await ctx.db.ncqaCriterionAssessment.create({
        data: {
          criterionId: input.criterionId,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: input.status,
          score: input.score,
          evidence: input.evidence as Prisma.InputJsonValue,
          notes: input.notes,
          assessedById: ctx.session!.user.id,
          assessedAt: new Date(),
        },
      });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "ncqa.assessment.created",
        entityType: "NcqaCriterionAssessment",
        entityId: row.id,
        afterState: { criterionId: row.criterionId, status: row.status },
      });
      return row;
    }),

  // ─── Snapshots ────────────────────────────────────────────────────────
  listSnapshots: staffProcedure
    .input(
      z.object({
        since: z.date().optional(),
        take: z.number().int().min(1).max(100).default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.ncqaComplianceSnapshot.findMany({
        where: input.since ? { takenAt: { gte: input.since } } : undefined,
        orderBy: { takenAt: "desc" },
        take: input.take,
        include: { takenBy: { select: { id: true, displayName: true } } },
      });
    }),

  takeSnapshot: managerProcedure
    .input(
      z.object({
        notes: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const criteria = await ctx.db.ncqaCriterion.findMany({
        where: { isActive: true },
      });

      // Single round-trip: pull every assessment for active criteria, then fold in-memory.
      // We can't express "most-recent per criterion" cleanly in Prisma, but we can filter
      // to the small relevant set and pick the latest per group client-side.
      const criterionIds = criteria.map((c) => c.id);
      const assessments = criterionIds.length
        ? await ctx.db.ncqaCriterionAssessment.findMany({
            where: { criterionId: { in: criterionIds } },
            orderBy: { periodEnd: "desc" },
            select: { criterionId: true, status: true, score: true, periodEnd: true },
          })
        : [];
      const latestByCriterion = new Map<string, (typeof assessments)[number]>();
      for (const a of assessments) {
        if (!latestByCriterion.has(a.criterionId)) latestByCriterion.set(a.criterionId, a);
      }

      let compliant = 0;
      let partial = 0;
      let nonCompliant = 0;
      let notApplicable = 0;
      const breakdown: Record<string, { status: NcqaAssessmentStatus; score: number | null }> = {};
      for (const c of criteria) {
        const a = latestByCriterion.get(c.id);
        const status = (a?.status ?? NcqaAssessmentStatus.NOT_ASSESSED);
        breakdown[c.code] = { status, score: a?.score ?? null };
        if (status === NcqaAssessmentStatus.COMPLIANT) compliant++;
        else if (status === NcqaAssessmentStatus.PARTIAL) partial++;
        else if (status === NcqaAssessmentStatus.NON_COMPLIANT) nonCompliant++;
        else if (status === NcqaAssessmentStatus.NOT_APPLICABLE) notApplicable++;
      }

      const denominator = criteria.length - notApplicable;
      const overallScore =
        denominator > 0
          ? Math.round(((compliant + partial * 0.5) / denominator) * 100)
          : 0;

      const snapshot = await ctx.db.ncqaComplianceSnapshot.create({
        data: {
          totalCriteria: criteria.length,
          compliantCount: compliant,
          partialCount: partial,
          nonCompliantCount: nonCompliant,
          notApplicableCount: notApplicable,
          overallScore,
          breakdown: breakdown as unknown as Prisma.InputJsonValue,
          takenById: ctx.session!.user.id,
          notes: input.notes,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "ncqa.snapshot.taken",
        entityType: "NcqaComplianceSnapshot",
        entityId: snapshot.id,
        afterState: { overallScore, totalCriteria: criteria.length },
      });

      return snapshot;
    }),
});
