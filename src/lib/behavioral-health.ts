/**
 * P3 Gap #22 — Behavioral health helpers.
 *
 * Three concerns live here:
 *   1. NUCC taxonomy classification (which codes count as behavioral health)
 *   2. Supervision attestation expectations (period cadence, hours floor)
 *   3. BCBS fast-track eligibility evaluation
 *
 * The actual integrations (BCBS portal, supervisor outreach emails) live
 * in dedicated bots/email helpers; this module is the source of truth for
 * the rules.
 */

import type { PrismaClient } from "@prisma/client";

/**
 * NUCC taxonomy roots that we treat as behavioral health for routing,
 * roster generation, and BCBS fast-track. The list is intentionally
 * conservative — admins can add more via a future provider-types editor.
 *
 * Reference: https://taxonomy.nucc.org/
 */
const BEHAVIORAL_HEALTH_TAXONOMY_PREFIXES = [
  "101Y", // Counselor (incl. Mental Health 101YM0800X)
  "103T", // Psychologist (clinical, school, etc.)
  "104100", // Social Worker
  "1041C", // Clinical Social Worker
  "1041S", // School Social Worker
  "106H",  // Marriage & Family Therapist
  "175L00000X", // Homeopath - excluded; just sample
  "163WP0807X", // Psychiatric/Mental Health Nurse Practitioner
  "2084P0800X", // Psychiatry (MD/DO)
  "2084P0802X", // Addiction Psychiatry
  "2084P0805X", // Geriatric Psychiatry
  "2084P0804X", // Child & Adolescent Psychiatry
];

/**
 * Some specific codes that should always count as behavioral health, even
 * when their root prefix isn't in the list (defensive).
 */
const BEHAVIORAL_HEALTH_EXACT_CODES = new Set([
  "101YM0800X", // Mental Health Counselor
  "101YA0400X", // Addiction (Substance Use Disorder) Counselor
  "101YP2500X", // Professional Counselor
  "101YS0200X", // School Counselor
  "106H00000X", // Marriage & Family Therapist
]);

export function isBehavioralHealthTaxonomy(code: string | null | undefined): boolean {
  if (!code) return false;
  const normalized = code.trim().toUpperCase();
  if (BEHAVIORAL_HEALTH_EXACT_CODES.has(normalized)) return true;
  return BEHAVIORAL_HEALTH_TAXONOMY_PREFIXES.some((prefix) =>
    normalized.startsWith(prefix.toUpperCase())
  );
}

/**
 * Compute whether a provider's profile already satisfies the behavioral
 * health flag based on their primary/secondary taxonomies.
 */
export function deriveIsBehavioralHealth(
  primary: string | null | undefined,
  secondary: string[] | null | undefined
): boolean {
  if (isBehavioralHealthTaxonomy(primary)) return true;
  return (secondary ?? []).some(isBehavioralHealthTaxonomy);
}

/**
 * Quarterly attestation cadence for provisionally-licensed clinicians.
 * Returns the next expected period for a provider given their last
 * accepted attestation.
 */
export function nextAttestationPeriod(lastPeriodEnd: Date | null): {
  periodStart: Date;
  periodEnd: Date;
} {
  const now = new Date();
  const start = lastPeriodEnd && lastPeriodEnd > new Date(0)
    ? new Date(lastPeriodEnd.getTime() + 1)
    : new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 0);
  return { periodStart: start, periodEnd: end };
}

/**
 * BCBS fast-track behavioral-health eligibility rules:
 *   • Provider is flagged as behavioral health
 *   • At least one active license in a participating state (we accept all
 *     US states for now; payer-specific filtering happens in the bot)
 *   • Either fully licensed (not provisional) OR has a current accepted
 *     supervision attestation on file
 *   • At least one verified board cert OR psychologist/social-worker
 *     license-type designation
 */
export interface BcbsEligibilityResult {
  eligible: boolean;
  reasons: string[];
}

export async function evaluateBcbsFastTrackEligibility(
  db: PrismaClient,
  providerId: string
): Promise<BcbsEligibilityResult> {
  const reasons: string[] = [];
  const provider = await db.provider.findUnique({
    where: { id: providerId },
    include: {
      profile: true,
      licenses: { where: { status: "ACTIVE" } },
      verificationRecords: {
        where: {
          status: "VERIFIED",
          credentialType: { in: ["BOARD_NCCPA", "BOARD_ABIM", "BOARD_ABFM", "BOARD_OTHER"] },
        },
        take: 1,
      },
      supervisionAttestations: {
        where: { status: "ACCEPTED" },
        orderBy: { periodEnd: "desc" },
        take: 1,
      },
    },
  });

  if (!provider) {
    return { eligible: false, reasons: ["Provider not found"] };
  }

  const profile = provider.profile;
  const isBh =
    profile?.isBehavioralHealth ||
    deriveIsBehavioralHealth(
      profile?.nuccTaxonomyPrimary ?? null,
      profile?.nuccTaxonomySecondary ?? []
    );
  if (!isBh) {
    reasons.push("Provider is not flagged as behavioral health");
  }

  if (provider.licenses.length === 0) {
    reasons.push("No active licenses on file");
  }

  if (profile?.isProvisionallyLicensed) {
    const latest = provider.supervisionAttestations[0];
    if (!latest) {
      reasons.push("Provisional license but no accepted supervision attestation");
    } else if (latest.periodEnd < new Date()) {
      reasons.push("Most recent supervision attestation period has expired");
    }
  }

  return { eligible: reasons.length === 0, reasons };
}
