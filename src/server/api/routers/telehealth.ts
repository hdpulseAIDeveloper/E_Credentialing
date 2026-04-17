/**
 * P1 Gap #15 — Telehealth router.
 *
 * Three concerns live here:
 *   1. Per-platform telehealth certifications (Teladoc / Amwell / etc.)
 *   2. IMLC eligibility evaluation + LoQ tracking on ProviderProfile
 *   3. Coverage gap analysis between declared telehealth states and
 *      active state licenses + IMLC member-state grants
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { TelehealthPlatformCertStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  evaluateImlcEligibility,
  evaluateTelehealthCoverage,
  IMLC_MEMBER_STATES,
} from "@/lib/telehealth";

const TWO_LETTER_STATE = z
  .string()
  .length(2)
  .transform((s) => s.toUpperCase());

export const telehealthRouter = createTRPCRouter({
  // ─── Platform certifications ─────────────────────────────────────────────
  listCerts: staffProcedure
    .input(z.object({ providerId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.telehealthPlatformCert.findMany({
        where: { providerId: input.providerId },
        orderBy: [{ status: "asc" }, { platformName: "asc" }],
      })
    ),

  upsertCert: staffProcedure
    .input(
      z.object({
        id: z.string().optional(),
        providerId: z.string(),
        platformName: z.string().min(1).max(100),
        certificateNumber: z.string().optional().nullable(),
        status: z.nativeEnum(TelehealthPlatformCertStatus),
        trainingStartedAt: z.string().datetime().optional().nullable(),
        trainingCompletedAt: z.string().datetime().optional().nullable(),
        certifiedAt: z.string().datetime().optional().nullable(),
        expiresAt: z.string().datetime().optional().nullable(),
        documentBlobUrl: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, providerId, platformName, ...rest } = input;
      const data = {
        certificateNumber: rest.certificateNumber ?? null,
        status: rest.status,
        trainingStartedAt: rest.trainingStartedAt ? new Date(rest.trainingStartedAt) : null,
        trainingCompletedAt: rest.trainingCompletedAt ? new Date(rest.trainingCompletedAt) : null,
        certifiedAt: rest.certifiedAt ? new Date(rest.certifiedAt) : null,
        expiresAt: rest.expiresAt ? new Date(rest.expiresAt) : null,
        documentBlobUrl: rest.documentBlobUrl ?? null,
        notes: rest.notes ?? null,
      };

      const cert = id
        ? await ctx.db.telehealthPlatformCert.update({
            where: { id },
            data: { ...data, platformName },
          })
        : await ctx.db.telehealthPlatformCert.create({
            data: { ...data, providerId, platformName },
          });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: id ? "telehealth.cert.updated" : "telehealth.cert.created",
        entityType: "TelehealthPlatformCert",
        entityId: cert.id,
        providerId,
      });

      return cert;
    }),

  deleteCert: staffProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const cert = await ctx.db.telehealthPlatformCert.findUnique({ where: { id: input.id } });
      if (!cert) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.telehealthPlatformCert.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "telehealth.cert.deleted",
        entityType: "TelehealthPlatformCert",
        entityId: input.id,
        providerId: cert.providerId,
      });
      return { success: true };
    }),

  // ─── IMLC eligibility + LoQ ─────────────────────────────────────────────
  evaluateImlc: staffProcedure
    .input(z.object({ providerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
        include: {
          providerType: true,
          licenses: true,
          profile: true,
          verificationRecords: {
            where: { credentialType: { in: ["BOARD_NCCPA", "BOARD_ABIM", "BOARD_ABFM", "BOARD_OTHER"] } },
            orderBy: { verifiedDate: "desc" },
            take: 5,
          },
          npdbRecords: { orderBy: { queryDate: "desc" }, take: 1 },
        },
      });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      const hasBoardCertification = provider.verificationRecords.some(
        (v) => v.status === "VERIFIED"
      );
      const hasActiveDea = !!provider.deaNumber;
      // Treat completed onboarding as proxy for completed training history;
      // tightening this requires education-records review (out of scope for now).
      const hasCompletedTraining = provider.applicationSubmittedAt != null;
      const hasOpenDiscipline = provider.licenses.some(
        (l) => l.status === "REVOKED" || l.status === "SUSPENDED"
      );
      // NPDB findings are stored as a JSON `reports` array; treat any
      // record with at least one report as a flag for further review.
      const hasCriminalHistory = provider.npdbRecords.some(
        (r) => r.result === "REPORTS_FOUND" && r.reportCount > 0
      );

      return evaluateImlcEligibility({
        providerTypeAbbrev: provider.providerType.abbreviation,
        licenses: provider.licenses.map((l) => ({
          state: l.state,
          status: l.status,
          isPrimary: l.isPrimary,
          hasRestriction:
            l.status === "REVOKED" || l.status === "SUSPENDED",
        })),
        hasBoardCertification,
        hasActiveDea,
        hasCompletedTraining,
        hasOpenDiscipline,
        hasCriminalHistory,
      });
    }),

  updateImlcRecord: staffProcedure
    .input(
      z.object({
        providerId: z.string(),
        imlcEligible: z.boolean().nullable(),
        imlcSpl: TWO_LETTER_STATE.optional().nullable(),
        imlcLoqIssuedDate: z.string().datetime().optional().nullable(),
        imlcLoqExpiresAt: z.string().datetime().optional().nullable(),
        imlcLoqDocumentBlobUrl: z.string().optional().nullable(),
        imlcMemberStatesGranted: z.array(TWO_LETTER_STATE).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const fields = {
        imlcEligible: input.imlcEligible,
        imlcSpl: input.imlcSpl ?? null,
        imlcLoqIssuedDate: input.imlcLoqIssuedDate ? new Date(input.imlcLoqIssuedDate) : null,
        imlcLoqExpiresAt: input.imlcLoqExpiresAt ? new Date(input.imlcLoqExpiresAt) : null,
        imlcLoqDocumentBlobUrl: input.imlcLoqDocumentBlobUrl ?? null,
        imlcMemberStatesGranted: input.imlcMemberStatesGranted ?? [],
      };

      await ctx.db.providerProfile.upsert({
        where: { providerId: input.providerId },
        update: fields,
        create: { providerId: input.providerId, ...fields },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "telehealth.imlc.updated",
        entityType: "ProviderProfile",
        entityId: input.providerId,
        providerId: input.providerId,
      });

      return { success: true };
    }),

  // ─── Coverage gap analysis ──────────────────────────────────────────────
  coverage: staffProcedure
    .input(z.object({ providerId: z.string() }))
    .query(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
        include: {
          licenses: true,
          profile: { select: { teleHealthStates: true, imlcMemberStatesGranted: true } },
        },
      });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      const declared = provider.profile?.teleHealthStates ?? [];
      const result = evaluateTelehealthCoverage({
        declaredStates: declared,
        licenses: provider.licenses.map((l) => ({ state: l.state, status: l.status })),
        imlcMemberStatesGranted: provider.profile?.imlcMemberStatesGranted ?? [],
      });

      return {
        ...result,
        imlcMemberStates: Array.from(IMLC_MEMBER_STATES),
      };
    }),
});
