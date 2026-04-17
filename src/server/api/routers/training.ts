/**
 * Staff training / LMS integration router.
 *
 * P2 Gap #18 extends this router with course catalog management,
 * per-user assignment management, my-training queries, and an
 * org-wide compliance summary used by the NCQA dashboard.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import {
  TrainingCourseFrequency,
  TrainingAssignmentStatus,
  UserRole,
} from "@prisma/client";
import {
  reconcileAssignmentStatus,
  syncAssignmentsForUser,
  getOrgComplianceSummary,
} from "@/lib/training";

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
    const [totalRecords, expiredCount, activeUsers, orgSummary] = await Promise.all([
      ctx.db.staffTrainingRecord.count(),
      ctx.db.staffTrainingRecord.count({
        where: { expiresAt: { lt: now } },
      }),
      ctx.db.user.count({
        where: { isActive: true, role: { not: "PROVIDER" } },
      }),
      getOrgComplianceSummary(ctx.db),
    ]);
    return { totalRecords, expiredCount, activeUsers, ...orgSummary };
  }),

  // ─── Course catalog ─────────────────────────────────────────────────
  listCourses: staffProcedure.query(({ ctx }) =>
    ctx.db.trainingCourse.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }],
    })
  ),

  upsertCourse: adminProcedure
    .input(
      z.object({
        id: z.string().uuid().optional(),
        code: z.string().min(1),
        title: z.string().min(1),
        description: z.string().optional().nullable(),
        category: z.string().default("data_integrity"),
        durationMinutes: z.number().int().positive().optional().nullable(),
        frequency: z.nativeEnum(TrainingCourseFrequency).default("ANNUAL"),
        validityDays: z.number().int().positive().optional().nullable(),
        contentUrl: z.string().url().optional().nullable(),
        externalLmsId: z.string().optional().nullable(),
        isActive: z.boolean().default(true),
        requiredForRoles: z.array(z.nativeEnum(UserRole)).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data = {
        code: input.code,
        title: input.title,
        description: input.description ?? null,
        category: input.category,
        durationMinutes: input.durationMinutes ?? null,
        frequency: input.frequency,
        validityDays: input.validityDays ?? null,
        contentUrl: input.contentUrl ?? null,
        externalLmsId: input.externalLmsId ?? null,
        isActive: input.isActive,
        requiredForRoles: input.requiredForRoles,
      };
      if (input.id) {
        return ctx.db.trainingCourse.update({ where: { id: input.id }, data });
      }
      return ctx.db.trainingCourse.create({ data });
    }),

  deleteCourse: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.trainingCourse.delete({ where: { id: input.id } });
      return { success: true };
    }),

  // ─── Per-user assignments ───────────────────────────────────────────
  listAssignments: staffProcedure
    .input(
      z.object({
        userId: z.string().uuid().optional(),
        status: z.nativeEnum(TrainingAssignmentStatus).optional(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.db.trainingAssignment.findMany({
        where: {
          ...(input.userId ? { userId: input.userId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          course: true,
          user: { select: { id: true, displayName: true, email: true, role: true } },
        },
        orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      })
    ),

  myAssignments: staffProcedure.query(async ({ ctx }) => {
    return ctx.db.trainingAssignment.findMany({
      where: { userId: ctx.session!.user.id },
      include: { course: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    });
  }),

  resyncMyAssignments: staffProcedure.mutation(async ({ ctx }) => {
    const user = await ctx.db.user.findUnique({
      where: { id: ctx.session!.user.id },
      select: { id: true, role: true, isActive: true },
    });
    if (!user) throw new TRPCError({ code: "NOT_FOUND" });
    return syncAssignmentsForUser(ctx.db, user);
  }),

  resyncAll: adminProcedure.mutation(async ({ ctx }) => {
    const users = await ctx.db.user.findMany({
      where: { isActive: true, role: { not: "PROVIDER" } },
      select: { id: true, role: true, isActive: true },
    });
    let created = 0;
    let updated = 0;
    for (const u of users) {
      const r = await syncAssignmentsForUser(ctx.db, u);
      created += r.created;
      updated += r.updated;
    }
    return { usersConsidered: users.length, created, updated };
  }),

  recordCompletion: staffProcedure
    .input(
      z.object({
        assignmentId: z.string().uuid(),
        completedAt: z.string().datetime().optional(),
        certificateUrl: z.string().url().optional().nullable(),
        scorePercent: z.number().int().min(0).max(100).optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const assignment = await ctx.db.trainingAssignment.findUnique({
        where: { id: input.assignmentId },
        include: { course: true },
      });
      if (!assignment) throw new TRPCError({ code: "NOT_FOUND" });

      // Only the assigned user, an ADMIN, or a MANAGER can record a completion.
      const userId = ctx.session!.user.id;
      const role = ctx.session!.user.role;
      if (
        assignment.userId !== userId &&
        role !== "ADMIN" &&
        role !== "MANAGER"
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }

      const completedAt = input.completedAt
        ? new Date(input.completedAt)
        : new Date();

      const record = await ctx.db.staffTrainingRecord.create({
        data: {
          userId: assignment.userId,
          courseId: assignment.courseId,
          courseName: assignment.course.title,
          courseCategory: assignment.course.category,
          completedAt,
          certificateUrl: input.certificateUrl ?? null,
          scorePercent: input.scorePercent ?? null,
          source: "in_app",
        },
      });
      await reconcileAssignmentStatus(ctx.db, assignment.id);
      return record;
    }),

  waiveAssignment: adminProcedure
    .input(z.object({ id: z.string().uuid(), notes: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.trainingAssignment.update({
        where: { id: input.id },
        data: { status: "WAIVED", notes: input.notes ?? null },
      });
    }),
});
