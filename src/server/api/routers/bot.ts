/**
 * Bot router — thin pass-through to BotService.
 *
 * Wave 2.1 service-layer extraction. The PSV BullMQ queue is constructed
 * lazily once per process and shared across all calls.
 */
import { z } from "zod";
import { Queue } from "bullmq";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { createRedisConnection } from "@/lib/redis";
import { BotService, TRIGGERABLE_BOT_TYPES } from "@/server/services/bot";

let _psvQueue: Queue | null = null;
function getPsvQueue(): Queue {
  if (!_psvQueue) {
    _psvQueue = new Queue("psv-bot", { connection: createRedisConnection() });
  }
  return _psvQueue;
}

function svc(ctx: { db: import("@prisma/client").PrismaClient; session: { user: { id: string; role: string } } | null }): BotService {
  return new BotService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
    queue: getPsvQueue(),
  });
}

export const botRouter = createTRPCRouter({
  listByProvider: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        botType: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      }),
    )
    .query(({ ctx, input }) => svc(ctx).listByProvider(input)),

  getLatestByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getLatestByProvider(input.providerId)),

  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getById(input.id)),

  triggerBot: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        botType: z.enum(TRIGGERABLE_BOT_TYPES),
        inputData: z.record(z.unknown()).optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).triggerBot(input)),

  acknowledgeFlag: managerProcedure
    .input(z.object({ verificationRecordId: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).acknowledgeFlag(input.verificationRecordId)),
});
