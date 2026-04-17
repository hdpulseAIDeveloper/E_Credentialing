/**
 * P3 Gap #22 — Behavioral health tRPC router.
 *
 * Manages:
 *   • Provider-profile behavioral-health metadata (taxonomy, provisional flag).
 *   • Supervision attestations for provisionally-licensed clinicians.
 *   • BCBS fast-track eligibility evaluation + submission tracking.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  staffProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import { SupervisionAttestationStatus, type Prisma } from "@prisma/client";
import {
  deriveIsBehavioralHealth,
  evaluateBcbsFastTrackEligibility,
  isBehavioralHealthTaxonomy,
  nextAttestationPeriod,
} from "@/lib/behavioral-health";
import { writeAuditLog } from "@/lib/audit";

export const behavioralHealthRouter = createTRPCRouter({
  // ─── Profile metadata ───────────────────────────────────────────────
  updateTaxonomy: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        nuccTaxonomyPrimary: z.string().nullable().optional(),
        nuccTaxonomySecondary: z.array(z.string()).optional(),
        isProvisionallyLicensed: z.boolean().optional(),
        provisionalLicenseExpires: z.string().datetime().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.providerProfile.findUnique({
        where: { providerId: input.providerId },
      });
      if (!profile) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Provider profile not found" });
      }
      const before = {
        nuccTaxonomyPrimary: profile.nuccTaxonomyPrimary,
        nuccTaxonomySecondary: profile.nuccTaxonomySecondary,
        isBehavioralHealth: profile.isBehavioralHealth,
        isProvisionallyLicensed: profile.isProvisionallyLicensed,
      };
      const isBh = deriveIsBehavioralHealth(
        input.nuccTaxonomyPrimary ?? profile.nuccTaxonomyPrimary,
        input.nuccTaxonomySecondary ?? profile.nuccTaxonomySecondary
      );
      const updated = await ctx.db.providerProfile.update({
        where: { providerId: input.providerId },
        data: {
          nuccTaxonomyPrimary:
            input.nuccTaxonomyPrimary !== undefined
              ? input.nuccTaxonomyPrimary
              : profile.nuccTaxonomyPrimary,
          nuccTaxonomySecondary:
            input.nuccTaxonomySecondary ?? profile.nuccTaxonomySecondary,
          isBehavioralHealth: isBh,
          isProvisionallyLicensed:
            input.isProvisionallyLicensed ?? profile.isProvisionallyLicensed,
          provisionalLicenseExpires:
            input.provisionalLicenseExpires !== undefined
              ? input.provisionalLicenseExpires
                ? new Date(input.provisionalLicenseExpires)
                : null
              : profile.provisionalLicenseExpires,
        },
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "UPDATE",
        entityType: "ProviderProfile",
        entityId: input.providerId,
        providerId: input.providerId,
        beforeState: before,
        afterState: {
          nuccTaxonomyPrimary: updated.nuccTaxonomyPrimary,
          nuccTaxonomySecondary: updated.nuccTaxonomySecondary,
          isBehavioralHealth: updated.isBehavioralHealth,
          isProvisionallyLicensed: updated.isProvisionallyLicensed,
        },
      });
      return updated;
    }),

  classifyTaxonomy: staffProcedure
    .input(z.object({ code: z.string() }))
    .query(({ input }) => ({
      code: input.code,
      isBehavioralHealth: isBehavioralHealthTaxonomy(input.code),
    })),

  // ─── Supervision attestations ───────────────────────────────────────
  listAttestations: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      ctx.db.supervisionAttestation.findMany({
        where: { providerId: input.providerId },
        orderBy: { periodEnd: "desc" },
      })
    ),

  createAttestation: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        supervisorName: z.string().min(2),
        supervisorLicenseNum: z.string().min(2),
        supervisorLicenseState: z.string().length(2),
        supervisorLicenseType: z.string().optional(),
        supervisorEmail: z.string().email(),
        periodStart: z.string().datetime().optional(),
        periodEnd: z.string().datetime().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Auto-derive next period if caller didn't pass one.
      let periodStart = input.periodStart ? new Date(input.periodStart) : null;
      let periodEnd = input.periodEnd ? new Date(input.periodEnd) : null;
      if (!periodStart || !periodEnd) {
        const last = await ctx.db.supervisionAttestation.findFirst({
          where: { providerId: input.providerId, status: "ACCEPTED" },
          orderBy: { periodEnd: "desc" },
        });
        const next = nextAttestationPeriod(last?.periodEnd ?? null);
        periodStart ??= next.periodStart;
        periodEnd ??= next.periodEnd;
      }
      const created = await ctx.db.supervisionAttestation.create({
        data: {
          providerId: input.providerId,
          supervisorName: input.supervisorName,
          supervisorLicenseNum: input.supervisorLicenseNum,
          supervisorLicenseState: input.supervisorLicenseState.toUpperCase(),
          supervisorLicenseType: input.supervisorLicenseType,
          supervisorEmail: input.supervisorEmail,
          periodStart,
          periodEnd,
          notes: input.notes,
          status: "DRAFT",
        },
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "CREATE",
        entityType: "SupervisionAttestation",
        entityId: created.id,
        providerId: input.providerId,
        afterState: {
          status: created.status,
          periodEnd: created.periodEnd.toISOString(),
        },
      });
      return created;
    }),

  updateAttestation: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        hoursDirect: z.number().min(0).optional(),
        hoursIndirect: z.number().min(0).optional(),
        attestationDate: z.string().datetime().nullable().optional(),
        attestationDocBlobUrl: z.string().url().nullable().optional(),
        status: z.nativeEnum(SupervisionAttestationStatus).optional(),
        notes: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.supervisionAttestation.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      const data: Prisma.SupervisionAttestationUpdateInput = {};
      if (input.hoursDirect !== undefined) data.hoursDirect = input.hoursDirect;
      if (input.hoursIndirect !== undefined) data.hoursIndirect = input.hoursIndirect;
      if (input.attestationDate !== undefined) {
        data.attestationDate = input.attestationDate
          ? new Date(input.attestationDate)
          : null;
      }
      if (input.attestationDocBlobUrl !== undefined) {
        data.attestationDocBlobUrl = input.attestationDocBlobUrl;
      }
      if (input.status !== undefined) data.status = input.status;
      if (input.notes !== undefined) data.notes = input.notes;

      const updated = await ctx.db.supervisionAttestation.update({
        where: { id: input.id },
        data,
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "UPDATE",
        entityType: "SupervisionAttestation",
        entityId: input.id,
        providerId: existing.providerId,
        beforeState: { status: existing.status, hoursDirect: existing.hoursDirect },
        afterState: { status: updated.status, hoursDirect: updated.hoursDirect },
      });
      return updated;
    }),

  // ─── BCBS fast-track ────────────────────────────────────────────────
  evaluateBcbs: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(({ ctx, input }) =>
      evaluateBcbsFastTrackEligibility(ctx.db, input.providerId)
    ),

  markBcbsSubmitted: managerProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        bcbsRefId: z.string().optional(),
        status: z.string().default("SUBMITTED"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const profile = await ctx.db.providerProfile.update({
        where: { providerId: input.providerId },
        data: {
          bcbsFastTrackEligible: true,
          bcbsFastTrackSubmittedAt: new Date(),
          bcbsFastTrackStatus: input.status,
          bcbsFastTrackRefId: input.bcbsRefId ?? null,
        },
      });
      await writeAuditLog({
        actorId: ctx.session.user.id,
        action: "UPDATE",
        entityType: "ProviderProfile",
        entityId: input.providerId,
        providerId: input.providerId,
        afterState: {
          bcbsFastTrackStatus: profile.bcbsFastTrackStatus,
          bcbsFastTrackRefId: profile.bcbsFastTrackRefId,
        },
      });
      return profile;
    }),

  // ─── Roster / dashboard ─────────────────────────────────────────────
  rosterCounts: staffProcedure.query(async ({ ctx }) => {
    const [bh, provisional, expiringSoon, missingAttestation] = await Promise.all([
      ctx.db.providerProfile.count({ where: { isBehavioralHealth: true } }),
      ctx.db.providerProfile.count({
        where: { isBehavioralHealth: true, isProvisionallyLicensed: true },
      }),
      ctx.db.providerProfile.count({
        where: {
          isProvisionallyLicensed: true,
          provisionalLicenseExpires: {
            lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
            gte: new Date(),
          },
        },
      }),
      ctx.db.providerProfile.count({
        where: {
          isProvisionallyLicensed: true,
          provider: {
            supervisionAttestations: {
              none: {
                status: "ACCEPTED",
                periodEnd: { gte: new Date() },
              },
            },
          },
        },
      }),
    ]);
    return { bh, provisional, expiringSoon, missingAttestation };
  }),
});
