/**
 * Document router — upload, list, delete, OCR trigger, checklist management.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { DocumentType } from "@prisma/client";

export const documentRouter = createTRPCRouter({
  // ─── List documents for a provider ────────────────────────────────────
  listByProvider: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        documentType: z.string().optional(),
        includeDeleted: z.boolean().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      return ctx.db.document.findMany({
        where: {
          providerId: input.providerId,
          ...(input.documentType && { documentType: input.documentType as DocumentType }),
          ...(input.includeDeleted ? {} : { isDeleted: false }),
        },
        include: {
          uploadedBy: { select: { id: true, displayName: true, role: true } },
          verificationRecord: true,
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ─── Get document by ID ────────────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findUnique({
        where: { id: input.id },
        include: {
          uploadedBy: { select: { id: true, displayName: true } },
          verificationRecord: true,
        },
      });

      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      return doc;
    }),

  // ─── Soft delete document ──────────────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid(), reason: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findUnique({ where: { id: input.id } });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.document.update({
        where: { id: input.id },
        data: { isDeleted: true, updatedAt: new Date() },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "document.deleted",
        entityType: "Document",
        entityId: input.id,
        providerId: doc.providerId,
        metadata: { reason: input.reason },
      });

      return { success: true };
    }),

  // ─── Trigger OCR ───────────────────────────────────────────────────────
  triggerOcr: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.findUnique({ where: { id: input.id } });
      if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
      if (doc.ocrStatus === "PROCESSING") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "OCR already in progress" });
      }

      await ctx.db.document.update({
        where: { id: input.id },
        data: { ocrStatus: "PENDING" },
      });

      // In a real implementation, this would enqueue an OCR job
      // For now, mark as pending (worker will pick it up)
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "document.ocr.triggered",
        entityType: "Document",
        entityId: input.id,
        providerId: doc.providerId,
      });

      return { success: true };
    }),

  // ─── Get checklist for a provider ─────────────────────────────────────
  getChecklist: protectedProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
        include: {
          providerType: {
            include: { documentRequirements: true },
          },
          checklistItems: {
            include: { document: true },
          },
        },
      });

      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      return {
        requirements: provider.providerType.documentRequirements,
        items: provider.checklistItems,
      };
    }),

  // ─── Update checklist item ─────────────────────────────────────────────
  updateChecklistItem: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["RECEIVED", "PENDING", "NEEDS_ATTENTION"]),
        flagReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.checklistItem.findUnique({ where: { id: input.id } });
      if (!item) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.checklistItem.update({
        where: { id: input.id },
        data: {
          status: input.status,
          manuallyFlagged: input.status === "NEEDS_ATTENTION",
          flagReason: input.flagReason ?? null,
          flaggedById: input.status === "NEEDS_ATTENTION" ? ctx.session!.user.id : null,
          receivedAt: input.status === "RECEIVED" ? new Date() : undefined,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "checklist.item.updated",
        entityType: "ChecklistItem",
        entityId: input.id,
        providerId: item.providerId,
        beforeState: { status: item.status },
        afterState: { status: input.status },
      });

      return updated;
    }),

  // ─── Create document record (after upload via /api/upload) ───────────
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      const doc = await ctx.db.document.create({
        data: {
          providerId: input.providerId,
          documentType: input.documentType as DocumentType,
          originalFilename: input.originalFilename,
          blobUrl: input.blobUrl,
          blobContainer: input.blobContainer,
          blobPath: input.blobPath,
          fileSizeBytes: input.fileSizeBytes,
          mimeType: input.mimeType,
          uploadedById: ctx.session!.user.id,
          source: input.source,
          ocrStatus: "PENDING",
        },
      });

      // Update checklist item if exists
      const checklistItem = await ctx.db.checklistItem.findFirst({
        where: {
          providerId: input.providerId,
          documentType: input.documentType as DocumentType,
        },
      });

      if (checklistItem) {
        await ctx.db.checklistItem.update({
          where: { id: checklistItem.id },
          data: {
            status: "RECEIVED",
            documentId: doc.id,
            receivedAt: new Date(),
          },
        });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "document.uploaded",
        entityType: "Document",
        entityId: doc.id,
        providerId: input.providerId,
        afterState: {
          documentType: input.documentType,
          filename: input.originalFilename,
          source: input.source,
        },
      });

      return doc;
    }),
});
