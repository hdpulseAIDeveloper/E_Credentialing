/**
 * P2 Gap #19 — AI governance tRPC router.
 *
 * Surfaces the model card catalog, vendor contract status, and the
 * decision-log audit trail. Reviewers (MANAGER+) can confirm/modify/reject
 * any AI-suggested action.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  staffProcedure,
  adminProcedure,
} from "@/server/api/trpc";
import {
  AiHumanDecision,
  AiModelRiskLevel,
  AiModelStatus,
  type Prisma,
} from "@prisma/client";
import { getGovernanceSummary, recordHumanDecision } from "@/lib/ai/governance";

export const aiGovernanceRouter = createTRPCRouter({
  // ─── Model cards ────────────────────────────────────────────────────
  listModelCards: staffProcedure.query(({ ctx }) =>
    ctx.db.aiModelCard.findMany({
      include: {
        lastReviewedBy: { select: { id: true, displayName: true } },
        _count: { select: { decisions: true } },
      },
      orderBy: [{ status: "asc" }, { vendor: "asc" }, { name: "asc" }],
    })
  ),

  getModelCard: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.db.aiModelCard.findUnique({
        where: { id: input.id },
        include: {
          lastReviewedBy: { select: { id: true, displayName: true } },
        },
      });
      if (!card) throw new TRPCError({ code: "NOT_FOUND" });
      return card;
    }),

  upsertModelCard: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        name: z.string().min(1),
        version: z.string().min(1),
        vendor: z.string().min(1),
        modality: z.string().min(1),
        purpose: z.string().min(1),
        intendedUse: z.string().min(1),
        outOfScopeUse: z.string().optional().nullable(),
        features: z.array(z.string()).default([]),
        riskLevel: z.nativeEnum(AiModelRiskLevel).default("MEDIUM"),
        status: z.nativeEnum(AiModelStatus).default("PILOT"),
        hostingEnvironment: z.string().optional().nullable(),
        dataResidency: z.string().optional().nullable(),
        trainingDataPolicy: z.string().optional().nullable(),
        noTrainingOnCustomerData: z.boolean().default(false),
        contractClauseRef: z.string().optional().nullable(),
        contractEffectiveDate: z.string().datetime().optional().nullable(),
        contractReviewDueDate: z.string().datetime().optional().nullable(),
        knownLimitations: z.string().optional().nullable(),
        evaluationMetrics: z.unknown().optional().nullable(),
        fairnessNotes: z.string().optional().nullable(),
        humanReviewRequired: z.boolean().default(true),
        documentationUrl: z.string().url().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Prisma.AiModelCardCreateInput | Prisma.AiModelCardUpdateInput = {
        name: input.name,
        version: input.version,
        vendor: input.vendor,
        modality: input.modality,
        purpose: input.purpose,
        intendedUse: input.intendedUse,
        outOfScopeUse: input.outOfScopeUse ?? null,
        features: input.features,
        riskLevel: input.riskLevel,
        status: input.status,
        hostingEnvironment: input.hostingEnvironment ?? null,
        dataResidency: input.dataResidency ?? null,
        trainingDataPolicy: input.trainingDataPolicy ?? null,
        noTrainingOnCustomerData: input.noTrainingOnCustomerData,
        contractClauseRef: input.contractClauseRef ?? null,
        contractEffectiveDate: input.contractEffectiveDate
          ? new Date(input.contractEffectiveDate)
          : null,
        contractReviewDueDate: input.contractReviewDueDate
          ? new Date(input.contractReviewDueDate)
          : null,
        knownLimitations: input.knownLimitations ?? null,
        evaluationMetrics:
          (input.evaluationMetrics ?? null) as Prisma.InputJsonValue,
        fairnessNotes: input.fairnessNotes ?? null,
        humanReviewRequired: input.humanReviewRequired,
        documentationUrl: input.documentationUrl ?? null,
      };
      if (input.id) {
        return ctx.db.aiModelCard.update({
          where: { id: input.id },
          data,
        });
      }
      return ctx.db.aiModelCard.create({
        data: data as Prisma.AiModelCardCreateInput,
      });
    }),

  attestModelCardReview: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) =>
      ctx.db.aiModelCard.update({
        where: { id: input.id },
        data: {
          lastReviewedAt: new Date(),
          lastReviewedById: ctx.session!.user.id,
        },
      })
    ),

  deleteModelCard: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.aiModelCard.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ─── Decision log ───────────────────────────────────────────────────
  listDecisionLogs: staffProcedure
    .input(
      z.object({
        feature: z.string().optional(),
        humanDecision: z.nativeEnum(AiHumanDecision).optional(),
        providerId: z.string().uuid().optional(),
        limit: z.number().min(1).max(200).default(100),
        cursor: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.AiDecisionLogWhereInput = {
        ...(input.feature ? { feature: input.feature } : {}),
        ...(input.humanDecision ? { humanDecision: input.humanDecision } : {}),
        ...(input.providerId ? { providerId: input.providerId } : {}),
      };
      const items = await ctx.db.aiDecisionLog.findMany({
        where,
        include: {
          modelCard: { select: { id: true, name: true, vendor: true } },
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
          humanDecisionBy: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit + 1,
        ...(input.cursor && { cursor: { id: input.cursor }, skip: 1 }),
      });
      let nextCursor: string | undefined;
      if (items.length > input.limit) {
        nextCursor = items.pop()!.id;
      }
      return { items, nextCursor };
    }),

  recordDecision: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        decision: z.nativeEnum(AiHumanDecision),
        note: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await recordHumanDecision(
        ctx.db,
        input.id,
        input.decision,
        ctx.session!.user.id,
        input.note ?? null
      );
      return { success: true };
    }),

  // ─── Compliance summary ────────────────────────────────────────────
  summary: staffProcedure.query(({ ctx }) => getGovernanceSummary(ctx.db)),
});
