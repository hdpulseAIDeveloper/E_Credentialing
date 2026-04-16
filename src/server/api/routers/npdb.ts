/**
 * NPDB router — query history, trigger query, acknowledge.
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

export const npdbRouter = createTRPCRouter({
  // ─── List NPDB records for provider ────────────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.nPDBRecord.findMany({
        where: { providerId: input.providerId },
        include: {
          acknowledgedBy: { select: { id: true, displayName: true } },
          botRun: { select: { id: true, status: true } },
        },
        orderBy: { queryDate: "desc" },
      });
    }),

  // ─── Get unacknowledged adverse reports ───────────────────────────────
  getAdverse: staffProcedure
    .query(async ({ ctx }) => {
      return ctx.db.nPDBRecord.findMany({
        where: { result: "REPORTS_FOUND", isAcknowledged: false },
        include: {
          provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
        },
        orderBy: { queryDate: "desc" },
      });
    }),

  // ─── Trigger NPDB query ────────────────────────────────────────────────
  triggerQuery: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        queryType: z.enum(["INITIAL", "ON_DEMAND"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      // Create BotRun record
      const botRun = await ctx.db.botRun.create({
        data: {
          providerId: input.providerId,
          botType: "NPDB",
          triggeredBy: "MANUAL",
          triggeredByUserId: ctx.session!.user.id,
          status: "QUEUED",
          attemptCount: 0,
          inputData: {
            npi: provider.npi,
            firstName: provider.legalFirstName,
            lastName: provider.legalLastName,
            queryType: input.queryType,
          },
        },
      });

      // Enqueue the NPDB bot job
      await getPsvQueue().add("npdb-query", {
        botRunId: botRun.id,
        providerId: input.providerId,
      }, {
        priority: 5,
        attempts: 3,
        backoff: { type: "exponential", delay: 30000 },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "npdb.query.triggered",
        entityType: "BotRun",
        entityId: botRun.id,
        providerId: input.providerId,
        afterState: { queryType: input.queryType, botRunId: botRun.id },
      });

      return botRun;
    }),

  // ─── Acknowledge adverse report ────────────────────────────────────────
  acknowledge: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.nPDBRecord.findUnique({ where: { id: input.id } });
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.nPDBRecord.update({
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
        action: "npdb.acknowledged",
        entityType: "NPDBRecord",
        entityId: input.id,
        providerId: record.providerId,
      });

      return updated;
    }),
});
