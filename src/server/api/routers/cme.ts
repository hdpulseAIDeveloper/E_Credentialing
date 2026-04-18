/**
 * CME router — thin pass-through to CmeService.
 *
 * Wave 3.2 service-layer extraction. All business logic, validation, and
 * audit-log writes live in `src/server/services/cme.ts`. The PDF + markdown
 * + text renderers live in `src/lib/cv/*` and are composed by the service.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { writeAuditLog } from "@/lib/audit";
import { CmeService } from "@/server/services/cme";

function svc(ctx: {
  db: import("@prisma/client").PrismaClient;
  session: { user: { id: string; role: string } } | null;
}): CmeService {
  return new CmeService({
    db: ctx.db,
    audit: writeAuditLog,
    actor: { id: ctx.session!.user.id, role: ctx.session!.user.role },
  });
}

export const cmeRouter = createTRPCRouter({
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) => svc(ctx).listByProvider(input.providerId)),

  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        activityName: z.string().min(1),
        category: z.string().default("Category 1"),
        credits: z.number().positive(),
        completedDate: z.string(),
        documentId: z.string().uuid().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).create(input)),

  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        activityName: z.string().min(1).optional(),
        category: z.string().optional(),
        credits: z.number().positive().optional(),
        completedDate: z.string().optional(),
        documentId: z.string().uuid().nullable().optional(),
      }),
    )
    .mutation(({ ctx, input }) => svc(ctx).update(input)),

  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(({ ctx, input }) => svc(ctx).delete(input.id)),

  getSummary: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        requirement: z.number().positive().optional(),
      }),
    )
    .query(({ ctx, input }) =>
      svc(ctx).getSummary(input.providerId, { requirement: input.requirement }),
    ),

  /**
   * Plain-text CV. Preserves the legacy `generateCv` contract so existing
   * callers (legacy email templates, the staff "view as text" preview) keep
   * working unchanged.
   */
  generateCv: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      svc(ctx).renderProviderCvText(input.providerId),
    ),

  /** Markdown CV — used by the in-app "preview" tab. */
  generateCvMarkdown: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      svc(ctx).renderProviderCvMarkdown(input.providerId),
    ),

  /**
   * PDF CV as base64. Used by clients that prefer to call tRPC over a raw
   * fetch; also useful in tests (no Buffer→Uint8Array dance over the wire).
   * Browsers should prefer the dedicated `/api/internal/providers/[id]/cv.pdf`
   * route which streams `application/pdf` directly.
   */
  generateCvPdfBase64: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const bytes = await svc(ctx).renderProviderCvPdf(input.providerId);
      return Buffer.from(bytes).toString("base64");
    }),
});
