/**
 * API Key router — public REST API key management (Phase 4).
 */

import { z } from "zod";
import { createTRPCRouter, adminProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import { createHash, randomBytes } from "crypto";
import { API_SCOPES, type ApiScope } from "@/app/api/v1/middleware";

/**
 * Scope validator — rejects creation if the client hands us a scope that
 * isn't in the registry. This is the single source of truth: docs/api/authentication.md,
 * the UI, and every route use this same list.
 */
const permissionsSchema = z
  .record(z.boolean())
  .refine(
    (perms) => Object.keys(perms).every((k) => (API_SCOPES as readonly string[]).includes(k)),
    {
      message: `Unknown scope. Allowed: ${API_SCOPES.join(", ")}`,
    },
  );

export const apiKeyRouter = createTRPCRouter({
  // Exposed for the UI so the scope list matches the runtime registry.
  availableScopes: adminProcedure.query((): readonly ApiScope[] => API_SCOPES),

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
        permissions: permissionsSchema.default({}),
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
