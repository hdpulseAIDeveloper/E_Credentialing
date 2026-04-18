/**
 * Evaluation router — thin pass-through to EvaluationService.
 *
 * Wave 3.1 service-layer extraction. All business logic, validation, and
 * audit-log writes live in `src/server/services/evaluation.ts`. This file
 * is kept intentionally tiny so the OpenAPI / tRPC surface is just a Zod
 * input contract on top of a service method.
 */

import { z } from "zod";
import {
  createTRPCRouter,
  staffProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { EvaluationService } from "@/server/services/evaluation";

function svc(ctx: {
  db: import("@prisma/client").PrismaClient;
  session: { user: { id: string; role: string } } | null;
}): EvaluationService {
  return new EvaluationService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
  });
}

export const evaluationRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        evaluationType: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      }),
    )
    .query(({ ctx, input }) => svc(ctx).list(input)),

  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getById(input.id)),

  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).listByProvider(input.providerId)),

  create: managerProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        evaluationType: z.enum(["OPPE", "FPPE"]),
        privilegeId: z.string().uuid().optional(),
        periodStart: z.string(),
        periodEnd: z.string(),
        dueDate: z.string(),
        evaluatorId: z.string().uuid().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).create(input)),

  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z
          .enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE"])
          .optional(),
        findings: z.string().optional(),
        recommendation: z.string().optional(),
        indicators: z.record(z.unknown()).optional(),
        documentBlobUrl: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).update(input)),

  getDashboard: staffProcedure.query(({ ctx }) => svc(ctx).getDashboard()),

  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).delete(input.id)),

  /**
   * Manager-triggered FPPE creation for an existing privilege. Useful when
   * the auto-FPPE was disabled or when a manager needs to spawn a brand-new
   * FPPE outside the auto path (e.g. an OPPE finding triggers FPPE).
   */
  createAutoFppeForPrivilege: managerProcedure
    .input(
      z.object({
        privilegeId: z.string().uuid(),
        periodDays: z.number().min(1).max(730).optional(),
        trigger: z.string().max(500).optional(),
      }),
    )
    .mutation(({ ctx, input }) =>
      svc(ctx).createAutoFppeForPrivilege(input.privilegeId, {
        periodDays: input.periodDays,
        trigger: input.trigger,
      }),
    ),
});
