/**
 * Sanctions router — thin pass-through to SanctionsService.
 *
 * Wave 2.1 service-layer extraction. The PSV BullMQ queue is constructed
 * lazily once per process and shared with the bot router.
 */
import { z } from "zod";
import { Queue } from "bullmq";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { createRedisConnection } from "@/lib/redis";
import { SanctionsService } from "@/server/services/sanctions";

let _psvQueue: Queue | null = null;
function getPsvQueue(): Queue {
  if (!_psvQueue) {
    _psvQueue = new Queue("psv-bot", { connection: createRedisConnection() });
  }
  return _psvQueue;
}

function svc(ctx: { db: import("@prisma/client").PrismaClient; session: { user: { id: string; role: string } } | null }): SanctionsService {
  return new SanctionsService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
    queue: getPsvQueue(),
  });
}

export const sanctionsRouter = createTRPCRouter({
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).listByProvider(input.providerId)),

  getFlagged: staffProcedure.query(({ ctx }) => svc(ctx).getFlagged()),

  triggerCheck: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        source: z.enum(["OIG", "SAM_GOV"]),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).triggerCheck(input.providerId, input.source)),

  acknowledge: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).acknowledge(input.id)),
});
