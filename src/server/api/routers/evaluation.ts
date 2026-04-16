/**
 * Evaluation router — OPPE/FPPE practice evaluations for providers.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { EvaluationType, EvaluationStatus } from "@prisma/client";

export const evaluationRouter = createTRPCRouter({
  // ─── List evaluations with pagination ───────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        evaluationType: z.string().optional(),
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.providerId) where.providerId = input.providerId;
      if (input.evaluationType) where.evaluationType = input.evaluationType as EvaluationType;
      if (input.status) where.status = input.status as EvaluationStatus;

      const [total, evaluations] = await Promise.all([
        ctx.db.practiceEvaluation.count({ where }),
        ctx.db.practiceEvaluation.findMany({
          where,
          include: {
            provider: {
              select: { id: true, legalFirstName: true, legalLastName: true },
            },
            evaluator: {
              select: { id: true, displayName: true },
            },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { dueDate: "asc" },
        }),
      ]);

      return { evaluations, total };
    }),

  // ─── Get evaluation by ID ──────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const evaluation = await ctx.db.practiceEvaluation.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true, providerType: true },
          },
          evaluator: {
            select: { id: true, displayName: true, email: true },
          },
          hospitalPrivilege: true,
        },
      });

      if (!evaluation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });
      }

      return evaluation;
    }),

  // ─── List evaluations by provider ──────────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.practiceEvaluation.findMany({
        where: { providerId: input.providerId },
        include: {
          evaluator: { select: { id: true, displayName: true } },
          hospitalPrivilege: { select: { id: true, facilityName: true } },
        },
        orderBy: { dueDate: "asc" },
      });
    }),

  // ─── Create evaluation ─────────────────────────────────────────────
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

      const evaluation = await ctx.db.practiceEvaluation.create({
        data: {
          providerId: input.providerId,
          evaluationType: input.evaluationType,
          privilegeId: input.privilegeId,
          periodStart: new Date(input.periodStart),
          periodEnd: new Date(input.periodEnd),
          dueDate: new Date(input.dueDate),
          evaluatorId: input.evaluatorId,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "evaluation.created",
        entityType: "PracticeEvaluation",
        entityId: evaluation.id,
        providerId: input.providerId,
        afterState: {
          evaluationType: input.evaluationType,
          dueDate: input.dueDate,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
        },
      });

      return evaluation;
    }),

  // ─── Update evaluation ─────────────────────────────────────────────
  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "OVERDUE"]).optional(),
        findings: z.string().optional(),
        recommendation: z.string().optional(),
        indicators: z.record(z.unknown()).optional(),
        documentBlobUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.practiceEvaluation.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });

      const data: Record<string, unknown> = {};

      if (input.status !== undefined) data.status = input.status;
      if (input.findings !== undefined) data.findings = input.findings;
      if (input.recommendation !== undefined) data.recommendation = input.recommendation;
      if (input.indicators !== undefined) data.indicators = input.indicators as unknown as import("@prisma/client").Prisma.InputJsonValue;
      if (input.documentBlobUrl !== undefined) data.documentBlobUrl = input.documentBlobUrl;
      if (input.status === "COMPLETED") data.completedAt = new Date();

      const updated = await ctx.db.practiceEvaluation.update({
        where: { id: input.id },
        data,
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "evaluation.updated",
        entityType: "PracticeEvaluation",
        entityId: input.id,
        providerId: before.providerId,
        beforeState: { status: before.status },
        afterState: { status: input.status ?? before.status },
      });

      return updated;
    }),

  // ─── Dashboard summary ─────────────────────────────────────────────
  getDashboard: staffProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

      const [totalScheduled, overdue, oppePending, fppePending, completedThisMonth] =
        await Promise.all([
          ctx.db.practiceEvaluation.count({
            where: { status: "SCHEDULED" },
          }),
          ctx.db.practiceEvaluation.count({
            where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
          }),
          ctx.db.practiceEvaluation.count({
            where: { evaluationType: "OPPE", status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
          }),
          ctx.db.practiceEvaluation.count({
            where: { evaluationType: "FPPE", status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
          }),
          ctx.db.practiceEvaluation.count({
            where: {
              status: "COMPLETED",
              completedAt: { gte: monthStart, lte: monthEnd },
            },
          }),
        ]);

      return { totalScheduled, overdue, oppePending, fppePending, completedThisMonth };
    }),

  // ─── Delete evaluation ─────────────────────────────────────────────
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const evaluation = await ctx.db.practiceEvaluation.findUnique({
        where: { id: input.id },
        select: { id: true, providerId: true, status: true, evaluationType: true },
      });

      if (!evaluation) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });
      }

      if (evaluation.status !== "SCHEDULED") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Only SCHEDULED evaluations can be deleted",
        });
      }

      await ctx.db.practiceEvaluation.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "evaluation.deleted",
        entityType: "PracticeEvaluation",
        entityId: input.id,
        providerId: evaluation.providerId,
        beforeState: { status: evaluation.status, evaluationType: evaluation.evaluationType },
      });

      return { success: true };
    }),
});
