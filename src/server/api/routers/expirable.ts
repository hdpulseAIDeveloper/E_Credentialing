/**
 * Expirables router — list, update, renewal tracking.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { ExpirableStatus, ExpirableType } from "@prisma/client";

export const expirableRouter = createTRPCRouter({
  // ─── List expirables ───────────────────────────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        status: z.string().optional(),
        expirableType: z.string().optional(),
        expiringWithinDays: z.number().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};

      if (input.providerId) where.providerId = input.providerId;
      if (input.status) where.status = input.status as ExpirableStatus;
      if (input.expirableType) where.expirableType = input.expirableType as ExpirableType;
      if (input.expiringWithinDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + input.expiringWithinDays);
        where.expirationDate = { lte: cutoff };
      }

      const [total, expirables] = await Promise.all([
        ctx.db.expirable.count({ where }),
        ctx.db.expirable.findMany({
          where,
          include: {
            provider: {
              select: { id: true, legalFirstName: true, legalLastName: true, providerType: true },
            },
            document: { select: { id: true, originalFilename: true, blobUrl: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { expirationDate: "asc" },
        }),
      ]);

      return { expirables, total };
    }),

  // ─── Get by provider ───────────────────────────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.expirable.findMany({
        where: { providerId: input.providerId },
        include: { document: true },
        orderBy: { expirationDate: "asc" },
      });
    }),

  // ─── Create expirable ─────────────────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        expirableType: z.string(),
        expirationDate: z.string(),
        documentId: z.string().uuid().optional(),
        renewalCadenceDays: z.number().min(1).default(365),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expirationDate = new Date(input.expirationDate);
      const nextCheckDate = new Date(expirationDate);
      nextCheckDate.setDate(nextCheckDate.getDate() - 90); // Check 90 days before expiry

      const expirable = await ctx.db.expirable.create({
        data: {
          providerId: input.providerId,
          expirableType: input.expirableType as ExpirableType,
          expirationDate,
          nextCheckDate,
          renewalCadenceDays: input.renewalCadenceDays,
          documentId: input.documentId,
          status: "CURRENT",
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "expirable.created",
        entityType: "Expirable",
        entityId: expirable.id,
        providerId: input.providerId,
        afterState: { expirableType: input.expirableType, expirationDate: input.expirationDate },
      });

      return expirable;
    }),

  // ─── Update expirable ─────────────────────────────────────────────────
  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.string().optional(),
        expirationDate: z.string().optional(),
        newExpirationDate: z.string().optional(),
        renewalConfirmedDate: z.string().optional(),
        documentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.expirable.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.expirable.update({
        where: { id: input.id },
        data: {
          ...(input.status && { status: input.status as ExpirableStatus }),
          ...(input.expirationDate && { expirationDate: new Date(input.expirationDate) }),
          ...(input.newExpirationDate && { newExpirationDate: new Date(input.newExpirationDate) }),
          ...(input.renewalConfirmedDate && { renewalConfirmedDate: new Date(input.renewalConfirmedDate) }),
          ...(input.documentId && { documentId: input.documentId }),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "expirable.updated",
        entityType: "Expirable",
        entityId: input.id,
        providerId: before.providerId,
        beforeState: { status: before.status, expirationDate: before.expirationDate },
        afterState: { status: updated.status, expirationDate: updated.expirationDate },
      });

      return updated;
    }),

  // ─── Get upcoming expirations summary ────────────────────────────────
  getSummary: staffProcedure
    .query(async ({ ctx }) => {
      const now = new Date();
      const in7 = new Date(); in7.setDate(now.getDate() + 7);
      const in30 = new Date(); in30.setDate(now.getDate() + 30);
      const in60 = new Date(); in60.setDate(now.getDate() + 60);
      const in90 = new Date(); in90.setDate(now.getDate() + 90);

      const [expired, in7Days, in30Days, in60Days, in90Days] = await Promise.all([
        ctx.db.expirable.count({ where: { expirationDate: { lt: now }, status: { not: "RENEWED" } } }),
        ctx.db.expirable.count({ where: { expirationDate: { gte: now, lte: in7 }, status: { not: "RENEWED" } } }),
        ctx.db.expirable.count({ where: { expirationDate: { gte: in7, lte: in30 }, status: { not: "RENEWED" } } }),
        ctx.db.expirable.count({ where: { expirationDate: { gte: in30, lte: in60 }, status: { not: "RENEWED" } } }),
        ctx.db.expirable.count({ where: { expirationDate: { gte: in60, lte: in90 }, status: { not: "RENEWED" } } }),
      ]);

      return { expired, in7Days, in30Days, in60Days, in90Days };
    }),

  // ─── Delete expirable ─────────────────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const expirable = await ctx.db.expirable.findUnique({
        where: { id: input.id },
        select: { id: true, providerId: true, expirableType: true, status: true },
      });
      if (!expirable) throw new TRPCError({ code: "NOT_FOUND", message: "Expirable not found" });

      await ctx.db.expirable.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "expirable.deleted",
        entityType: "Expirable",
        entityId: input.id,
        providerId: expirable.providerId,
        beforeState: { type: expirable.expirableType, status: expirable.status },
      });

      return { success: true };
    }),
});
