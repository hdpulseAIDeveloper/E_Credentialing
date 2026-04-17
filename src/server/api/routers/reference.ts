/**
 * Professional Reference router — create, send, remind, and receive reference responses.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, publicProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { ReferenceRequestStatus } from "@prisma/client";
import { sendReferenceEmail, tryEmail } from "@/lib/email/verifications";

export const referenceRouter = createTRPCRouter({
  // ─── List references for a provider ─────────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.professionalReference.findMany({
        where: { providerId: input.providerId },
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ─── Create a reference request ─────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        referenceName: z.string().min(1),
        referenceTitle: z.string().optional(),
        referenceEmail: z.string().email(),
        referencePhone: z.string().optional(),
        relationship: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
      });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      const record = await ctx.db.professionalReference.create({
        data: {
          providerId: input.providerId,
          referenceName: input.referenceName,
          referenceTitle: input.referenceTitle,
          referenceEmail: input.referenceEmail,
          referencePhone: input.referencePhone,
          relationship: input.relationship,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "reference.request.created",
        entityType: "ProfessionalReference",
        entityId: record.id,
        providerId: input.providerId,
        afterState: {
          referenceName: input.referenceName,
          referenceEmail: input.referenceEmail,
          relationship: input.relationship,
        },
      });

      return record;
    }),

  // ─── Mark reference as SENT (also fires SendGrid outreach) ──────────
  // P0 Gap #2: previously this only flipped status; now it actually emails
  // the reference using the token-bound response URL.
  sendRequest: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.professionalReference.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            select: { legalFirstName: true, legalLastName: true },
          },
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const providerName =
        `${existing.provider.legalFirstName} ${existing.provider.legalLastName}`.trim();

      const result = await tryEmail(() =>
        sendReferenceEmail({
          to: existing.referenceEmail,
          referenceName: existing.referenceName,
          providerName,
          responseToken: existing.responseToken,
          relationship: existing.relationship,
        })
      );

      const updated = await ctx.db.professionalReference.update({
        where: { id: input.id },
        data: {
          status: "SENT" satisfies ReferenceRequestStatus,
          requestSentAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "reference.request.sent",
        entityType: "ProfessionalReference",
        entityId: input.id,
        providerId: existing.providerId,
        afterState: {
          to: existing.referenceEmail,
          delivered: result.delivered,
          messageId: result.messageId,
          reason: result.reason ?? null,
        },
      });

      return { ...updated, emailDelivered: result.delivered, emailReason: result.reason };
    }),

  // ─── Send reminder (also fires SendGrid outreach) ───────────────────
  sendReminder: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.professionalReference.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            select: { legalFirstName: true, legalLastName: true },
          },
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const providerName =
        `${existing.provider.legalFirstName} ${existing.provider.legalLastName}`.trim();

      const result = await tryEmail(() =>
        sendReferenceEmail({
          to: existing.referenceEmail,
          referenceName: existing.referenceName,
          providerName,
          responseToken: existing.responseToken,
          isReminder: true,
          relationship: existing.relationship,
        })
      );

      const updated = await ctx.db.professionalReference.update({
        where: { id: input.id },
        data: {
          status: "REMINDER_SENT" satisfies ReferenceRequestStatus,
          lastReminderAt: new Date(),
          reminderCount: { increment: 1 },
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "reference.reminder.sent",
        entityType: "ProfessionalReference",
        entityId: input.id,
        providerId: existing.providerId,
        afterState: {
          to: existing.referenceEmail,
          delivered: result.delivered,
          messageId: result.messageId,
          reason: result.reason ?? null,
        },
      });

      return { ...updated, emailDelivered: result.delivered, emailReason: result.reason };
    }),

  // ─── Public: reference person submits their response ────────────────
  submitResponse: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        rating: z.number().int().min(1).max(5),
        clinicalCompetence: z.number().int().min(1).max(5),
        professionalism: z.number().int().min(1).max(5),
        recommendation: z.enum([
          "highly_recommend",
          "recommend",
          "do_not_recommend",
        ]),
        comments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.professionalReference.findUnique({
        where: { responseToken: input.token },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired reference link.",
        });
      }
      if (existing.status === ("RECEIVED" satisfies ReferenceRequestStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This reference has already been submitted.",
        });
      }

      const { token, ...responseFields } = input;

      const updated = await ctx.db.professionalReference.update({
        where: { responseToken: token },
        data: {
          status: "RECEIVED" satisfies ReferenceRequestStatus,
          receivedAt: new Date(),
          responseData: responseFields as unknown as import("@prisma/client").Prisma.InputJsonValue,
        },
      });

      await writeAuditLog({
        actorId: null,
        actorRole: null,
        action: "reference.response.submitted",
        entityType: "ProfessionalReference",
        entityId: existing.id,
        providerId: existing.providerId,
      });

      return { success: true, id: updated.id };
    }),

  // ─── Delete reference ───────────────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.professionalReference.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.professionalReference.delete({
        where: { id: input.id },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "reference.request.deleted",
        entityType: "ProfessionalReference",
        entityId: input.id,
        providerId: existing.providerId,
        beforeState: {
          referenceName: existing.referenceName,
          status: existing.status,
        },
      });

      return { success: true };
    }),
});
