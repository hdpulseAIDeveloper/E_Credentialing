/**
 * Enrollment router — CRUD, follow-up logging, status updates.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { EnrollmentStatus, SubmissionMethod, EnrollmentType } from "@prisma/client";

export const enrollmentRouter = createTRPCRouter({
  // ─── List enrollments ──────────────────────────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid().optional(),
        payerName: z.string().optional(),
        status: z.string().optional(),
        enrollmentType: z.string().optional(),
        assignedToId: z.string().uuid().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        ...(input.providerId && { providerId: input.providerId }),
        ...(input.payerName && { payerName: { contains: input.payerName, mode: "insensitive" as const } }),
        ...(input.status && { status: input.status as EnrollmentStatus }),
        ...(input.enrollmentType && { enrollmentType: input.enrollmentType as EnrollmentType }),
        ...(input.assignedToId && { assignedToId: input.assignedToId }),
      };

      const [total, enrollments] = await Promise.all([
        ctx.db.enrollment.count({ where }),
        ctx.db.enrollment.findMany({
          where,
          include: {
            provider: { select: { id: true, legalFirstName: true, legalLastName: true, providerType: true } },
            assignedTo: { select: { id: true, displayName: true } },
            submittedBy: { select: { id: true, displayName: true } },
            followUps: { orderBy: { followUpDate: "desc" }, take: 1 },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { enrollments, total };
    }),

  // ─── Get by ID ────────────────────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findUnique({
        where: { id: input.id },
        include: {
          provider: { include: { providerType: true, profile: true } },
          assignedTo: { select: { id: true, displayName: true } },
          submittedBy: { select: { id: true, displayName: true } },
          followUps: {
            include: { performedBy: { select: { id: true, displayName: true } } },
            orderBy: { followUpDate: "desc" },
          },
        },
      });

      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });
      return enrollment;
    }),

  // ─── Create enrollment ─────────────────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        payerName: z.string().min(1),
        enrollmentType: z.enum(["DELEGATED", "FACILITY_BTC", "DIRECT"]),
        submissionMethod: z.enum(["PORTAL_MPP", "PORTAL_AVAILITY", "PORTAL_VERITY", "PORTAL_EYEMED", "PORTAL_VNS", "EMAIL", "FTP"]),
        portalName: z.string().optional(),
        assignedToId: z.string().uuid().optional(),
        followUpCadenceDays: z.number().min(1).default(14),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.create({
        data: {
          providerId: input.providerId,
          payerName: input.payerName,
          enrollmentType: input.enrollmentType as EnrollmentType,
          submissionMethod: input.submissionMethod as SubmissionMethod,
          portalName: input.portalName,
          assignedToId: input.assignedToId,
          followUpCadenceDays: input.followUpCadenceDays,
          status: "DRAFT",
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "enrollment.created",
        entityType: "Enrollment",
        entityId: enrollment.id,
        providerId: input.providerId,
        afterState: { payerName: input.payerName, enrollmentType: input.enrollmentType },
      });

      return enrollment;
    }),

  // ─── Update enrollment status ──────────────────────────────────────────
  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        status: z.enum(["DRAFT", "SUBMITTED", "PENDING_PAYER", "ENROLLED", "DENIED", "ERROR", "WITHDRAWN"]),
        payerConfirmationNumber: z.string().optional(),
        effectiveDate: z.string().optional(),
        payerResponseNotes: z.string().optional(),
        denialReason: z.string().optional(),
        followUpDueDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.enrollment.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.enrollment.update({
        where: { id: input.id },
        data: {
          status: input.status as EnrollmentStatus,
          ...(input.status === "SUBMITTED" && { submittedAt: new Date(), submittedById: ctx.session!.user.id }),
          payerConfirmationNumber: input.payerConfirmationNumber,
          effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
          payerResponseNotes: input.payerResponseNotes,
          denialReason: input.denialReason,
          followUpDueDate: input.followUpDueDate ? new Date(input.followUpDueDate) : undefined,
          ...(input.status !== before.status && { payerResponseDate: new Date() }),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "enrollment.status.changed",
        entityType: "Enrollment",
        entityId: input.id,
        providerId: before.providerId,
        beforeState: { status: before.status },
        afterState: { status: input.status },
      });

      return updated;
    }),

  // ─── Add follow-up ────────────────────────────────────────────────────
  addFollowUp: staffProcedure
    .input(
      z.object({
        enrollmentId: z.string().uuid(),
        outcome: z.string().min(1),
        nextFollowUpDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findUnique({ where: { id: input.enrollmentId } });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      const followUp = await ctx.db.enrollmentFollowUp.create({
        data: {
          enrollmentId: input.enrollmentId,
          followUpDate: new Date(),
          performedById: ctx.session!.user.id,
          outcome: input.outcome,
          nextFollowUpDate: input.nextFollowUpDate ? new Date(input.nextFollowUpDate) : null,
        },
      });

      // Update follow-up due date on enrollment
      if (input.nextFollowUpDate) {
        await ctx.db.enrollment.update({
          where: { id: input.enrollmentId },
          data: { followUpDueDate: new Date(input.nextFollowUpDate) },
        });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "enrollment.followup.added",
        entityType: "EnrollmentFollowUp",
        entityId: followUp.id,
        providerId: enrollment.providerId,
      });

      return followUp;
    }),

  // ─── Delete enrollment ────────────────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findUnique({
        where: { id: input.id },
        select: { id: true, providerId: true, payerName: true, status: true },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Enrollment not found" });

      await ctx.db.enrollment.update({
        where: { id: input.id },
        data: { status: "WITHDRAWN" },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "enrollment.withdrawn",
        entityType: "Enrollment",
        entityId: input.id,
        providerId: enrollment.providerId,
        beforeState: { status: enrollment.status },
        afterState: { status: "WITHDRAWN" },
      });

      return { success: true };
    }),

  // ─── Generate roster CSV ──────────────────────────────────────────────
  generateRoster: staffProcedure
    .input(z.object({ enrollmentIds: z.array(z.string()), type: z.enum(["delegated", "facility"]).default("delegated") }))
    .mutation(async ({ input }) => {
      const { generateDelegatedRoster, generateFacilityRoster } = await import("@/lib/pdf/roster-generator");
      const generator = input.type === "facility" ? generateFacilityRoster : generateDelegatedRoster;
      return generator(input.enrollmentIds);
    }),

  // ─── Stub: Submit enrollment via portal bot ────────────────────────────
  submitViaPortal: staffProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findUnique({ where: { id: input.enrollmentId }, include: { provider: true } });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      const botRun = await ctx.db.botRun.create({
        data: {
          providerId: enrollment.providerId,
          botType: "ENROLLMENT_SUBMISSION",
          triggeredBy: "MANUAL",
          triggeredByUserId: ctx.session!.user.id,
          status: "QUEUED",
          attemptCount: 0,
          queuedAt: new Date(),
          inputData: {
            enrollmentId: input.enrollmentId,
            payerName: enrollment.payerName,
            submissionMethod: enrollment.submissionMethod,
          },
        },
      });

      return { botRunId: botRun.id, message: "Enrollment bot queued for submission" };
    }),

  // ─── Stub: Upload roster via SFTP ──────────────────────────────────────
  uploadRosterSftp: staffProcedure
    .input(z.object({ csv: z.string(), filename: z.string(), payerName: z.string() }))
    .mutation(async ({ input }) => {
      const { uploadRoster } = await import("@/lib/integrations/sftp");
      const result = await uploadRoster({
        payerName: input.payerName,
        remotePath: `/rosters/${input.payerName.replace(/\s+/g, "_")}`,
        fileBuffer: Buffer.from(input.csv, "utf-8"),
        filename: input.filename,
      });
      return result;
    }),

  // ─── Push enrollment status to eCW/RCM ─────────────────────────────────
  pushToEcw: staffProcedure
    .input(z.object({ enrollmentId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.enrollment.findUnique({
        where: { id: input.enrollmentId },
        include: { provider: true },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      const { pushEnrollmentStatus } = await import("@/lib/integrations/ecw-rcm");
      return pushEnrollmentStatus({
        providerNpi: enrollment.provider.npi ?? "",
        providerName: `${enrollment.provider.legalFirstName} ${enrollment.provider.legalLastName}`,
        payerName: enrollment.payerName,
        enrollmentStatus: enrollment.status,
        effectiveDate: enrollment.effectiveDate?.toISOString().split("T")[0],
      });
    }),
});
