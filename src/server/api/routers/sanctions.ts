/**
 * Sanctions router — check history, trigger on-demand check.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";

let _psvQueue: Queue | null = null;
function getPsvQueue(): Queue {
  if (!_psvQueue) {
    _psvQueue = new Queue("psv-bot", { connection: createRedisConnection() });
  }
  return _psvQueue;
}

export const sanctionsRouter = createTRPCRouter({
  // ─── List sanctions checks for a provider ────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.sanctionsCheck.findMany({
        where: { providerId: input.providerId },
        include: {
          triggeredByUser: { select: { id: true, displayName: true } },
          acknowledgedBy: { select: { id: true, displayName: true } },
          botRun: { select: { id: true, status: true } },
        },
        orderBy: { runDate: "desc" },
      });
    }),

  // ─── Get flagged sanctions (unacknowledged) ───────────────────────────
  getFlagged: staffProcedure
    .query(async ({ ctx }) => {
      return ctx.db.sanctionsCheck.findMany({
        where: { result: "FLAGGED", isAcknowledged: false },
        include: {
          provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
          botRun: { select: { id: true, status: true } },
        },
        orderBy: { runDate: "desc" },
      });
    }),

  // ─── Trigger on-demand check ──────────────────────────────────────────
  triggerCheck: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        source: z.enum(["OIG", "SAM_GOV"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      // Create BotRun record
      const botRun = await ctx.db.botRun.create({
        data: {
          providerId: input.providerId,
          botType: input.source === "OIG" ? "OIG_SANCTIONS" : "SAM_SANCTIONS",
          triggeredBy: "MANUAL",
          triggeredByUserId: ctx.session!.user.id,
          status: "QUEUED",
          attemptCount: 0,
          inputData: {
            npi: provider.npi,
            firstName: provider.legalFirstName,
            lastName: provider.legalLastName,
          },
        },
      });

      // Enqueue bot job
      try {
        const queue = getPsvQueue();
        await queue.add(
          input.source === "OIG" ? "oig-sanctions" : "sam-sanctions",
          { botRunId: botRun.id, providerId: input.providerId },
          { priority: 2, attempts: 3 }
        );
      } catch (error) {
        console.error("[Sanctions] Failed to enqueue bot job:", error);
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "sanctions.check.triggered",
        entityType: "BotRun",
        entityId: botRun.id,
        providerId: input.providerId,
        afterState: { source: input.source, botRunId: botRun.id },
      });

      return botRun;
    }),

  // ─── Acknowledge a flagged check ──────────────────────────────────────
  acknowledge: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const check = await ctx.db.sanctionsCheck.findUnique({ where: { id: input.id } });
      if (!check) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.sanctionsCheck.update({
        where: { id: input.id },
        data: {
          isAcknowledged: true,
          acknowledgedById: ctx.session!.user.id,
          acknowledgedAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "sanctions.acknowledged",
        entityType: "SanctionsCheck",
        entityId: input.id,
        providerId: check.providerId,
      });

      return updated;
    }),
});
