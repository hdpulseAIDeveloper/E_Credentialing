/**
 * Admin router — user management, provider type config, system settings.
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

export const adminRouter = createTRPCRouter({
  // ─── Get single user ────────────────────────────────────────────────────
  getUser: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        include: {
          assignedProviders: {
            select: { id: true, legalFirstName: true, legalLastName: true, status: true, npi: true },
            orderBy: { updatedAt: "desc" },
          },
          assignedTasks: {
            where: { status: { not: "COMPLETED" } },
            select: { id: true, title: true, status: true, priority: true, dueDate: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
          auditLogsAsActor: {
            select: { id: true, action: true, entityType: true, entityId: true, createdAt: true },
            orderBy: { createdAt: "desc" },
            take: 25,
          },
          enrollmentAssignments: {
            select: { id: true, payerName: true, status: true },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const completedTaskCount = await ctx.db.task.count({
        where: { assignedToId: input.id, status: "COMPLETED" },
      });

      return { ...user, completedTaskCount };
    }),

  // ─── List users ────────────────────────────────────────────────────────
  listUsers: managerProcedure
    .input(
      z.object({
        role: z.string().optional(),
        isActive: z.boolean().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.role && { role: input.role as UserRole }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.search && {
          OR: [
            { displayName: { contains: input.search, mode: "insensitive" as const } },
            { email: { contains: input.search, mode: "insensitive" as const } },
          ],
        }),
      };

      const [total, users] = await Promise.all([
        ctx.db.user.count({ where }),
        ctx.db.user.findMany({
          where,
          select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            isActive: true,
            lastLoginAt: true,
            createdAt: true,
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { users, total };
    }),

  // ─── Create staff user ─────────────────────────────────────────────────
  createUser: adminProcedure
    .input(
      z.object({
        email: z.string().email(),
        displayName: z.string().min(1),
        role: z.enum(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.user.findUnique({ where: { email: input.email } });
      if (existing) {
        throw new TRPCError({ code: "CONFLICT", message: "User with this email already exists" });
      }

      const user = await ctx.db.user.create({
        data: {
          email: input.email,
          displayName: input.displayName,
          role: input.role as UserRole,
          isActive: true,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "user.created",
        entityType: "User",
        entityId: user.id,
        afterState: { email: input.email, role: input.role },
      });

      return user;
    }),

  // ─── Update user ───────────────────────────────────────────────────────
  updateUser: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        email: z.string().email().optional(),
        displayName: z.string().optional(),
        role: z.enum(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.user.findUnique({ where: { id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      if (input.email && input.email !== before.email) {
        const dup = await ctx.db.user.findUnique({ where: { email: input.email } });
        if (dup) throw new TRPCError({ code: "CONFLICT", message: "Another user already has this email address" });
      }

      const updated = await ctx.db.user.update({ where: { id }, data: rest });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "user.updated",
        entityType: "User",
        entityId: id,
        beforeState: { email: before.email, displayName: before.displayName, role: before.role, isActive: before.isActive },
        afterState: { email: updated.email, displayName: updated.displayName, role: updated.role, isActive: updated.isActive },
      });

      return updated;
    }),

  // ─── Deactivate user ───────────────────────────────────────────────────
  deactivateUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session!.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot deactivate your own account" });
      }

      await ctx.db.user.update({ where: { id: input.id }, data: { isActive: false } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "user.deactivated",
        entityType: "User",
        entityId: input.id,
      });

      return { success: true };
    }),

  // ─── Delete user (hard delete) ─────────────────────────────────────────
  deleteUser: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (input.id === ctx.session!.user.id) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete your own account" });
      }

      const user = await ctx.db.user.findUnique({
        where: { id: input.id },
        include: {
          assignedProviders: { select: { id: true } },
          assignedTasks: { where: { status: { not: "COMPLETED" } }, select: { id: true } },
          enrollmentAssignments: { where: { status: { notIn: ["ENROLLED", "DENIED", "WITHDRAWN"] } }, select: { id: true } },
        },
      });

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

      const blockers: string[] = [];
      if (user.assignedProviders.length > 0) {
        blockers.push(`${user.assignedProviders.length} assigned provider(s)`);
      }
      if (user.assignedTasks.length > 0) {
        blockers.push(`${user.assignedTasks.length} open task(s)`);
      }
      if (user.enrollmentAssignments.length > 0) {
        blockers.push(`${user.enrollmentAssignments.length} active enrollment(s)`);
      }

      if (blockers.length > 0) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Cannot delete user. Reassign the following first: ${blockers.join(", ")}.`,
        });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "user.deleted",
        entityType: "User",
        entityId: input.id,
        beforeState: { email: user.email, displayName: user.displayName, role: user.role },
      });

      await ctx.db.user.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ─── List provider types ───────────────────────────────────────────────
  listProviderTypes: managerProcedure
    .query(async ({ ctx }) => {
      return ctx.db.providerType.findMany({
        include: { documentRequirements: true },
        orderBy: { name: "asc" },
      });
    }),

  // ─── Create provider type ──────────────────────────────────────────────
  createProviderType: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        abbreviation: z.string().min(1),
        requiresEcfmg: z.boolean().default(false),
        requiresDea: z.boolean().default(false),
        requiresBoards: z.boolean().default(false),
        boardType: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const pt = await ctx.db.providerType.create({ data: { ...input, isActive: true } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "providertype.created",
        entityType: "ProviderType",
        entityId: pt.id,
        afterState: { name: input.name, abbreviation: input.abbreviation },
      });

      return pt;
    }),

  // ─── Update provider type ──────────────────────────────────────────────
  updateProviderType: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        isActive: z.boolean().optional(),
        requiresEcfmg: z.boolean().optional(),
        requiresDea: z.boolean().optional(),
        requiresBoards: z.boolean().optional(),
        boardType: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const updated = await ctx.db.providerType.update({ where: { id }, data: rest });
      return updated;
    }),

  // ─── Set document requirement ──────────────────────────────────────────
  setDocumentRequirement: adminProcedure
    .input(
      z.object({
        providerTypeId: z.string().uuid(),
        documentType: z.string(),
        requirement: z.enum(["REQUIRED", "CONDITIONAL", "NOT_APPLICABLE"]),
        conditionDescription: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { DocumentType, RequirementType } = await import("@prisma/client");

      const req = await ctx.db.documentRequirement.upsert({
        where: {
          providerTypeId_documentType: {
            providerTypeId: input.providerTypeId,
            documentType: input.documentType as (typeof DocumentType)[keyof typeof DocumentType],
          },
        },
        update: {
          requirement: input.requirement as (typeof RequirementType)[keyof typeof RequirementType],
          conditionDescription: input.conditionDescription ?? null,
        },
        create: {
          providerTypeId: input.providerTypeId,
          documentType: input.documentType as (typeof DocumentType)[keyof typeof DocumentType],
          requirement: input.requirement as (typeof RequirementType)[keyof typeof RequirementType],
          conditionDescription: input.conditionDescription ?? null,
        },
      });

      return req;
    }),

  // ─── Get system stats ──────────────────────────────────────────────────
  getStats: managerProcedure
    .query(async ({ ctx }) => {
      const [
        totalProviders,
        activeProviders,
        pendingCommittee,
        openTasks,
        pendingEnrollments,
        expiredExpirables,
      ] = await Promise.all([
        ctx.db.provider.count(),
        ctx.db.provider.count({ where: { status: "APPROVED" } }),
        ctx.db.provider.count({ where: { status: { in: ["COMMITTEE_READY", "COMMITTEE_IN_REVIEW"] } } }),
        ctx.db.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
        ctx.db.enrollment.count({ where: { status: { in: ["SUBMITTED", "PENDING_PAYER"] } } }),
        ctx.db.expirable.count({ where: { status: "EXPIRED" } }),
      ]);

      return {
        totalProviders,
        activeProviders,
        pendingCommittee,
        openTasks,
        pendingEnrollments,
        expiredExpirables,
      };
    }),

  // ─── List app settings ─────────────────────────────────────────────────
  listSettings: managerProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db.appSetting.findMany({
          where: input?.category ? { category: input.category } : undefined,
          orderBy: [{ category: "asc" }, { key: "asc" }],
        });
      } catch {
        return [];
      }
    }),

  // ─── Upsert app setting ───────────────────────────────────────────────
  upsertSetting: adminProcedure
    .input(
      z.object({
        key: z.string().min(1),
        value: z.string(),
        description: z.string().optional(),
        category: z.string().default("general"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const setting = await ctx.db.appSetting.upsert({
          where: { key: input.key },
          update: { value: input.value, description: input.description, category: input.category, updatedBy: ctx.session!.user.id },
          create: { key: input.key, value: input.value, description: input.description, category: input.category, updatedBy: ctx.session!.user.id },
        });

        await writeAuditLog({
          actorId: ctx.session!.user.id,
          actorRole: ctx.session!.user.role,
          action: "setting.updated",
          entityType: "AppSetting",
          entityId: setting.id,
          afterState: { key: input.key, value: input.value },
        });

        return setting;
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Settings table not available. Please run database migrations." });
      }
    }),

  // ─── Delete app setting ───────────────────────────────────────────────
  deleteSetting: adminProcedure
    .input(z.object({ key: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await ctx.db.appSetting.delete({ where: { key: input.key } });
        return { success: true };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Settings table not available. Please run database migrations." });
      }
    }),

  // ═══════════════════════════════════════════════════════════════════════
  // ─── Workflow Endpoints ─────────────────────────────────────────────
  // ═══════════════════════════════════════════════════════════════════════

  listWorkflows: managerProcedure
    .input(z.object({ category: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        return await ctx.db.workflow.findMany({
          where: input?.category ? { category: input.category } : undefined,
          select: {
            id: true,
            name: true,
            description: true,
            category: true,
            thumbnail: true,
            isPublished: true,
            createdBy: true,
            updatedAt: true,
            creator: { select: { displayName: true } },
          },
          orderBy: [{ category: "asc" }, { name: "asc" }],
        });
      } catch {
        return [];
      }
    }),

  getWorkflow: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findUnique({
        where: { id: input.id },
        include: { creator: { select: { displayName: true } } },
      });
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });
      return workflow;
    }),

  createWorkflow: adminProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().default("general"),
        sceneData: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const defaultScene = { elements: [], appState: { viewBackgroundColor: "#ffffff" }, files: {} };
      const workflow = await ctx.db.workflow.create({
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          sceneData: input.sceneData ?? defaultScene,
          createdBy: ctx.session!.user.id,
          updatedBy: ctx.session!.user.id,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "workflow.created",
        entityType: "Workflow",
        entityId: workflow.id,
        afterState: { name: input.name, category: input.category },
      });

      return workflow;
    }),

  saveWorkflow: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        sceneData: z.any().optional(),
        isPublished: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const workflow = await ctx.db.workflow.update({
        where: { id },
        data: {
          ...data,
          updatedBy: ctx.session!.user.id,
        },
      });
      return workflow;
    }),

  deleteWorkflow: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const workflow = await ctx.db.workflow.findUnique({ where: { id: input.id } });
      if (!workflow) throw new TRPCError({ code: "NOT_FOUND", message: "Workflow not found" });

      await ctx.db.workflow.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "workflow.deleted",
        entityType: "Workflow",
        entityId: input.id,
        afterState: { name: workflow.name },
      });

      return { success: true };
    }),
});
