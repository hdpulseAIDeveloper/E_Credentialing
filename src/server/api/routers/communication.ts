/**
 * Communication router — send email/SMS, log phone calls, internal notes.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { CommunicationType, CommunicationChannel, DeliveryStatus } from "@prisma/client";

export const communicationRouter = createTRPCRouter({
  // ─── List communications for a provider ───────────────────────────────
  listByProvider: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        channel: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        providerId: input.providerId,
        ...(input.channel && { channel: input.channel as CommunicationChannel }),
      };

      const [total, communications] = await Promise.all([
        ctx.db.communication.count({ where }),
        ctx.db.communication.findMany({
          where,
          include: {
            fromUser: { select: { id: true, displayName: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { sentAt: "desc" },
        }),
      ]);

      return { communications, total };
    }),

  // ─── Log internal note ─────────────────────────────────────────────────
  addInternalNote: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        body: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const comm = await ctx.db.communication.create({
        data: {
          providerId: input.providerId,
          communicationType: "INTERNAL_NOTE",
          direction: "OUTBOUND",
          channel: "INTERNAL",
          fromUserId: ctx.session!.user.id,
          body: input.body,
          deliveryStatus: "LOGGED",
          sentAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "communication.note.added",
        entityType: "Communication",
        entityId: comm.id,
        providerId: input.providerId,
      });

      return comm;
    }),

  // ─── Log phone call ────────────────────────────────────────────────────
  logPhoneCall: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        direction: z.enum(["OUTBOUND", "INBOUND"]),
        body: z.string().min(1), // Call notes
        toAddress: z.string().optional(), // Phone number
      })
    )
    .mutation(async ({ ctx, input }) => {
      const comm = await ctx.db.communication.create({
        data: {
          providerId: input.providerId,
          communicationType: "PHONE_LOG",
          direction: input.direction,
          channel: "PHONE",
          fromUserId: ctx.session!.user.id,
          toAddress: input.toAddress,
          body: input.body,
          deliveryStatus: "LOGGED",
          sentAt: new Date(),
        },
      });

      return comm;
    }),

  // ─── Send follow-up email ──────────────────────────────────────────────
  sendFollowUpEmail: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        toAddress: z.string().email(),
        subject: z.string().min(1),
        body: z.string().min(1),
        templateId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Import SendGrid lazily to avoid init issues
      const { sendEmail } = await import("@/lib/email/sendgrid");

      let messageId = "";
      let deliveryStatus: DeliveryStatus = "SENT";

      try {
        messageId = await sendEmail({
          to: input.toAddress,
          subject: input.subject,
          html: input.body,
          templateId: input.templateId,
        });
      } catch (error) {
        console.error("[Communication] Email send failed:", error);
        deliveryStatus = "FAILED";
      }

      const comm = await ctx.db.communication.create({
        data: {
          providerId: input.providerId,
          communicationType: "FOLLOW_UP_EMAIL",
          direction: "OUTBOUND",
          channel: "EMAIL",
          fromUserId: ctx.session!.user.id,
          toAddress: input.toAddress,
          subject: input.subject,
          body: input.body,
          templateId: input.templateId,
          deliveryStatus,
          sentAt: new Date(),
          ...(messageId && { deliveryConfirmedAt: new Date() }),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "communication.email.sent",
        entityType: "Communication",
        entityId: comm.id,
        providerId: input.providerId,
        afterState: { to: input.toAddress, subject: input.subject, status: deliveryStatus },
      });

      return comm;
    }),

  // ─── Send SMS ──────────────────────────────────────────────────────────
  sendSms: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        toPhone: z.string().min(10),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { sendSms } = await import("@/lib/azure/communication");

      let deliveryStatus: DeliveryStatus = "SENT";

      try {
        await sendSms({ to: input.toPhone, message: input.message });
      } catch (error) {
        console.error("[Communication] SMS send failed:", error);
        deliveryStatus = "FAILED";
      }

      const comm = await ctx.db.communication.create({
        data: {
          providerId: input.providerId,
          communicationType: "SMS",
          direction: "OUTBOUND",
          channel: "SMS",
          fromUserId: ctx.session!.user.id,
          toAddress: input.toPhone,
          body: input.message,
          deliveryStatus,
          sentAt: new Date(),
        },
      });

      return comm;
    }),
});
