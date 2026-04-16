/**
 * Sanctions policy constants and helpers.
 *
 * Source of truth for:
 *   - How frequently each sanctions source (OIG, SAM.gov) must be re-checked
 *     to stay NCQA-compliant.
 *   - Which results block the provider from moving forward in the pipeline
 *     and require a manager acknowledgement.
 *
 * Pure module. No I/O.
 */

import type { SanctionsResult, SanctionsSource } from "@prisma/client";

/**
 * NCQA standard 2023 (current) requires OIG + SAM.gov checks at least monthly.
 * Essen exceeds this by running weekly. The bot scheduler honours these
 * cadences when picking providers for its "due-now" queue.
 */
export const SANCTIONS_CADENCE_DAYS: Readonly<Record<SanctionsSource, number>> = {
  OIG: 7,
  SAM_GOV: 7,
};

export function sanctionsCadenceDays(source: SanctionsSource): number {
  return SANCTIONS_CADENCE_DAYS[source] ?? 30;
}

/**
 * FLAGGED is the universal "human must look at this" signal. CLEAR is the
 * happy path. This helper exists so callers never accidentally compare
 * against stale/undocumented result strings.
 */
export function isFlagged(result: SanctionsResult): boolean {
  return result === "FLAGGED";
}

/**
 * Any flagged result requires manager review before the provider can
 * progress to COMMITTEE_READY. Exposed as a separate helper so we can
 * expand the policy later (e.g., distinguishing possible-match vs.
 * definitive exclusion once the schema supports those subtypes).
 */
export function requiresReview(result: SanctionsResult): boolean {
  return isFlagged(result);
}

/**
 * Given the timestamp of the last successful check (or null), decide whether
 * the provider is due for re-check now. `now` is injectable for tests.
 */
export function isDueForRecheck(
  source: SanctionsSource,
  lastCheckedAt: Date | null | undefined,
  now: Date = new Date(),
): boolean {
  if (!lastCheckedAt) return true;
  const cadenceMs = sanctionsCadenceDays(source) * 24 * 60 * 60 * 1000;
  return now.getTime() - lastCheckedAt.getTime() >= cadenceMs;
}
