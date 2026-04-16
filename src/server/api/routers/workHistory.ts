/**
 * Work History Verification router — create, send, remind, and receive employer verifications.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, publicProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { ReferenceRequestStatus } from "@prisma/client";

export const workHistoryRouter = createTRPCRouter({
  // ─── List work history verifications for a provider ─────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.workHistoryVerification.findMany({
        where: { providerId: input.providerId },
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  // ─── Create a work history verification request ─────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        employerName: z.string().min(1),
        employerEmail: z.string().email().optional(),
        employerPhone: z.string().optional(),
        contactName: z.string().optional(),
        position: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
      });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      const record = await ctx.db.workHistoryVerification.create({
        data: {
          providerId: input.providerId,
          employerName: input.employerName,
          employerEmail: input.employerEmail,
          employerPhone: input.employerPhone,
          contactName: input.contactName,
          position: input.position,
          startDate: input.startDate,
          endDate: input.endDate,
          notes: input.notes,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "workHistory.verification.created",
        entityType: "WorkHistoryVerification",
        entityId: record.id,
        providerId: input.providerId,
        afterState: {
          employerName: input.employerName,
          contactName: input.contactName,
          position: input.position,
        },
      });

      return record;
    }),

  // ─── Mark verification as SENT ──────────────────────────────────────
  sendRequest: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workHistoryVerification.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.workHistoryVerification.update({
        where: { id: input.id },
        data: {
          status: "SENT" satisfies ReferenceRequestStatus,
          requestSentAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "workHistory.verification.sent",
        entityType: "WorkHistoryVerification",
        entityId: input.id,
        providerId: existing.providerId,
      });

      return updated;
    }),

  // ─── Send reminder ──────────────────────────────────────────────────
  sendReminder: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workHistoryVerification.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.workHistoryVerification.update({
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
        action: "workHistory.reminder.sent",
        entityType: "WorkHistoryVerification",
        entityId: input.id,
        providerId: existing.providerId,
      });

      return updated;
    }),

  // ─── Public: employer submits verification response ─────────────────
  submitResponse: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        verified: z.boolean(),
        employerConfirmedName: z.string().optional(),
        employerConfirmedPosition: z.string().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
        additionalComments: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workHistoryVerification.findUnique({
        where: { responseToken: input.token },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired verification link.",
        });
      }
      if (existing.status === ("RECEIVED" satisfies ReferenceRequestStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This verification has already been submitted.",
        });
      }

      const { token, ...responseFields } = input;

      const updated = await ctx.db.workHistoryVerification.update({
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
        action: "workHistory.response.submitted",
        entityType: "WorkHistoryVerification",
        entityId: existing.id,
        providerId: existing.providerId,
      });

      return { success: true, id: updated.id };
    }),

  // ─── Delete verification ────────────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.workHistoryVerification.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.workHistoryVerification.delete({
        where: { id: input.id },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "workHistory.verification.deleted",
        entityType: "WorkHistoryVerification",
        entityId: input.id,
        providerId: existing.providerId,
        beforeState: {
          employerName: existing.employerName,
          status: existing.status,
        },
      });

      return { success: true };
    }),
});
