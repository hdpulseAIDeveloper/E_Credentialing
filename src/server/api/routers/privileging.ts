/**
 * Privileging router — privilege delineation library (categories & items).
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";

export const privilegingRouter = createTRPCRouter({
  // ─── List categories with privilege counts ─────────────────────────
  listCategories: staffProcedure
    .query(async ({ ctx }) => {
      return ctx.db.privilegeCategory.findMany({
        include: {
          _count: { select: { privileges: true } },
        },
        orderBy: { name: "asc" },
      });
    }),

  // ─── Get category by ID with all items ─────────────────────────────
  getCategory: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const category = await ctx.db.privilegeCategory.findUnique({
        where: { id: input.id },
        include: {
          privileges: { orderBy: { name: "asc" } },
        },
      });

      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      return category;
    }),

  // ─── Create category ───────────────────────────────────────────────
  createCategory: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        specialty: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.privilegeCategory.findUnique({
        where: { name: input.name },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A category with this name already exists",
        });
      }

      return ctx.db.privilegeCategory.create({
        data: {
          name: input.name,
          specialty: input.specialty,
        },
      });
    }),

  // ─── Update category ───────────────────────────────────────────────
  updateCategory: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(200).optional(),
        specialty: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.privilegeCategory.findUnique({ where: { id: input.id } });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      if (input.name && input.name !== category.name) {
        const duplicate = await ctx.db.privilegeCategory.findUnique({
          where: { name: input.name },
        });
        if (duplicate) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A category with this name already exists",
          });
        }
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.specialty !== undefined) data.specialty = input.specialty;

      return ctx.db.privilegeCategory.update({
        where: { id: input.id },
        data,
      });
    }),

  // ─── Delete category (cascades items) ──────────────────────────────
  deleteCategory: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.privilegeCategory.findUnique({ where: { id: input.id } });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      await ctx.db.privilegeItem.deleteMany({ where: { categoryId: input.id } });
      await ctx.db.privilegeCategory.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ─── Create privilege item ─────────────────────────────────────────
  createItem: adminProcedure
    .input(
      z.object({
        categoryId: z.string().uuid(),
        name: z.string().min(1).max(300),
        cptCodes: z.array(z.string()).default([]),
        icd10Codes: z.array(z.string()).default([]),
        requiresFppe: z.boolean().default(false),
        isCore: z.boolean().default(true),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.db.privilegeCategory.findUnique({
        where: { id: input.categoryId },
      });
      if (!category) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Category not found" });
      }

      return ctx.db.privilegeItem.create({
        data: {
          categoryId: input.categoryId,
          name: input.name,
          cptCodes: input.cptCodes,
          icd10Codes: input.icd10Codes,
          requiresFppe: input.requiresFppe,
          isCore: input.isCore,
        },
      });
    }),

  // ─── Update privilege item ─────────────────────────────────────────
  updateItem: adminProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).max(300).optional(),
        cptCodes: z.array(z.string()).optional(),
        icd10Codes: z.array(z.string()).optional(),
        requiresFppe: z.boolean().optional(),
        isCore: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.privilegeItem.findUnique({ where: { id: input.id } });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Privilege item not found" });
      }

      const data: Record<string, unknown> = {};
      if (input.name !== undefined) data.name = input.name;
      if (input.cptCodes !== undefined) data.cptCodes = input.cptCodes;
      if (input.icd10Codes !== undefined) data.icd10Codes = input.icd10Codes;
      if (input.requiresFppe !== undefined) data.requiresFppe = input.requiresFppe;
      if (input.isCore !== undefined) data.isCore = input.isCore;

      return ctx.db.privilegeItem.update({
        where: { id: input.id },
        data,
      });
    }),

  // ─── Delete privilege item ─────────────────────────────────────────
  deleteItem: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.privilegeItem.findUnique({ where: { id: input.id } });
      if (!item) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Privilege item not found" });
      }

      await ctx.db.privilegeItem.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ─── Search items by name or CPT code ──────────────────────────────
  search: staffProcedure
    .input(z.object({ query: z.string().min(1).max(100) }))
    .query(async ({ ctx, input }) => {
      const q = input.query.trim();

      return ctx.db.privilegeItem.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { cptCodes: { has: q } },
          ],
        },
        include: {
          category: { select: { id: true, name: true, specialty: true } },
        },
        take: 50,
        orderBy: { name: "asc" },
      });
    }),
});
