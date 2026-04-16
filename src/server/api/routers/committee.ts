/**
 * Committee router — sessions CRUD, provider management, decisions.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";

export const committeeRouter = createTRPCRouter({
  // ─── List sessions ────────────────────────────────────────────────────
  listSessions: staffProcedure
    .input(
      z.object({
        status: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = input.status ? { status: input.status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED" } : {};

      const [total, sessions] = await Promise.all([
        ctx.db.committeeSession.count({ where }),
        ctx.db.committeeSession.findMany({
          where,
          include: {
            providers: {
              include: {
                provider: { select: { id: true, legalFirstName: true, legalLastName: true, status: true } },
              },
            },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { sessionDate: "desc" },
        }),
      ]);

      return { sessions, total };
    }),

  // ─── Get session by ID ────────────────────────────────────────────────
  getSession: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const session = await ctx.db.committeeSession.findUnique({
        where: { id: input.id },
        include: {
          providers: {
            include: {
              provider: {
                include: {
                  providerType: true,
                  verificationRecords: { orderBy: { verifiedDate: "desc" }, take: 5 },
                  sanctionsChecks: { orderBy: { runDate: "desc" }, take: 1 },
                  npdbRecords: { orderBy: { queryDate: "desc" }, take: 1 },
                },
              },
              decisionBy: { select: { id: true, displayName: true } },
            },
            orderBy: { agendaOrder: "asc" },
          },
        },
      });

      if (!session) throw new TRPCError({ code: "NOT_FOUND" });
      return session;
    }),

  // ─── Create session ────────────────────────────────────────────────────
  createSession: managerProcedure
    .input(
      z.object({
        sessionDate: z.string(),
        sessionTime: z.string().optional(),
        location: z.string().optional(),
        committeeMemberIds: z.array(z.string().uuid()).default([]),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.committeeSession.create({
        data: {
          sessionDate: new Date(input.sessionDate),
          sessionTime: input.sessionTime,
          location: input.location,
          committeeMemberIds: input.committeeMemberIds,
          notes: input.notes,
          status: "SCHEDULED",
          agendaVersion: 0,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "committee.session.created",
        entityType: "CommitteeSession",
        entityId: session.id,
        afterState: { sessionDate: input.sessionDate },
      });

      return session;
    }),

  // ─── Add provider to session ──────────────────────────────────────────
  addProvider: staffProcedure
    .input(
      z.object({
        sessionId: z.string().uuid(),
        providerId: z.string().uuid(),
        agendaOrder: z.number().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Get current max order
      const maxOrder = await ctx.db.committeeProvider.aggregate({
        where: { committeeSessionId: input.sessionId },
        _max: { agendaOrder: true },
      });

      const agendaOrder = input.agendaOrder ?? (maxOrder._max.agendaOrder ?? 0) + 1;

      const entry = await ctx.db.committeeProvider.create({
        data: {
          committeeSessionId: input.sessionId,
          providerId: input.providerId,
          agendaOrder,
          summaryVersion: 0,
        },
      });

      // Move provider to committee_in_review status if in committee_ready
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (provider?.status === "COMMITTEE_READY") {
        await ctx.db.provider.update({
          where: { id: input.providerId },
          data: { status: "COMMITTEE_IN_REVIEW" },
        });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "committee.provider.added",
        entityType: "CommitteeProvider",
        entityId: entry.id,
        providerId: input.providerId,
        afterState: { sessionId: input.sessionId, agendaOrder },
      });

      return entry;
    }),

  // ─── Remove provider from session ────────────────────────────────────
  removeProvider: staffProcedure
    .input(z.object({ entryId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.committeeProvider.findUnique({ where: { id: input.entryId } });
      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.committeeProvider.delete({ where: { id: input.entryId } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "committee.provider.removed",
        entityType: "CommitteeProvider",
        entityId: input.entryId,
        providerId: entry.providerId,
      });

      return { success: true };
    }),

  // ─── Update agenda order ─────────────────────────────────────────────
  updateAgendaOrder: staffProcedure
    .input(
      z.object({
        entries: z.array(
          z.object({ entryId: z.string().uuid(), agendaOrder: z.number() })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await Promise.all(
        input.entries.map((e) =>
          ctx.db.committeeProvider.update({
            where: { id: e.entryId },
            data: { agendaOrder: e.agendaOrder },
          })
        )
      );
      return { success: true };
    }),

  // ─── Record decision ─────────────────────────────────────────────────
  recordDecision: managerProcedure
    .input(
      z.object({
        entryId: z.string().uuid(),
        decision: z.enum(["APPROVED", "DENIED", "DEFERRED", "CONDITIONAL"]),
        denialReason: z.string().optional(),
        conditionalItems: z.string().optional(),
        committeeNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const entry = await ctx.db.committeeProvider.findUnique({
        where: { id: input.entryId },
        include: { committeeSession: true },
      });

      if (!entry) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.committeeProvider.update({
        where: { id: input.entryId },
        data: {
          decision: input.decision,
          decisionDate: new Date(),
          decisionById: ctx.session!.user.id,
          denialReason: input.denialReason ?? null,
          conditionalItems: input.conditionalItems ?? null,
          committeeNotes: input.committeeNotes ?? null,
        },
      });

      // Update provider status
      const newStatus =
        input.decision === "APPROVED"
          ? "APPROVED"
          : input.decision === "DENIED"
          ? "DENIED"
          : input.decision === "DEFERRED"
          ? "DEFERRED"
          : "COMMITTEE_IN_REVIEW"; // CONDITIONAL stays in review

      const updateData: Record<string, unknown> = {
        status: newStatus,
      };

      if (input.decision === "APPROVED") {
        updateData.approvedAt = new Date();
        updateData.approvedBy = ctx.session!.user.id;
        updateData.approvalSessionId = entry.committeeSessionId;

        // Set initial approval date for recredentialing cycle calculation (first approval only)
        const currentProvider = await ctx.db.provider.findUnique({
          where: { id: entry.providerId },
          select: { initialApprovalDate: true },
        });
        if (!currentProvider?.initialApprovalDate) {
          updateData.initialApprovalDate = new Date();
        }
      }

      if (input.denialReason) {
        updateData.denialReason = input.denialReason;
      }

      await ctx.db.provider.update({
        where: { id: entry.providerId },
        data: updateData,
      });

      // Create or link recredentialing cycle on approval
      if (input.decision === "APPROVED") {
        const existingCycle = await ctx.db.recredentialingCycle.findFirst({
          where: {
            providerId: entry.providerId,
            status: { in: ["PENDING", "APPLICATION_SENT", "IN_PROGRESS", "PSV_RUNNING", "COMMITTEE_READY"] },
          },
        });

        if (existingCycle) {
          // Link existing recredentialing cycle to this committee session and mark completed
          await ctx.db.recredentialingCycle.update({
            where: { id: existingCycle.id },
            data: {
              committeeSessionId: entry.committeeSessionId,
              status: "COMPLETED",
              completedAt: new Date(),
            },
          });
        } else {
          // Create initial recredentialing cycle (36 months from approval)
          const dueDate = new Date();
          dueDate.setMonth(dueDate.getMonth() + 36);

          const cycleCount = await ctx.db.recredentialingCycle.count({
            where: { providerId: entry.providerId },
          });

          await ctx.db.recredentialingCycle.create({
            data: {
              providerId: entry.providerId,
              cycleNumber: cycleCount + 1,
              cycleLengthMonths: 36,
              dueDate,
              status: "PENDING",
              committeeSessionId: entry.committeeSessionId,
              notes: "Auto-created on initial committee approval",
            },
          });
        }
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "committee.decision.recorded",
        entityType: "CommitteeProvider",
        entityId: input.entryId,
        providerId: entry.providerId,
        afterState: {
          decision: input.decision,
          sessionId: entry.committeeSessionId,
        },
      });

      return { success: true };
    }),

  // ─── Update session status ────────────────────────────────────────────
  updateSessionStatus: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.committeeSession.update({
        where: { id: input.id },
        data: { status: input.status },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "committee.session.status.changed",
        entityType: "CommitteeSession",
        entityId: input.id,
        afterState: { status: input.status },
      });

      return updated;
    }),

  // ─── Get committee queue (providers ready for review) ─────────────────
  getQueue: staffProcedure
    .query(async ({ ctx }) => {
      const [committeeReady, recredReady] = await Promise.all([
        ctx.db.provider.findMany({
          where: { status: "COMMITTEE_READY" },
          include: { providerType: true },
          orderBy: { committeeReadyAt: "asc" },
        }),
        ctx.db.provider.findMany({
          where: {
            status: "APPROVED",
            recredentialingCycles: {
              some: { status: "COMMITTEE_READY" },
            },
          },
          include: {
            providerType: true,
            recredentialingCycles: {
              where: { status: "COMMITTEE_READY" },
              take: 1,
            },
          },
        }),
      ]);
      return { initialCredentialing: committeeReady, recredentialing: recredReady };
    }),

  // ─── Generate committee summary for a provider ──────────────────────
  generateSummary: staffProcedure
    .input(z.object({ providerId: z.string(), sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { generateCommitteeSummaryHtml } = await import("@/lib/pdf/committee-summary");
      const html = await generateCommitteeSummaryHtml(input.providerId);

      const cp = await ctx.db.committeeProvider.findFirst({
        where: { committeeSessionId: input.sessionId, providerId: input.providerId },
      });

      if (cp) {
        await ctx.db.committeeProvider.update({
          where: { id: cp.id },
          data: {
            summaryBlobUrl: `generated:html:${Date.now()}`,
            summaryVersion: (cp.summaryVersion ?? 0) + 1,
          },
        });
      }

      return { html, version: (cp?.summaryVersion ?? 0) + 1 };
    }),

  // ─── Generate full session agenda ──────────────────────────────────
  generateAgenda: staffProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { generateAgendaHtml } = await import("@/lib/pdf/committee-agenda");
      const html = await generateAgendaHtml(input.sessionId);

      const session = await ctx.db.committeeSession.findUnique({ where: { id: input.sessionId } });
      const newVersion = (session?.agendaVersion ?? 0) + 1;

      await ctx.db.committeeSession.update({
        where: { id: input.sessionId },
        data: {
          agendaBlobUrl: `generated:html:${Date.now()}`,
          agendaVersion: newVersion,
        },
      });

      return { html, version: newVersion };
    }),

  // ─── Send agenda to committee members ──────────────────────────────
  sendAgenda: staffProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const session = await ctx.db.committeeSession.findUnique({ where: { id: input.sessionId } });
      if (!session) throw new TRPCError({ code: "NOT_FOUND" });

      if (session.committeeMemberIds.length > 0) {
        const members = await ctx.db.user.findMany({
          where: { id: { in: session.committeeMemberIds } },
          select: { email: true, displayName: true },
        });

        for (const member of members) {
          await ctx.db.communication.create({
            data: {
              providerId: null,
              communicationType: "COMMITTEE_AGENDA_EMAIL",
              direction: "OUTBOUND",
              channel: "EMAIL",
              fromUserId: ctx.session!.user.id,
              toAddress: member.email,
              subject: `Committee Agenda — ${session.sessionDate.toLocaleDateString()}`,
              body: `Dear ${member.displayName},\n\nThe committee agenda for ${session.sessionDate.toLocaleDateString()} is ready for review.\n\nPlease review the attached provider summaries before the session.\n\nBest regards,\nEssen Credentialing`,
              deliveryStatus: "LOGGED",
              sentAt: new Date(),
            },
          });
        }
      }

      await ctx.db.committeeSession.update({
        where: { id: input.sessionId },
        data: { agendaSentAt: new Date() },
      });

      return { sent: session.committeeMemberIds.length };
    }),
});
