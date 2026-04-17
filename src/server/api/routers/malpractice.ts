/**
 * P1 Gap #12 — Malpractice Carrier Verification router.
 *
 * Outreach-bot pattern (mirrors workHistory / reference routers):
 *   create → sendRequest → sendReminder → submitResponse → threshold check
 *
 * On submitResponse we compare the carrier-reported per-occurrence /
 * aggregate limits against the matching FacilityCoverageMinimum row. If
 * either falls short — or the policy is expired/about-to-expire — we raise
 * a MonitoringAlert so the credentialing specialist sees it next time they
 * load the dashboard.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  publicProcedure,
  staffProcedure,
} from "@/server/api/trpc";
import type {
  MalpracticeVerificationStatus,
  PrismaClient,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  sendCarrierVerificationEmail,
  tryEmail,
} from "@/lib/email/verifications";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";

const SOON_TO_EXPIRE_DAYS = 30;

function dollarsToCents(value: number | null | undefined): bigint | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  return BigInt(Math.round(value * 100));
}

function centsToDollarsLabel(cents: bigint | null | undefined): string {
  if (cents === null || cents === undefined) return "—";
  const dollars = Number(cents) / 100;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(dollars);
}

/**
 * Picks the best-matching FacilityCoverageMinimum for a provider.
 * Strategy: explicit facility match > state default > NY hospital baseline.
 */
async function pickFacilityMinimum(
  db: PrismaClient,
  providerId: string,
  facilityName: string | undefined
): Promise<{
  facilityName: string;
  minPerOccurrenceCents: bigint;
  minAggregateCents: bigint;
} | null> {
  if (facilityName) {
    const exact = await db.facilityCoverageMinimum.findUnique({
      where: { facilityName },
    });
    if (exact && exact.isActive) {
      return {
        facilityName: exact.facilityName,
        minPerOccurrenceCents: exact.minPerOccurrenceCents,
        minAggregateCents: exact.minAggregateCents,
      };
    }
  }

  // Try the provider's primary facility from the profile.
  const profile = await db.providerProfile.findUnique({
    where: { providerId },
    select: { facilityAssignment: true },
  });
  if (profile?.facilityAssignment) {
    const fromProfile = await db.facilityCoverageMinimum.findUnique({
      where: { facilityName: profile.facilityAssignment },
    });
    if (fromProfile && fromProfile.isActive) {
      return {
        facilityName: fromProfile.facilityName,
        minPerOccurrenceCents: fromProfile.minPerOccurrenceCents,
        minAggregateCents: fromProfile.minAggregateCents,
      };
    }
  }

  // Fall back to the seeded NY hospital baseline.
  const fallback = await db.facilityCoverageMinimum.findFirst({
    where: { facilityName: "Default (NY hospital baseline)", isActive: true },
  });
  if (!fallback) return null;
  return {
    facilityName: fallback.facilityName,
    minPerOccurrenceCents: fallback.minPerOccurrenceCents,
    minAggregateCents: fallback.minAggregateCents,
  };
}

export const malpracticeRouter = createTRPCRouter({
  // ─── List verifications for a provider ────────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const rows = await ctx.db.malpracticeVerification.findMany({
        where: { providerId: input.providerId },
        orderBy: { createdAt: "desc" },
      });
      // BigInt → string for tRPC serialization.
      return rows.map((r) => ({
        ...r,
        reportedPerOccurrenceCents: r.reportedPerOccurrenceCents?.toString() ?? null,
        reportedAggregateCents: r.reportedAggregateCents?.toString() ?? null,
        reportedPerOccurrenceLabel: centsToDollarsLabel(r.reportedPerOccurrenceCents),
        reportedAggregateLabel: centsToDollarsLabel(r.reportedAggregateCents),
      }));
    }),

  // ─── List facility coverage minimums (for admin & dropdowns) ─────────
  listFacilityMinimums: staffProcedure.query(async ({ ctx }) => {
    const rows = await ctx.db.facilityCoverageMinimum.findMany({
      where: { isActive: true },
      orderBy: { facilityName: "asc" },
    });
    return rows.map((r) => ({
      ...r,
      minPerOccurrenceCents: r.minPerOccurrenceCents.toString(),
      minAggregateCents: r.minAggregateCents.toString(),
      minPerOccurrenceLabel: centsToDollarsLabel(r.minPerOccurrenceCents),
      minAggregateLabel: centsToDollarsLabel(r.minAggregateCents),
    }));
  }),

  // ─── Create verification record ──────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        carrierName: z.string().min(1),
        contactName: z.string().optional(),
        contactEmail: z.string().email().optional(),
        contactPhone: z.string().optional(),
        policyNumber: z.string().optional(),
        expectedExpDate: z.coerce.date().optional(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
        select: { id: true },
      });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      const record = await ctx.db.malpracticeVerification.create({
        data: { ...input },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "malpractice.verification.created",
        entityType: "MalpracticeVerification",
        entityId: record.id,
        providerId: input.providerId,
        afterState: {
          carrierName: input.carrierName,
          contactEmail: input.contactEmail,
        },
      });

      return { id: record.id };
    }),

  // ─── Send (or resend) the verification request ───────────────────────
  sendRequest: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.malpracticeVerification.findUnique({
        where: { id: input.id },
        include: {
          provider: { select: { legalFirstName: true, legalLastName: true } },
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (!existing.contactEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot send verification: carrier contact email is missing on this record.",
        });
      }

      const providerName =
        `${existing.provider.legalFirstName} ${existing.provider.legalLastName}`.trim();

      const result = await tryEmail(() =>
        sendCarrierVerificationEmail({
          to: existing.contactEmail!,
          contactName: existing.contactName,
          carrierName: existing.carrierName,
          providerName,
          responseToken: existing.responseToken,
          policyNumber: existing.policyNumber,
          expectedExpDate: existing.expectedExpDate,
        })
      );

      const updated = await ctx.db.malpracticeVerification.update({
        where: { id: input.id },
        data: {
          status: "SENT" satisfies MalpracticeVerificationStatus,
          requestSentAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "malpractice.verification.sent",
        entityType: "MalpracticeVerification",
        entityId: input.id,
        providerId: existing.providerId,
        afterState: {
          to: existing.contactEmail,
          delivered: result.delivered,
          messageId: result.messageId,
          reason: result.reason ?? null,
        },
      });

      return {
        id: updated.id,
        emailDelivered: result.delivered,
        emailReason: result.reason,
      };
    }),

  // ─── Send a reminder ─────────────────────────────────────────────────
  sendReminder: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.malpracticeVerification.findUnique({
        where: { id: input.id },
        include: {
          provider: { select: { legalFirstName: true, legalLastName: true } },
        },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
      if (!existing.contactEmail) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Cannot send reminder: carrier contact email is missing on this record.",
        });
      }

      const providerName =
        `${existing.provider.legalFirstName} ${existing.provider.legalLastName}`.trim();

      const result = await tryEmail(() =>
        sendCarrierVerificationEmail({
          to: existing.contactEmail!,
          contactName: existing.contactName,
          carrierName: existing.carrierName,
          providerName,
          responseToken: existing.responseToken,
          isReminder: true,
          policyNumber: existing.policyNumber,
          expectedExpDate: existing.expectedExpDate,
        })
      );

      await ctx.db.malpracticeVerification.update({
        where: { id: input.id },
        data: {
          status: "REMINDER_SENT" satisfies MalpracticeVerificationStatus,
          lastReminderAt: new Date(),
          reminderCount: { increment: 1 },
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "malpractice.reminder.sent",
        entityType: "MalpracticeVerification",
        entityId: input.id,
        providerId: existing.providerId,
        afterState: {
          to: existing.contactEmail,
          delivered: result.delivered,
          reason: result.reason ?? null,
        },
      });

      return {
        id: input.id,
        emailDelivered: result.delivered,
        emailReason: result.reason,
      };
    }),

  // ─── Public token-bound submission by the carrier ────────────────────
  submitResponse: publicProcedure
    .input(
      z.object({
        token: z.string().uuid(),
        // Coverage limits in dollars (whole-number). Form converts to cents.
        perOccurrenceUsd: z.number().nonnegative(),
        aggregateUsd: z.number().nonnegative(),
        effectiveDate: z.coerce.date(),
        expirationDate: z.coerce.date(),
        claimsHistory: z.string().optional(),
        confirmedByName: z.string().min(1),
        confirmedByTitle: z.string().optional(),
        additionalComments: z.string().optional(),
        // Allow the carrier to indicate the relevant Essen facility so we
        // pick the right minimum during the threshold compare.
        facilityName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.malpracticeVerification.findUnique({
        where: { responseToken: input.token },
      });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invalid or expired verification link.",
        });
      }
      if (existing.status === ("RECEIVED" satisfies MalpracticeVerificationStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "This verification has already been submitted.",
        });
      }

      const perOccCents = dollarsToCents(input.perOccurrenceUsd)!;
      const aggCents = dollarsToCents(input.aggregateUsd)!;
      const minimum = await pickFacilityMinimum(
        ctx.db,
        existing.providerId,
        input.facilityName
      );

      // ── Threshold compare ────────────────────────────────────────────
      const issues: string[] = [];
      let thresholdMet = true;

      if (minimum) {
        if (perOccCents < minimum.minPerOccurrenceCents) {
          issues.push(
            `Per-occurrence limit ${centsToDollarsLabel(perOccCents)} is below ${minimum.facilityName} minimum ${centsToDollarsLabel(minimum.minPerOccurrenceCents)}.`
          );
          thresholdMet = false;
        }
        if (aggCents < minimum.minAggregateCents) {
          issues.push(
            `Aggregate limit ${centsToDollarsLabel(aggCents)} is below ${minimum.facilityName} minimum ${centsToDollarsLabel(minimum.minAggregateCents)}.`
          );
          thresholdMet = false;
        }
      } else {
        issues.push(
          "No facility minimum on file — manual review required to confirm coverage adequacy."
        );
      }

      const now = Date.now();
      const expSoonMs = SOON_TO_EXPIRE_DAYS * 24 * 60 * 60 * 1000;
      if (input.expirationDate.getTime() < now) {
        issues.push(
          `Reported expiration date ${input.expirationDate.toISOString().slice(0, 10)} has already passed.`
        );
        thresholdMet = false;
      } else if (input.expirationDate.getTime() - now < expSoonMs) {
        issues.push(
          `Coverage expires within ${SOON_TO_EXPIRE_DAYS} days (${input.expirationDate.toISOString().slice(0, 10)}); request renewal documentation.`
        );
      }

      const responseFields = {
        confirmedByName: input.confirmedByName,
        confirmedByTitle: input.confirmedByTitle,
        additionalComments: input.additionalComments,
        facilityName: input.facilityName,
        comparedAgainst: minimum
          ? {
              facilityName: minimum.facilityName,
              minPerOccurrence: centsToDollarsLabel(minimum.minPerOccurrenceCents),
              minAggregate: centsToDollarsLabel(minimum.minAggregateCents),
            }
          : null,
      };

      // ── Persist ──────────────────────────────────────────────────────
      const updated = await ctx.db.malpracticeVerification.update({
        where: { responseToken: input.token },
        data: {
          status: "RECEIVED" satisfies MalpracticeVerificationStatus,
          receivedAt: new Date(),
          reportedPerOccurrenceCents: perOccCents,
          reportedAggregateCents: aggCents,
          reportedEffectiveDate: input.effectiveDate,
          reportedExpirationDate: input.expirationDate,
          reportedClaimsHistory: input.claimsHistory,
          responseData: responseFields as never,
          thresholdMet,
          thresholdNotes: issues.length > 0 ? issues.join("\n") : null,
        },
      });

      // ── Raise MonitoringAlert if anything was flagged ────────────────
      if (!thresholdMet) {
        const expired = input.expirationDate.getTime() < now;
        const alertId = await createMonitoringAlert(ctx.db, {
          providerId: existing.providerId,
          type: expired
            ? "MALPRACTICE_COVERAGE_LAPSED"
            : "MALPRACTICE_COVERAGE_BELOW_MIN",
          severity: "CRITICAL",
          source: "MALPRACTICE_CARRIER_VERIFICATION",
          title: expired
            ? `Malpractice coverage lapsed (${existing.carrierName})`
            : `Malpractice coverage below facility minimum (${existing.carrierName})`,
          description: issues.join(" "),
          evidence: {
            verificationId: existing.id,
            carrierName: existing.carrierName,
            policyNumber: existing.policyNumber,
            reportedPerOccurrence: centsToDollarsLabel(perOccCents),
            reportedAggregate: centsToDollarsLabel(aggCents),
            reportedExpirationDate: input.expirationDate.toISOString(),
            facilityMinimum: minimum
              ? {
                  facilityName: minimum.facilityName,
                  minPerOccurrence: centsToDollarsLabel(minimum.minPerOccurrenceCents),
                  minAggregate: centsToDollarsLabel(minimum.minAggregateCents),
                }
              : null,
          },
        });
        if (alertId) {
          await ctx.db.malpracticeVerification.update({
            where: { id: existing.id },
            data: { monitoringAlertId: alertId },
          });
        }
      }

      await writeAuditLog({
        actorId: null,
        actorRole: null,
        action: "malpractice.response.submitted",
        entityType: "MalpracticeVerification",
        entityId: existing.id,
        providerId: existing.providerId,
        afterState: {
          thresholdMet,
          issues,
          perOccurrence: centsToDollarsLabel(perOccCents),
          aggregate: centsToDollarsLabel(aggCents),
        },
      });

      return {
        success: true,
        id: updated.id,
        thresholdMet,
        issues,
      };
    }),

  // ─── Public read for the carrier-facing form ─────────────────────────
  getByToken: publicProcedure
    .input(z.object({ token: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await ctx.db.malpracticeVerification.findUnique({
        where: { responseToken: input.token },
        include: {
          provider: {
            select: { legalFirstName: true, legalLastName: true, npi: true },
          },
        },
      });
      if (!row) return null;
      return {
        id: row.id,
        carrierName: row.carrierName,
        contactName: row.contactName,
        policyNumber: row.policyNumber,
        expectedExpDate: row.expectedExpDate,
        status: row.status,
        receivedAt: row.receivedAt,
        provider: row.provider,
      };
    }),

  // ─── Delete a verification record ────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.malpracticeVerification.findUnique({
        where: { id: input.id },
      });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND" });

      await ctx.db.malpracticeVerification.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "malpractice.verification.deleted",
        entityType: "MalpracticeVerification",
        entityId: input.id,
        providerId: existing.providerId,
        beforeState: {
          carrierName: existing.carrierName,
          status: existing.status,
        },
      });

      return { success: true };
    }),
});
