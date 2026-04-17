/**
 * P3 Gap #21 — FSMB PDC tRPC router.
 *
 * Surfaces subscription state and the per-provider event stream so staff
 * can verify that continuous monitoring is wired up correctly.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  staffProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import {
  FsmbPdcEventProcessingStatus,
  FsmbPdcSubscriptionStatus,
  type Prisma,
} from "@prisma/client";
import { ingestFsmbPdcEvent } from "@/lib/fsmb-pdc";
import { runFsmbPdcPoll } from "@/workers/jobs/fsmb-pdc-poll";

export const fsmbPdcRouter = createTRPCRouter({
  // ─── Subscriptions ──────────────────────────────────────────────────
  listSubscriptions: staffProcedure.query(({ ctx }) =>
    ctx.db.fsmbPdcSubscription.findMany({
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true, npi: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })
  ),

  getSubscription: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.fsmbPdcSubscription.findUnique({
        where: { providerId: input.providerId },
      });
    }),

  upsertSubscription: managerProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        fsmbId: z.string().optional().nullable(),
        status: z.nativeEnum(FsmbPdcSubscriptionStatus).default("ACTIVE"),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.fsmbPdcSubscription.upsert({
        where: { providerId: input.providerId },
        update: {
          fsmbId: input.fsmbId ?? null,
          status: input.status,
          notes: input.notes ?? null,
          enrolledAt:
            input.status === "ACTIVE" ? new Date() : undefined,
          cancelledAt:
            input.status === "CANCELLED" ? new Date() : null,
        },
        create: {
          providerId: input.providerId,
          fsmbId: input.fsmbId ?? null,
          status: input.status,
          notes: input.notes ?? null,
          enrolledAt: input.status === "ACTIVE" ? new Date() : null,
        },
      });
    }),

  // ─── Events ─────────────────────────────────────────────────────────
  listEvents: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        processingStatus: z.nativeEnum(FsmbPdcEventProcessingStatus).optional(),
        limit: z.number().min(1).max(200).default(100),
      })
    )
    .query(({ ctx, input }) => {
      const where: Prisma.FsmbPdcEventWhereInput = {
        ...(input.providerId ? { providerId: input.providerId } : {}),
        ...(input.processingStatus
          ? { processingStatus: input.processingStatus }
          : {}),
      };
      return ctx.db.fsmbPdcEvent.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              legalFirstName: true,
              legalLastName: true,
            },
          },
        },
        orderBy: { occurredAt: "desc" },
        take: input.limit,
      });
    }),

  getEvent: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const event = await ctx.db.fsmbPdcEvent.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            select: {
              id: true,
              legalFirstName: true,
              legalLastName: true,
            },
          },
        },
      });
      if (!event) throw new TRPCError({ code: "NOT_FOUND" });
      return event;
    }),

  // Allow staff to inject a manual event (handy for back-fills / dry-runs).
  ingestManual: managerProcedure
    .input(
      z.object({
        npi: z.string().optional(),
        fsmbId: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        state: z.string().optional(),
        eventCode: z.string().optional(),
        description: z.string(),
        occurredAt: z.string().datetime().optional(),
        externalEventId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ingestFsmbPdcEvent(ctx.db, input);
    }),

  // Manual trigger of the daily poll (useful when feed is configured but
  // staff wants results before the next nightly window).
  runPollNow: managerProcedure.mutation(() => runFsmbPdcPoll()),

  counts: staffProcedure.query(async ({ ctx }) => {
    const [active, pending, eventsLast7d, alertsRaisedLast7d] =
      await Promise.all([
        ctx.db.fsmbPdcSubscription.count({ where: { status: "ACTIVE" } }),
        ctx.db.fsmbPdcSubscription.count({ where: { status: "PENDING" } }),
        ctx.db.fsmbPdcEvent.count({
          where: {
            occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),
        ctx.db.fsmbPdcEvent.count({
          where: {
            occurredAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
            monitoringAlertId: { not: null },
          },
        }),
      ]);
    return { active, pending, eventsLast7d, alertsRaisedLast7d };
  }),
});
