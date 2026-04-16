/**
 * Report router — saved reports CRUD, CSV exports, compliance summary.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";

function toCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => `"${val.replace(/"/g, '""')}"`;
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "";
  return d.toISOString().split("T")[0]!;
}

export const reportRouter = createTRPCRouter({
  // ─── List saved reports ───────────────────────────────────────────────
  listSavedReports: staffProcedure.query(async ({ ctx }) => {
    return ctx.db.savedReport.findMany({
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: { updatedAt: "desc" },
    });
  }),

  // ─── Save (create) a report ───────────────────────────────────────────
  saveReport: managerProcedure
    .input(
      z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        category: z.string().default("custom"),
        filters: z.record(z.unknown()).default({}),
        columns: z.array(z.string()).default([]),
        schedule: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.savedReport.create({
        data: {
          name: input.name,
          description: input.description,
          category: input.category,
          filters: input.filters as unknown as import("@prisma/client").Prisma.InputJsonValue,
          columns: input.columns as unknown as import("@prisma/client").Prisma.InputJsonValue,
          schedule: input.schedule,
          createdById: ctx.session!.user.id,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "report.created",
        entityType: "SavedReport",
        entityId: report.id,
        afterState: { name: input.name, category: input.category },
      });

      return report;
    }),

  // ─── Update a saved report ────────────────────────────────────────────
  updateReport: managerProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        description: z.string().optional(),
        category: z.string().optional(),
        filters: z.record(z.unknown()).optional(),
        columns: z.array(z.string()).optional(),
        schedule: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const before = await ctx.db.savedReport.findUnique({ where: { id: input.id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Saved report not found" });

      const updated = await ctx.db.savedReport.update({
        where: { id: input.id },
        data: {
          ...(input.name !== undefined && { name: input.name }),
          ...(input.description !== undefined && { description: input.description }),
          ...(input.category !== undefined && { category: input.category }),
          ...(input.filters !== undefined && { filters: input.filters as unknown as import("@prisma/client").Prisma.InputJsonValue }),
          ...(input.columns !== undefined && { columns: input.columns as unknown as import("@prisma/client").Prisma.InputJsonValue }),
          ...(input.schedule !== undefined && { schedule: input.schedule }),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "report.updated",
        entityType: "SavedReport",
        entityId: input.id,
        beforeState: { name: before.name, category: before.category },
        afterState: { name: updated.name, category: updated.category },
      });

      return updated;
    }),

  // ─── Delete a saved report ────────────────────────────────────────────
  deleteReport: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const report = await ctx.db.savedReport.findUnique({ where: { id: input.id } });
      if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "Saved report not found" });

      await ctx.db.savedReport.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "report.deleted",
        entityType: "SavedReport",
        entityId: input.id,
        beforeState: { name: report.name, category: report.category },
      });

      return { success: true };
    }),

  // ─── Export providers CSV ─────────────────────────────────────────────
  exportProviders: staffProcedure
    .input(
      z.object({
        status: z.string().optional(),
        providerTypeId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.providerTypeId) where.providerTypeId = input.providerTypeId;

      const providers = await ctx.db.provider.findMany({
        where,
        include: {
          providerType: true,
          profile: true,
          licenses: { where: { isPrimary: true }, take: 1 },
        },
        orderBy: { legalLastName: "asc" },
      });

      const headers = [
        "Name", "NPI", "Type", "Status", "Email", "Phone",
        "License State", "License#", "Expiration", "Hire Date", "Facility",
      ];

      const rows = providers.map((p) => {
        const license = p.licenses[0];
        return [
          `${p.legalLastName}, ${p.legalFirstName}`,
          p.npi ?? "",
          p.providerType?.abbreviation ?? "",
          p.status,
          p.profile?.personalEmail ?? "",
          p.profile?.mobilePhone ?? "",
          license?.state ?? "",
          license?.licenseNumber ?? "",
          fmtDate(license?.expirationDate),
          fmtDate(p.profile?.hireDate),
          p.profile?.facilityAssignment ?? "",
        ];
      });

      return toCsv(headers, rows);
    }),

  // ─── Export enrollments CSV ───────────────────────────────────────────
  exportEnrollments: staffProcedure
    .input(
      z.object({
        status: z.string().optional(),
        payerName: z.string().optional(),
        enrollmentType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.payerName) where.payerName = { contains: input.payerName, mode: "insensitive" };
      if (input.enrollmentType) where.enrollmentType = input.enrollmentType;

      const enrollments = await ctx.db.enrollment.findMany({
        where,
        include: {
          provider: { select: { legalFirstName: true, legalLastName: true, npi: true } },
          assignedTo: { select: { displayName: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const headers = [
        "Provider", "NPI", "Payer", "Type", "Status",
        "Submitted", "Effective Date", "Assigned To",
      ];

      const rows = enrollments.map((e) => [
        `${e.provider.legalLastName}, ${e.provider.legalFirstName}`,
        e.provider.npi ?? "",
        e.payerName,
        e.enrollmentType,
        e.status,
        fmtDate(e.submittedAt),
        fmtDate(e.effectiveDate),
        e.assignedTo?.displayName ?? "",
      ]);

      return toCsv(headers, rows);
    }),

  // ─── Export expirables CSV ────────────────────────────────────────────
  exportExpirables: staffProcedure
    .input(
      z.object({
        status: z.string().optional(),
        expiringWithinDays: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.status) where.status = input.status;
      if (input.expiringWithinDays) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() + input.expiringWithinDays);
        where.expirationDate = { lte: cutoff };
      }

      const expirables = await ctx.db.expirable.findMany({
        where,
        include: {
          provider: { select: { legalFirstName: true, legalLastName: true, npi: true } },
          document: { select: { originalFilename: true } },
        },
        orderBy: { expirationDate: "asc" },
      });

      const headers = [
        "Provider", "NPI", "Type", "Expiration Date", "Status",
        "Last Verified", "Document",
      ];

      const rows = expirables.map((e) => [
        `${e.provider.legalLastName}, ${e.provider.legalFirstName}`,
        e.provider.npi ?? "",
        e.expirableType,
        fmtDate(e.expirationDate),
        e.status,
        fmtDate(e.lastVerifiedDate),
        e.document?.originalFilename ?? "",
      ]);

      return toCsv(headers, rows);
    }),

  // ─── Export recredentialing CSV ───────────────────────────────────────
  exportRecredentialing: staffProcedure.query(async ({ ctx }) => {
    const cycles = await ctx.db.recredentialingCycle.findMany({
      include: {
        provider: { select: { legalFirstName: true, legalLastName: true, npi: true } },
      },
      orderBy: { dueDate: "asc" },
    });

    const headers = [
      "Provider", "NPI", "Cycle#", "Due Date", "Status", "Started", "Completed",
    ];

    const rows = cycles.map((c) => [
      `${c.provider.legalLastName}, ${c.provider.legalFirstName}`,
      c.provider.npi ?? "",
      String(c.cycleNumber),
      fmtDate(c.dueDate),
      c.status,
      fmtDate(c.startedAt),
      fmtDate(c.completedAt),
    ]);

    return toCsv(headers, rows);
  }),

  // ─── Compliance summary (NCQA-style) ─────────────────────────────────
  complianceSummary: staffProcedure.query(async ({ ctx }) => {
    const [totalProviders, activeProviders] = await Promise.all([
      ctx.db.provider.count(),
      ctx.db.provider.count({ where: { status: "APPROVED" } }),
    ]);

    // PSV completion rate: providers with at least one verification and none flagged/errored
    const providersWithVerifications = await ctx.db.provider.findMany({
      where: { status: { in: ["APPROVED", "COMMITTEE_READY", "COMMITTEE_IN_REVIEW", "VERIFICATION_IN_PROGRESS"] } },
      select: {
        id: true,
        verificationRecords: { select: { status: true } },
      },
    });

    const psvComplete = providersWithVerifications.filter((p) => {
      if (p.verificationRecords.length === 0) return false;
      return p.verificationRecords.every((v) => v.status === "VERIFIED");
    });
    const psvCompletionRate = providersWithVerifications.length > 0
      ? Math.round((psvComplete.length / providersWithVerifications.length) * 100)
      : 0;

    // Sanctions compliance: providers with a CLEAR OIG + CLEAR SAM check in last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sanctionsProviders = await ctx.db.provider.findMany({
      where: { status: { not: "INACTIVE" } },
      select: {
        id: true,
        sanctionsChecks: {
          where: { runDate: { gte: thirtyDaysAgo } },
          select: { source: true, result: true },
        },
      },
    });

    const sanctionsCompliant = sanctionsProviders.filter((p) => {
      const hasOig = p.sanctionsChecks.some((s) => s.source === "OIG" && s.result === "CLEAR");
      const hasSam = p.sanctionsChecks.some((s) => s.source === "SAM_GOV" && s.result === "CLEAR");
      return hasOig && hasSam;
    });
    const sanctionsComplianceRate = sanctionsProviders.length > 0
      ? Math.round((sanctionsCompliant.length / sanctionsProviders.length) * 100)
      : 0;

    // Average credentialing days (INVITED → APPROVED)
    const approvedProviders = await ctx.db.provider.findMany({
      where: { status: "APPROVED", approvedAt: { not: null }, inviteSentAt: { not: null } },
      select: { inviteSentAt: true, approvedAt: true },
    });

    const averageCredentialingDays = approvedProviders.length > 0
      ? Math.round(
          approvedProviders.reduce((sum, p) => {
            const days = (p.approvedAt!.getTime() - p.inviteSentAt!.getTime()) / (1000 * 60 * 60 * 24);
            return sum + days;
          }, 0) / approvedProviders.length
        )
      : 0;

    // Recredentialing on-time rate
    const completedCycles = await ctx.db.recredentialingCycle.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      select: { dueDate: true, completedAt: true },
    });

    const onTime = completedCycles.filter((c) => c.completedAt! <= c.dueDate);
    const recredentialingOnTimeRate = completedCycles.length > 0
      ? Math.round((onTime.length / completedCycles.length) * 100)
      : 0;

    // Expirable compliance rate (CURRENT or RENEWED vs total)
    const [compliantExpirables, totalExpirables] = await Promise.all([
      ctx.db.expirable.count({ where: { status: { in: ["CURRENT", "RENEWED"] } } }),
      ctx.db.expirable.count(),
    ]);

    const expirableComplianceRate = totalExpirables > 0
      ? Math.round((compliantExpirables / totalExpirables) * 100)
      : 0;

    return {
      totalProviders,
      activeProviders,
      psvCompletionRate,
      sanctionsComplianceRate,
      averageCredentialingDays,
      recredentialingOnTimeRate,
      expirableComplianceRate,
    };
  }),
});
