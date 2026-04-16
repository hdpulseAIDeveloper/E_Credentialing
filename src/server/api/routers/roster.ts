/**
 * Roster router — payer roster generation, validation, submission, and tracking.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import type { RosterStatus } from "@prisma/client";

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

export const rosterRouter = createTRPCRouter({
  // ─── List all payer rosters with latest submission ────────────────────
  listRosters: staffProcedure.query(async ({ ctx }) => {
    const rosters = await ctx.db.payerRoster.findMany({
      include: {
        submissions: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { payerName: "asc" },
    });

    return rosters.map((r) => ({
      ...r,
      latestSubmission: r.submissions[0] ?? null,
      submissions: undefined,
    }));
  }),

  // ─── Get a roster by ID with all submissions ─────────────────────────
  getRoster: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const roster = await ctx.db.payerRoster.findUnique({
        where: { id: input.id },
        include: {
          submissions: {
            orderBy: { createdAt: "desc" },
          },
        },
      });

      if (!roster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });
      }

      return roster;
    }),

  // ─── Create a payer roster config ─────────────────────────────────────
  createRoster: managerProcedure
    .input(
      z.object({
        payerName: z.string().min(1),
        rosterFormat: z.string().default("csv"),
        templateConfig: z.record(z.unknown()).default({}),
        submissionMethod: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const roster = await ctx.db.payerRoster.create({
        data: {
          payerName: input.payerName,
          rosterFormat: input.rosterFormat,
          templateConfig: input.templateConfig as unknown as import("@prisma/client").Prisma.InputJsonValue,
          submissionMethod: input.submissionMethod,
        },
      });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "roster.created",
        entityType: "PayerRoster",
        entityId: roster.id,
        afterState: {
          payerName: input.payerName,
          rosterFormat: input.rosterFormat,
          submissionMethod: input.submissionMethod ?? null,
        },
      });

      return roster;
    }),

  // ─── Update roster config ─────────────────────────────────────────────
  updateRoster: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        payerName: z.string().min(1).optional(),
        rosterFormat: z.string().optional(),
        templateConfig: z.record(z.unknown()).optional(),
        submissionMethod: z.string().nullish(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, templateConfig, ...rest } = input;

      const existing = await ctx.db.payerRoster.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });
      }

      const roster = await ctx.db.payerRoster.update({
        where: { id },
        data: {
          ...rest,
          ...(templateConfig !== undefined && {
            templateConfig: templateConfig as unknown as import("@prisma/client").Prisma.InputJsonValue,
          }),
        },
      });

      return roster;
    }),

  // ─── Delete roster ────────────────────────────────────────────────────
  deleteRoster: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.payerRoster.findUnique({
        where: { id: input.id },
        include: { submissions: { select: { id: true } } },
      });
      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });
      }

      await ctx.db.rosterSubmission.deleteMany({
        where: { rosterId: input.id },
      });
      await ctx.db.payerRoster.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "roster.deleted",
        entityType: "PayerRoster",
        entityId: input.id,
        beforeState: {
          payerName: existing.payerName,
          submissionCount: existing.submissions.length,
        },
      });

      return { success: true };
    }),

  // ─── Generate a new roster submission ─────────────────────────────────
  generateSubmission: staffProcedure
    .input(z.object({ rosterId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const roster = await ctx.db.payerRoster.findUnique({
        where: { id: input.rosterId },
      });
      if (!roster) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });
      }

      const enrollments = await ctx.db.enrollment.findMany({
        where: {
          payerName: { equals: roster.payerName, mode: "insensitive" },
          status: "ENROLLED",
        },
        include: {
          provider: {
            select: {
              legalFirstName: true,
              legalLastName: true,
              npi: true,
              dateOfBirth: true,
              profile: {
                select: { specialtyPrimary: true },
              },
            },
          },
        },
      });

      const headers = [
        "Provider Last Name",
        "Provider First Name",
        "NPI",
        "Date of Birth",
        "Specialty",
        "Effective Date",
      ];

      const rows = enrollments.map((e) => [
        e.provider.legalLastName,
        e.provider.legalFirstName,
        e.provider.npi ?? "",
        e.provider.dateOfBirth ?? "",
        e.provider.profile?.specialtyPrimary ?? "",
        e.effectiveDate ? e.effectiveDate.toISOString().split("T")[0] : "",
      ]);

      const csv = toCsv(headers, rows);

      const submission = await ctx.db.rosterSubmission.create({
        data: {
          rosterId: input.rosterId,
          status: "GENERATED" satisfies RosterStatus,
          providerCount: enrollments.length,
        },
      });

      await ctx.db.payerRoster.update({
        where: { id: input.rosterId },
        data: { lastGeneratedAt: new Date() },
      });

      return { csv, submissionId: submission.id, providerCount: enrollments.length };
    }),

  // ─── Validate a submission ────────────────────────────────────────────
  validateSubmission: staffProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.rosterSubmission.findUnique({
        where: { id: input.submissionId },
        include: {
          roster: true,
        },
      });
      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }

      const enrollments = await ctx.db.enrollment.findMany({
        where: {
          payerName: { equals: submission.roster.payerName, mode: "insensitive" },
          status: "ENROLLED",
        },
        include: {
          provider: {
            select: {
              id: true,
              legalFirstName: true,
              legalLastName: true,
              npi: true,
            },
          },
        },
      });

      const errors: { providerId: string; providerName: string; issue: string }[] = [];

      for (const e of enrollments) {
        const name = `${e.provider.legalLastName}, ${e.provider.legalFirstName}`;
        if (!e.provider.npi) {
          errors.push({ providerId: e.provider.id, providerName: name, issue: "Missing NPI" });
        }
        if (!e.effectiveDate) {
          errors.push({ providerId: e.provider.id, providerName: name, issue: "Missing effective date" });
        }
      }

      const newStatus: RosterStatus = errors.length > 0 ? "ERROR" : "VALIDATED";

      await ctx.db.rosterSubmission.update({
        where: { id: input.submissionId },
        data: {
          validationErrors: errors.length > 0 ? errors : undefined,
          status: newStatus,
        },
      });

      return { valid: errors.length === 0, errors, status: newStatus };
    }),

  // ─── Mark submission as SUBMITTED ─────────────────────────────────────
  submitRoster: staffProcedure
    .input(
      z.object({
        submissionId: z.string().uuid(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.rosterSubmission.findUnique({
        where: { id: input.submissionId },
      });
      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }

      const updated = await ctx.db.rosterSubmission.update({
        where: { id: input.submissionId },
        data: {
          status: "SUBMITTED" satisfies RosterStatus,
          submittedAt: new Date(),
          submittedBy: ctx.session.user.id,
          notes: input.notes,
        },
      });

      await ctx.db.payerRoster.update({
        where: { id: submission.rosterId },
        data: { lastSubmittedAt: new Date() },
      });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "roster.submitted",
        entityType: "RosterSubmission",
        entityId: input.submissionId,
        afterState: {
          rosterId: submission.rosterId,
          providerCount: submission.providerCount,
          notes: input.notes ?? null,
        },
      });

      return updated;
    }),

  // ─── Mark submission as ACKNOWLEDGED ──────────────────────────────────
  acknowledgeRoster: staffProcedure
    .input(z.object({ submissionId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const submission = await ctx.db.rosterSubmission.findUnique({
        where: { id: input.submissionId },
      });
      if (!submission) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });
      }

      const updated = await ctx.db.rosterSubmission.update({
        where: { id: input.submissionId },
        data: {
          status: "ACKNOWLEDGED" satisfies RosterStatus,
          acknowledgedAt: new Date(),
        },
      });

      return updated;
    }),
});
