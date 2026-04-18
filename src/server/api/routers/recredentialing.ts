/**
 * Recredentialing router — thin pass-through to RecredentialingService.
 *
 * Wave 2.1 service-layer extraction.
 */
import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { RecredentialingService } from "@/server/services/recredentialing";

function svc(ctx: { db: import("@prisma/client").PrismaClient; session: { user: { id: string; role: string } } | null }): RecredentialingService {
  return new RecredentialingService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
  });
}

export const recredentialingRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        status: z.string().optional(),
        dueDateBefore: z.string().optional(),
        dueDateAfter: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(({ ctx, input }) => svc(ctx).list(input)),

  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getById(input.id)),

  getByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getByProvider(input.providerId)),

  create: managerProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        dueDate: z.string(),
        cycleLengthMonths: z.number().min(1).default(36),
        notes: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).create(input)),

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
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).updateStatus(input)),

  getDashboard: staffProcedure.query(({ ctx }) => svc(ctx).getDashboard()),

  initiateBulk: managerProcedure.mutation(({ ctx }) => svc(ctx).initiateBulk()),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).delete(input.id)),
});
