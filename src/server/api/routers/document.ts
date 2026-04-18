/**
 * Document router — thin pass-through to DocumentService.
 *
 * Wave 2.1 service-layer extraction: every business rule, audit-log write,
 * and Prisma call lives in `src/server/services/document.ts`. This file
 * exists to (a) define zod input schemas and (b) wire role-gated
 * procedures.
 *
 * Anti-weakening rule: do NOT inline Prisma calls back into this file.
 * If you need new behavior, add a method to DocumentService.
 */
import { z } from "zod";
import { createTRPCRouter, staffProcedure, protectedProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { DocumentService } from "@/server/services/document";

/**
 * Build a per-request DocumentService bound to the calling actor. We
 * construct it inside each procedure rather than once at module load so
 * the actor identity is tied to this specific request.
 */
function svc(ctx: { db: import("@prisma/client").PrismaClient; session: { user: { id: string; role: string } } | null }): DocumentService {
  return new DocumentService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
  });
}

export const documentRouter = createTRPCRouter({
  listByProvider: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        documentType: z.string().optional(),
        includeDeleted: z.boolean().default(false),
      }),
    )
    .query(({ ctx, input }) => svc(ctx).listByProvider(input)),

  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getById(input.id)),

  delete: staffProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().optional() }))
    .mutation(({ ctx, input }) => svc(ctx).softDelete(input.id, input.reason)),

  triggerOcr: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).triggerOcr(input.id)),

  getChecklist: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).getChecklist(input.providerId)),

  updateChecklistItem: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["RECEIVED", "PENDING", "NEEDS_ATTENTION"]),
        flagReason: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).updateChecklistItem(input)),

  createRecord: protectedProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        documentType: z.string(),
        originalFilename: z.string(),
        blobUrl: z.string().url(),
        blobContainer: z.string(),
        blobPath: z.string(),
        fileSizeBytes: z.number(),
        mimeType: z.string(),
        source: z.enum(["PROVIDER_UPLOAD", "HR_INGESTION", "EMAIL_INGESTION", "BOT_OUTPUT"]),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).createRecord(input)),
});
