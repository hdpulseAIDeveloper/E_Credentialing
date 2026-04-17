/**
 * P3 Gap #20 — Bot exception orchestrator router.
 *
 * Surfaces orchestrator verdicts to staff so they can accept, override, or
 * resolve them. Also exposes a manual "re-triage this run" endpoint useful
 * after editing a bot or rotating credentials.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  staffProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import {
  BotExceptionAction,
  BotExceptionVerdictStatus,
  type Prisma,
} from "@prisma/client";
import { orchestrateBotException } from "@/lib/ai/agent-orchestrator";
import { writeAuditLog } from "@/lib/audit";

export const botOrchestratorRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z.object({
        status: z.nativeEnum(BotExceptionVerdictStatus).optional(),
        action: z.nativeEnum(BotExceptionAction).optional(),
        providerId: z.string().uuid().optional(),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.BotExceptionVerdictWhereInput = {
        ...(input.status ? { status: input.status } : {}),
        ...(input.action ? { recommendedAction: input.action } : {}),
        ...(input.providerId ? { providerId: input.providerId } : {}),
      };
      return ctx.db.botExceptionVerdict.findMany({
        where,
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
          botRun: {
            select: {
              id: true,
              botType: true,
              status: true,
              attemptCount: true,
              errorMessage: true,
              completedAt: true,
            },
          },
          resolvedBy: { select: { id: true, displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: input.limit,
      });
    }),

  get: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const verdict = await ctx.db.botExceptionVerdict.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
          botRun: true,
          resolvedBy: { select: { id: true, displayName: true } },
        },
      });
      if (!verdict) throw new TRPCError({ code: "NOT_FOUND" });
      return verdict;
    }),

  counts: staffProcedure.query(async ({ ctx }) => {
    const [pending, autoExecuted, accepted, overridden, resolved] =
      await Promise.all([
        ctx.db.botExceptionVerdict.count({
          where: { status: "PENDING_REVIEW" },
        }),
        ctx.db.botExceptionVerdict.count({
          where: { status: "AUTO_EXECUTED" },
        }),
        ctx.db.botExceptionVerdict.count({ where: { status: "ACCEPTED" } }),
        ctx.db.botExceptionVerdict.count({ where: { status: "OVERRIDDEN" } }),
        ctx.db.botExceptionVerdict.count({ where: { status: "RESOLVED" } }),
      ]);
    return { pending, autoExecuted, accepted, overridden, resolved };
  }),

  // Manually re-run the orchestrator for a bot run.
  triageBotRun: managerProcedure
    .input(z.object({ botRunId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const result = await orchestrateBotException(ctx.db, input.botRunId);
      if (!result) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Bot run is not in an exceptional state (failed/manual/flagged).",
        });
      }
      await writeAuditLog({
        actorId: ctx.session?.user.id ?? null,
        actorRole: "MANAGER",
        action: "bot.exception.orchestrator.triage",
        entityType: "BotRun",
        entityId: input.botRunId,
        afterState: {
          verdictId: result.id,
          recommendedAction: result.verdict.recommendedAction,
          rationale: result.verdict.rationale,
          confidence: result.verdict.confidence,
          source: result.verdict.source,
        },
      });
      return result;
    }),

  // Staff accepts the AI verdict as-is.
  accept: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        note: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const verdict = await ctx.db.botExceptionVerdict.update({
        where: { id: input.id },
        data: {
          status: "ACCEPTED",
          resolvedAt: new Date(),
          resolvedById: userId,
          resolutionNote: input.note ?? null,
        },
      });
      if (verdict.aiDecisionLogId) {
        await ctx.db.aiDecisionLog.update({
          where: { id: verdict.aiDecisionLogId },
          data: {
            humanDecision: "ACCEPTED",
            humanDecisionById: userId,
            humanDecisionAt: new Date(),
            humanNote: input.note ?? null,
          },
        });
      }
      await writeAuditLog({
        actorId: userId,
        actorRole: "MANAGER",
        action: "bot.exception.orchestrator.accept",
        entityType: "BotExceptionVerdict",
        entityId: verdict.id,
        afterState: { recommendedAction: verdict.recommendedAction },
      });
      return verdict;
    }),

  // Staff overrides the AI verdict with their own action choice.
  override: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        chosenAction: z.nativeEnum(BotExceptionAction),
        note: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const verdict = await ctx.db.botExceptionVerdict.update({
        where: { id: input.id },
        data: {
          status: "OVERRIDDEN",
          resolvedAt: new Date(),
          resolvedById: userId,
          resolutionNote: `Override → ${input.chosenAction}: ${input.note}`,
        },
      });
      if (verdict.aiDecisionLogId) {
        await ctx.db.aiDecisionLog.update({
          where: { id: verdict.aiDecisionLogId },
          data: {
            humanDecision: "REJECTED",
            humanDecisionById: userId,
            humanDecisionAt: new Date(),
            humanNote: `Overridden to ${input.chosenAction}: ${input.note}`,
          },
        });
      }
      await writeAuditLog({
        actorId: userId,
        actorRole: "MANAGER",
        action: "bot.exception.orchestrator.override",
        entityType: "BotExceptionVerdict",
        entityId: verdict.id,
        afterState: {
          aiAction: verdict.recommendedAction,
          chosenAction: input.chosenAction,
        },
      });
      return verdict;
    }),

  resolve: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        note: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.session!.user.id;
      const verdict = await ctx.db.botExceptionVerdict.update({
        where: { id: input.id },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
          resolvedById: userId,
          resolutionNote: input.note ?? null,
        },
      });
      await writeAuditLog({
        actorId: userId,
        actorRole: "STAFF",
        action: "bot.exception.orchestrator.resolve",
        entityType: "BotExceptionVerdict",
        entityId: verdict.id,
      });
      return verdict;
    }),
});
