/**
 * NY Medicaid enrollment router — CRUD, 3-path workflow, ETIN tracking.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";

export const medicaidRouter = createTRPCRouter({
  list: staffProcedure
    .input(
      z.object({
        affiliationStatus: z.string().optional(),
        enrollmentPath: z.string().optional(),
        providerId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Record<string, unknown> = {};
      if (input.affiliationStatus) where.affiliationStatus = input.affiliationStatus;
      if (input.enrollmentPath) where.enrollmentPath = input.enrollmentPath;
      if (input.providerId) where.providerId = input.providerId;
      if (input.search) {
        where.OR = [
          { provider: { legalFirstName: { contains: input.search, mode: "insensitive" } } },
          { provider: { legalLastName: { contains: input.search, mode: "insensitive" } } },
          { etinNumber: { contains: input.search, mode: "insensitive" } },
        ];
      }

      const [items, total] = await Promise.all([
        ctx.db.medicaidEnrollment.findMany({
          where: where as any,
          include: {
            provider: {
              include: { providerType: true },
            },
            createdBy: { select: { id: true, displayName: true } },
          },
          orderBy: { updatedAt: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        ctx.db.medicaidEnrollment.count({ where: where as any }),
      ]);

      return { items, total, page: input.page, limit: input.limit };
    }),

  getById: staffProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const enrollment = await ctx.db.medicaidEnrollment.findUnique({
        where: { id: input.id },
        include: {
          provider: {
            include: {
              providerType: true,
              profile: true,
              licenses: { where: { isPrimary: true }, take: 1 },
            },
          },
          botRun: true,
          createdBy: { select: { id: true, displayName: true } },
        },
      });

      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND", message: "Medicaid enrollment not found" });
      return enrollment;
    }),

  create: staffProcedure
    .input(
      z.object({
        providerId: z.string(),
        enrollmentSubtype: z.enum(["INDIVIDUAL", "GROUP"]),
        enrollmentPath: z.enum(["NEW_PSP", "REINSTATEMENT", "AFFILIATION_UPDATE"]),
        payer: z.string().default("NY Medicaid"),
        priorEnrollmentActive: z.boolean().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

      const enrollment = await ctx.db.medicaidEnrollment.create({
        data: {
          providerId: input.providerId,
          enrollmentSubtype: input.enrollmentSubtype,
          enrollmentPath: input.enrollmentPath,
          payer: input.payer,
          affiliationStatus: "PENDING",
          priorEnrollmentActive: input.priorEnrollmentActive,
          providerSignatureRequired: input.enrollmentPath === "REINSTATEMENT",
          maintenanceFileChecked: input.enrollmentPath === "AFFILIATION_UPDATE",
          isInMaintenanceFile: input.enrollmentPath === "AFFILIATION_UPDATE" ? true : null,
          notes: input.notes,
          createdById: ctx.session.user.id,
        },
      });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "medicaid.enrollment.created",
        entityType: "MedicaidEnrollment",
        entityId: enrollment.id,
        providerId: input.providerId,
        afterState: { path: input.enrollmentPath, subtype: input.enrollmentSubtype },
      });

      return enrollment;
    }),

  updateStatus: staffProcedure
    .input(
      z.object({
        id: z.string(),
        affiliationStatus: z.enum(["PENDING", "IN_PROCESS", "ENROLLED", "REVALIDATION_DUE", "EXPIRED"]),
        etinNumber: z.string().optional(),
        enrollmentEffectiveDate: z.string().optional(),
        revalidationDueDate: z.string().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.medicaidEnrollment.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: {
          affiliationStatus: input.affiliationStatus,
          etinNumber: input.etinNumber ?? undefined,
          enrollmentEffectiveDate: input.enrollmentEffectiveDate ? new Date(input.enrollmentEffectiveDate) : undefined,
          revalidationDueDate: input.revalidationDueDate ? new Date(input.revalidationDueDate) : undefined,
          notes: input.notes !== undefined ? input.notes : undefined,
        },
      });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "medicaid.enrollment.status.updated",
        entityType: "MedicaidEnrollment",
        entityId: input.id,
        providerId: existing.providerId,
        beforeState: { status: existing.affiliationStatus },
        afterState: { status: input.affiliationStatus },
      });

      return updated;
    }),

  recordSignature: staffProcedure
    .input(
      z.object({
        id: z.string(),
        signatureReceived: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: {
          providerSignatureReceivedAt: input.signatureReceived ? new Date() : null,
        },
      });
      return updated;
    }),

  updatePsp: staffProcedure
    .input(
      z.object({
        id: z.string(),
        pspRegistered: z.boolean().optional(),
        pspLoginProvided: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: {
          pspRegistered: input.pspRegistered,
          pspLoginProvided: input.pspLoginProvided,
        },
      });
      return updated;
    }),

  confirmEtin: staffProcedure
    .input(
      z.object({
        id: z.string(),
        etinNumber: z.string(),
        etinExpirationDate: z.string(),
        etinConfirmationDocUrl: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.medicaidEnrollment.findUnique({
        where: { id: input.id },
        include: { provider: true },
      });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: {
          etinNumber: input.etinNumber,
          etinConfirmedDate: new Date(),
          etinExpirationDate: new Date(input.etinExpirationDate),
          etinConfirmationDocUrl: input.etinConfirmationDocUrl,
          affiliationStatus: "ENROLLED",
          groupAffiliationUpdated: true,
        },
      });

      // Auto-create linked Expirable for ETIN tracking
      await ctx.db.expirable.create({
        data: {
          providerId: enrollment.providerId,
          expirableType: "MEDICAID_ETIN",
          status: "CURRENT",
          expirationDate: new Date(input.etinExpirationDate),
          lastVerifiedDate: new Date(),
          nextCheckDate: new Date(new Date(input.etinExpirationDate).getTime() - 30 * 86400000),
        },
      });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "medicaid.etin.confirmed",
        entityType: "MedicaidEnrollment",
        entityId: input.id,
        providerId: enrollment.providerId,
        afterState: { etinNumber: input.etinNumber, expirationDate: input.etinExpirationDate },
      });

      return updated;
    }),

  recordSubmission: staffProcedure
    .input(
      z.object({
        id: z.string(),
        submissionDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updated = await ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: {
          submissionDate: input.submissionDate ? new Date(input.submissionDate) : new Date(),
          affiliationStatus: "IN_PROCESS",
        },
      });
      return updated;
    }),

  addFollowUp: staffProcedure
    .input(
      z.object({
        id: z.string(),
        notes: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.medicaidEnrollment.findUnique({ where: { id: input.id } });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      const existingNotes = enrollment.notes ?? "";
      const timestamp = new Date().toLocaleString();
      const newNotes = `${existingNotes}\n[${timestamp}] ${input.notes}`.trim();

      const updated = await ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: {
          notes: newNotes,
          lastFollowUpDate: new Date(),
        },
      });
      return updated;
    }),

  updateGroupAffiliation: staffProcedure
    .input(
      z.object({
        id: z.string(),
        groupAffiliationUpdated: z.boolean(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.medicaidEnrollment.update({
        where: { id: input.id },
        data: { groupAffiliationUpdated: input.groupAffiliationUpdated },
      });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const enrollment = await ctx.db.medicaidEnrollment.findUnique({ where: { id: input.id } });
      if (!enrollment) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.medicaidEnrollment.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session.user.id,
        actorRole: ctx.session.user.role,
        action: "medicaid.enrollment.deleted",
        entityType: "MedicaidEnrollment",
        entityId: input.id,
        providerId: enrollment.providerId,
      });

      return { success: true };
    }),

  getSummary: staffProcedure
    .query(async ({ ctx }) => {
      const total = await ctx.db.medicaidEnrollment.count();
      if (total === 0) {
        return { total: 0, byStatus: {} as Record<string, number>, byPath: {} as Record<string, number> };
      }

      const [byStatus, byPath] = await Promise.all([
        ctx.db.medicaidEnrollment.groupBy({ by: ["affiliationStatus"], _count: { _all: true } }),
        ctx.db.medicaidEnrollment.groupBy({ by: ["enrollmentPath"], _count: { _all: true } }),
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s.affiliationStatus]: s._count._all }), {} as Record<string, number>),
        byPath: byPath.reduce((acc, p) => ({ ...acc, [p.enrollmentPath ?? "UNKNOWN"]: p._count._all }), {} as Record<string, number>),
      };
    }),
});
