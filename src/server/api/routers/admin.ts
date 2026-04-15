/**
 * Admin router — user management, provider type config, system settings.
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { UserRole } from "@prisma/client";

export const adminRouter = createTRPCRouter({
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
        displayName: z.string().optional(),
        role: z.enum(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"]).optional(),
        isActive: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...rest } = input;
      const before = await ctx.db.user.findUnique({ where: { id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.user.update({ where: { id }, data: rest });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "user.updated",
        entityType: "User",
        entityId: id,
        beforeState: { role: before.role, isActive: before.isActive },
        afterState: { role: updated.role, isActive: updated.isActive },
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
});
