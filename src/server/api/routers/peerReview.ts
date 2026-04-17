/**
 * P2 Gap #17 — Joint Commission NPG 12 peer-review router.
 *
 * The Joint Commission requires that every peer-review session capture:
 *   • when it occurred and who attended
 *   • each case discussed (provider-blinded if needed)
 *   • findings, rationale, and the outcome
 *   • any follow-up actions (e.g. FPPE trigger, MEC referral)
 *
 * This router exposes CRUD for PeerReviewMeeting + PeerReviewMinute, and
 * automatically opens a focused FPPE evaluation whenever a minute outcome
 * is `FOCUSED_REVIEW_REQUIRED`.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import {
  PeerReviewMeetingStatus,
  PeerReviewMinuteOutcome,
  type Prisma,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

export const peerReviewRouter = createTRPCRouter({
  // ─── Meetings ───────────────────────────────────────────────────────
  listMeetings: staffProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
        status: z.nativeEnum(PeerReviewMeetingStatus).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.PeerReviewMeetingWhereInput = input.status
        ? { status: input.status }
        : {};
      const [total, meetings] = await Promise.all([
        ctx.db.peerReviewMeeting.count({ where }),
        ctx.db.peerReviewMeeting.findMany({
          where,
          include: {
            chair: { select: { id: true, displayName: true } },
            _count: { select: { minutes: true } },
          },
          orderBy: { meetingDate: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
      ]);
      return { total, meetings };
    }),

  getMeeting: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const meeting = await ctx.db.peerReviewMeeting.findUnique({
        where: { id: input.id },
        include: {
          chair: { select: { id: true, displayName: true, email: true } },
          minutes: {
            include: {
              provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
              authoredBy: { select: { id: true, displayName: true } },
              evaluation: { select: { id: true, evaluationType: true, status: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (!meeting) throw new TRPCError({ code: "NOT_FOUND" });
      return meeting;
    }),

  createMeeting: managerProcedure
    .input(
      z.object({
        meetingDate: z.string().datetime(),
        facilityName: z.string().optional().nullable(),
        chairId: z.string().optional().nullable(),
        attendees: z.array(z.string()).default([]),
        agendaUrl: z.string().url().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const meeting = await ctx.db.peerReviewMeeting.create({
        data: {
          meetingDate: new Date(input.meetingDate),
          facilityName: input.facilityName ?? null,
          chairId: input.chairId ?? null,
          attendees: input.attendees as unknown as Prisma.InputJsonValue,
          agendaUrl: input.agendaUrl ?? null,
          notes: input.notes ?? null,
        },
      });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "peerReview.meeting.created",
        entityType: "PeerReviewMeeting",
        entityId: meeting.id,
      });
      return meeting;
    }),

  updateMeeting: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.nativeEnum(PeerReviewMeetingStatus).optional(),
        attendees: z.array(z.string()).optional(),
        agendaUrl: z.string().url().optional().nullable(),
        minutesDocBlobUrl: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Prisma.PeerReviewMeetingUpdateInput = {};
      if (input.status) data.status = input.status;
      if (input.attendees) data.attendees = input.attendees as unknown as Prisma.InputJsonValue;
      if (input.agendaUrl !== undefined) data.agendaUrl = input.agendaUrl;
      if (input.minutesDocBlobUrl !== undefined) data.minutesDocBlobUrl = input.minutesDocBlobUrl;
      if (input.notes !== undefined) data.notes = input.notes;

      const updated = await ctx.db.peerReviewMeeting.update({
        where: { id: input.id },
        data,
      });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "peerReview.meeting.updated",
        entityType: "PeerReviewMeeting",
        entityId: input.id,
      });
      return updated;
    }),

  // ─── Minutes (per-case entries) ─────────────────────────────────────
  addMinute: staffProcedure
    .input(
      z.object({
        meetingId: z.string().uuid(),
        providerId: z.string().uuid(),
        caseSummary: z.string().min(1),
        caseDate: z.string().datetime().optional().nullable(),
        caseRefNumber: z.string().optional().nullable(),
        outcome: z.nativeEnum(PeerReviewMinuteOutcome),
        rationale: z.string().optional().nullable(),
        followUpRequired: z.boolean().default(false),
        followUpDueDate: z.string().datetime().optional().nullable(),
        isProviderBlinded: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const minute = await ctx.db.peerReviewMinute.create({
        data: {
          meetingId: input.meetingId,
          providerId: input.providerId,
          caseSummary: input.caseSummary,
          caseDate: input.caseDate ? new Date(input.caseDate) : null,
          caseRefNumber: input.caseRefNumber ?? null,
          outcome: input.outcome,
          rationale: input.rationale ?? null,
          followUpRequired: input.followUpRequired,
          followUpDueDate: input.followUpDueDate ? new Date(input.followUpDueDate) : null,
          authoredById: ctx.session!.user.id,
          isProviderBlinded: input.isProviderBlinded,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "peerReview.minute.added",
        entityType: "PeerReviewMinute",
        entityId: minute.id,
        providerId: input.providerId,
        afterState: {
          outcome: input.outcome,
          followUpRequired: input.followUpRequired,
        },
      });

      // Auto-trigger FPPE if the committee says focused review is required.
      if (input.outcome === "FOCUSED_REVIEW_REQUIRED") {
        const periodStart = new Date();
        const periodEnd = input.followUpDueDate
          ? new Date(input.followUpDueDate)
          : new Date(periodStart.getTime() + 90 * 24 * 60 * 60 * 1000);
        const fppe = await ctx.db.practiceEvaluation.create({
          data: {
            providerId: input.providerId,
            evaluationType: "FPPE",
            periodStart,
            periodEnd,
            dueDate: periodEnd,
            trigger: "Auto-FPPE — peer-review committee focused-review outcome",
            triggerRefId: minute.id,
          },
        });
        await ctx.db.peerReviewMinute.update({
          where: { id: minute.id },
          data: { evaluationId: fppe.id },
        });
        await writeAuditLog({
          actorId: ctx.session!.user.id,
          actorRole: ctx.session!.user.role,
          action: "evaluation.fppe.auto_created",
          entityType: "PracticeEvaluation",
          entityId: fppe.id,
          providerId: input.providerId,
          afterState: {
            trigger: "peer_review_outcome",
            minuteId: minute.id,
          },
        });
      }

      return minute;
    }),

  deleteMinute: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const minute = await ctx.db.peerReviewMinute.findUnique({
        where: { id: input.id },
        select: { providerId: true },
      });
      if (!minute) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.peerReviewMinute.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "peerReview.minute.deleted",
        entityType: "PeerReviewMinute",
        entityId: input.id,
        providerId: minute.providerId,
      });
      return { success: true };
    }),

  // ─── Per-provider history ──────────────────────────────────────────
  listMinutesByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.peerReviewMinute.findMany({
        where: { providerId: input.providerId },
        include: {
          meeting: { select: { id: true, meetingDate: true, facilityName: true } },
          evaluation: { select: { id: true, evaluationType: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    ),
});
