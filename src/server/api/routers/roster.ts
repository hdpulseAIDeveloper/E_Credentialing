/**
 * Roster router — thin pass-through to RosterService.
 *
 * Wave 2.1 service-layer extraction. The CSV builder + validation logic
 * lives in `src/server/services/roster.ts` so the future scheduled-roster
 * worker (W3.4) can reuse it.
 */
import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { RosterService } from "@/server/services/roster";

function svc(ctx: { db: import("@prisma/client").PrismaClient; session: { user: { id: string; role: string } } | null }): RosterService {
  return new RosterService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
  });
}

export const rosterRouter = createTRPCRouter({
  listRosters: staffProcedure.query(({ ctx }) => svc(ctx).listRosters()),

  getRoster: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getRoster(input.id)),

  createRoster: managerProcedure
    .input(
      z.object({
        payerName: z.string().min(1),
        rosterFormat: z.string().default("csv"),
        templateConfig: z.record(z.unknown()).default({}),
        submissionMethod: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).createRoster(input)),

  updateRoster: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        payerName: z.string().min(1).optional(),
        rosterFormat: z.string().optional(),
        templateConfig: z.record(z.unknown()).optional(),
        submissionMethod: z.string().nullish(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).updateRoster(input)),

  deleteRoster: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).deleteRoster(input.id)),

  generateSubmission: staffProcedure
    .input(z.object({ rosterId: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).generateSubmission(input.rosterId)),

  validateSubmission: staffProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).validateSubmission(input.submissionId)),

  submitRoster: staffProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        notes: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).submitRoster(input.submissionId, input.notes)),

  acknowledgeRoster: staffProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).acknowledgeRoster(input.submissionId)),
});
