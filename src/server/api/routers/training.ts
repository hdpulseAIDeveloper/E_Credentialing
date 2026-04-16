/**
 * Staff training / LMS integration router.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const trainingRouter = createTRPCRouter({
  listByUser: staffProcedure
    .input(z.object({ userId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.staffTrainingRecord.findMany({
        where: { userId: input.userId },
        orderBy: { completedAt: "desc" },
      });
    }),

  listAll: adminProcedure
    .input(
      z.object({
        courseCategory: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = input.courseCategory ? { courseCategory: input.courseCategory } : {};
      const [total, records] = await Promise.all([
        ctx.db.staffTrainingRecord.count({ where }),
        ctx.db.staffTrainingRecord.findMany({
          where,
          include: { user: { select: { id: true, displayName: true, role: true } } },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { completedAt: "desc" },
        }),
      ]);
      return { records, total };
    }),

  create: adminProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        courseName: z.string().min(1),
        courseCategory: z.string().default("general"),
        completedAt: z.string().optional(),
        expiresAt: z.string().optional(),
        certificateUrl: z.string().optional(),
        source: z.string().default("manual"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.staffTrainingRecord.create({
        data: {
          userId: input.userId,
          courseName: input.courseName,
          courseCategory: input.courseCategory,
          completedAt: input.completedAt ? new Date(input.completedAt) : null,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
          certificateUrl: input.certificateUrl,
          source: input.source,
        },
      });
    }),

  update: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        completedAt: z.string().optional(),
        expiresAt: z.string().optional(),
        certificateUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.staffTrainingRecord.findUnique({ where: { id: input.id } });
      if (!record) throw new TRPCError({ code: "NOT_FOUND" });

      return ctx.db.staffTrainingRecord.update({
        where: { id: input.id },
        data: {
          ...(input.completedAt && { completedAt: new Date(input.completedAt) }),
          ...(input.expiresAt && { expiresAt: new Date(input.expiresAt) }),
          ...(input.certificateUrl !== undefined && { certificateUrl: input.certificateUrl }),
        },
      });
    }),

  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.staffTrainingRecord.delete({ where: { id: input.id } });
      return { success: true };
    }),

  getComplianceSummary: adminProcedure.query(async ({ ctx }) => {
    const now = new Date();
    const [totalRecords, expiredCount, activeUsers] = await Promise.all([
      ctx.db.staffTrainingRecord.count(),
      ctx.db.staffTrainingRecord.count({
        where: { expiresAt: { lt: now } },
      }),
      ctx.db.user.count({
        where: { isActive: true, role: { not: "PROVIDER" } },
      }),
    ]);
    return { totalRecords, expiredCount, activeUsers };
  }),
});
