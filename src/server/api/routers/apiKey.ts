/**
 * API Key router — public REST API key management (Phase 4).
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import { createHash, randomBytes } from "crypto";

export const apiKeyRouter = createTRPCRouter({
  // ─── List all API keys ──────────────────────────────────────────────
  list: adminProcedure
    .query(async ({ ctx }) => {
      return ctx.db.apiKey.findMany({
        select: {
          id: true,
          name: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
          expiresAt: true,
          permissions: true,
          createdBy: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ─── Create API key ─────────────────────────────────────────────────
  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200),
        permissions: z.record(z.boolean()).default({}),
        expiresAt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const rawKey = randomBytes(32).toString("hex");
      const plainKey = `essen_${rawKey}`;
      const keyHash = createHash("sha256").update(plainKey).digest("hex");

      const apiKey = await ctx.db.apiKey.create({
        data: {
          name: input.name,
          keyHash,
          permissions: input.permissions,
          createdBy: ctx.session!.user.id,
          expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "apikey.created",
        entityType: "ApiKey",
        entityId: apiKey.id,
        afterState: { name: input.name, permissions: input.permissions },
      });

      return {
        id: apiKey.id,
        name: apiKey.name,
        key: plainKey,
        createdAt: apiKey.createdAt,
        expiresAt: apiKey.expiresAt,
      };
    }),

  // ─── Revoke API key ─────────────────────────────────────────────────
  revoke: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.apiKey.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });

      const updated = await ctx.db.apiKey.update({
        where: { id: input.id },
        data: { isActive: false },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "apikey.revoked",
        entityType: "ApiKey",
        entityId: input.id,
        beforeState: { isActive: true },
        afterState: { isActive: false },
      });

      return updated;
    }),

  // ─── Delete API key ─────────────────────────────────────────────────
  delete: adminProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.apiKey.findUnique({
        where: { id: input.id },
        select: { id: true, name: true },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "API key not found" });

      await ctx.db.apiKey.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "apikey.deleted",
        entityType: "ApiKey",
        entityId: input.id,
        beforeState: { name: existing.name },
      });

      return { success: true };
    }),
});
