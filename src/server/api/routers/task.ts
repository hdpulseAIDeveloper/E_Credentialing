/**
 * Task router — CRUD, assignment, comments.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { TaskPriority, TaskStatus } from "@prisma/client";

export const taskRouter = createTRPCRouter({
  // ─── List tasks ────────────────────────────────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        assignedToId: z.string().uuid().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.providerId && { providerId: input.providerId }),
        ...(input.assignedToId && { assignedToId: input.assignedToId }),
        ...(input.status && { status: input.status as TaskStatus }),
        ...(input.priority && { priority: input.priority as TaskPriority }),
      };

      const [total, tasks] = await Promise.all([
        ctx.db.task.count({ where }),
        ctx.db.task.findMany({
          where,
          include: {
            assignedTo: { select: { id: true, displayName: true } },
            completedBy: { select: { id: true, displayName: true } },
            provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
            _count: { select: { comments: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        }),
      ]);

      return { tasks, total };
    }),

  // ─── Get by ID with comments ───────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({
        where: { id: input.id },
        include: {
          assignedTo: { select: { id: true, displayName: true } },
          completedBy: { select: { id: true, displayName: true } },
          provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
          comments: {
            include: { author: { select: { id: true, displayName: true } } },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!task) throw new TRPCError({ code: "NOT_FOUND" });
      return task;
    }),

  // ─── Create task ───────────────────────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        title: z.string().min(1),
        description: z.string().optional(),
        assignedToId: z.string().uuid(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).default("MEDIUM"),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.create({
        data: {
          providerId: input.providerId,
          title: input.title,
          description: input.description,
          assignedToId: input.assignedToId,
          priority: input.priority as TaskPriority,
          status: "OPEN",
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          createdById: ctx.session!.user.id,
        },
        include: {
          assignedTo: { select: { id: true, displayName: true, email: true } },
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "task.created",
        entityType: "Task",
        entityId: task.id,
        providerId: input.providerId,
        afterState: { title: input.title, assignedToId: input.assignedToId },
      });

      return task;
    }),

  // ─── Update task ────────────────────────────────────────────────────────
  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        title: z.string().optional(),
        description: z.string().optional(),
        assignedToId: z.string().uuid().optional(),
        priority: z.enum(["HIGH", "MEDIUM", "LOW"]).optional(),
        status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "BLOCKED"]).optional(),
        dueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.task.findUnique({ where: { id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updateData: Record<string, unknown> = { ...rest };
      if (rest.dueDate) updateData.dueDate = new Date(rest.dueDate);
      if (rest.status === "COMPLETED" && before.status !== "COMPLETED") {
        updateData.completedAt = new Date();
        updateData.completedById = ctx.session!.user.id;
      }

      const updated = await ctx.db.task.update({ where: { id }, data: updateData });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "task.updated",
        entityType: "Task",
        entityId: id,
        providerId: before.providerId,
        beforeState: { status: before.status },
        afterState: { status: updated.status },
      });

      return updated;
    }),

  // ─── Add comment ───────────────────────────────────────────────────────
  addComment: staffProcedure
    .input(
      z.object({
        taskId: z.string().uuid(),
        body: z.string().min(1),
        mentionedUserIds: z.array(z.string().uuid()).default([]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const task = await ctx.db.task.findUnique({ where: { id: input.taskId } });
      if (!task) throw new TRPCError({ code: "NOT_FOUND" });

      const comment = await ctx.db.taskComment.create({
        data: {
          taskId: input.taskId,
          authorId: ctx.session!.user.id,
          body: input.body,
          mentionedUserIds: input.mentionedUserIds,
        },
        include: { author: { select: { id: true, displayName: true } } },
      });

      return comment;
    }),
});
