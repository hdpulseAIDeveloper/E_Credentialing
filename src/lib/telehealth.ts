/**
 * P1 Gap #15 — Telehealth helpers.
 *
 * Two pieces of logic live here:
 *
 *  1. IMLC eligibility evaluation. The Interstate Medical Licensure Compact
 *     defines a fixed set of eligibility criteria. We compute eligibility
 *     locally from already-captured provider data so staff can request a
 *     Letter of Qualification from the SPL board with confidence.
 *
 *  2. Telehealth coverage gap detection. A provider is only allowed to
 *     practice telehealth in a state where they hold an active license
 *     (or where they hold a valid IMLC member-state grant). This module
 *     surfaces every state where the provider's declared telehealth
 *     practice is NOT backed by a valid credential.
 */

// Current IMLC member states/territories (as of 2026). When new states join
// the compact, add them here — the upstream source is
// https://www.imlcc.org/a-faster-pathway-to-physician-licensure/
// Tracking this in code (rather than a DB table) keeps the policy
// auditable in version control.
export const IMLC_MEMBER_STATES = new Set<string>([
  "AL", "AZ", "CO", "DC", "DE", "GA", "GU", "IA", "ID", "IL", "IN", "KS",
  "KY", "LA", "ME", "MD", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH",
  "NJ", "NM", "NC", "ND", "OH", "OK", "PA", "SC", "SD", "TN", "UT", "VT",
  "VA", "WA", "WV", "WI", "WY",
]);

export interface ImlcEligibilityInput {
  /** Two-letter abbreviation of provider type (e.g. "MD", "DO"). Only MD/DO qualify. */
  providerTypeAbbrev: string;
  /** Active full unrestricted licenses across states. */
  licenses: Array<{
    state: string;
    status: string;
    isPrimary?: boolean | null;
    hasRestriction?: boolean | null;
  }>;
  /** Whether the provider holds a current ABMS / AOA board certification. */
  hasBoardCertification: boolean;
  /** Active DEA registration. */
  hasActiveDea: boolean;
  /** Has graduated from an accredited medical school + completed approved residency. */
  hasCompletedTraining: boolean;
  /** Open or final disciplinary actions on any license. */
  hasOpenDiscipline: boolean;
  /** Pending or unresolved felony / misdemeanor convictions related to practice. */
  hasCriminalHistory: boolean;
}

export interface ImlcEligibilityResult {
  eligible: boolean;
  /** Recommended State of Principal License (SPL) — typically the primary, IMLC-member license. */
  splCandidate?: string;
  reasons: string[];
}

export function evaluateImlcEligibility(
  input: ImlcEligibilityInput
): ImlcEligibilityResult {
  const reasons: string[] = [];

  // 1. Only MD/DO qualify under IMLC.
  if (!["MD", "DO"].includes(input.providerTypeAbbrev.toUpperCase())) {
    reasons.push(
      `Provider type ${input.providerTypeAbbrev} is not eligible — IMLC is open to MD and DO only.`
    );
  }

  // 2. Must hold at least one full unrestricted active license in an IMLC member state.
  const memberStateLicenses = input.licenses.filter(
    (l) =>
      l.status?.toUpperCase() === "ACTIVE" &&
      !l.hasRestriction &&
      IMLC_MEMBER_STATES.has(l.state.toUpperCase())
  );

  if (memberStateLicenses.length === 0) {
    reasons.push(
      "No active, unrestricted license in an IMLC member state to serve as State of Principal License."
    );
  }

  // 3. Board certification.
  if (!input.hasBoardCertification) {
    reasons.push("Active ABMS or AOA board certification is required for IMLC eligibility.");
  }

  // 4. Active DEA registration.
  if (!input.hasActiveDea) {
    reasons.push("Active DEA registration is required.");
  }

  // 5. Training history.
  if (!input.hasCompletedTraining) {
    reasons.push("Must have graduated from an accredited medical school and completed an approved residency.");
  }

  // 6. No open discipline.
  if (input.hasOpenDiscipline) {
    reasons.push("Disciplinary actions on a state license disqualify a provider from IMLC.");
  }

  // 7. No criminal history barring practice.
  if (input.hasCriminalHistory) {
    reasons.push("Unresolved criminal history bars IMLC qualification.");
  }

  // Pick the SPL candidate: prefer the provider's primary license if it's in
  // an IMLC member state; otherwise the alphabetically-first member-state license.
  const primaryMember = memberStateLicenses.find((l) => l.isPrimary);
  const splCandidate =
    primaryMember?.state ??
    memberStateLicenses.sort((a, b) => a.state.localeCompare(b.state))[0]?.state;

  return {
    eligible: reasons.length === 0,
    splCandidate,
    reasons,
  };
}

// ─── Telehealth coverage gap detection ──────────────────────────────────────

export interface CoverageEvaluationInput {
  /** States the provider has declared they want to practice telehealth in. */
  declaredStates: string[];
  /** Active state licenses with status. */
  licenses: Array<{ state: string; status: string }>;
  /** IMLC member states the provider currently has a granted license in. */
  imlcMemberStatesGranted?: string[];
}

export interface CoverageEvaluationResult {
  coveredStates: string[];
  uncoveredStates: string[];
  imlcCoveredStates: string[];
}

export function evaluateTelehealthCoverage(
  input: CoverageEvaluationInput
): CoverageEvaluationResult {
  const declared = input.declaredStates.map((s) => s.toUpperCase());
  const directlyLicensed = new Set(
    input.licenses
      .filter((l) => l.status?.toUpperCase() === "ACTIVE")
      .map((l) => l.state.toUpperCase())
  );
  const imlcGranted = new Set(
    (input.imlcMemberStatesGranted ?? []).map((s) => s.toUpperCase())
  );

  const covered: string[] = [];
  const imlcCovered: string[] = [];
  const uncovered: string[] = [];

  for (const state of declared) {
    if (directlyLicensed.has(state)) {
      covered.push(state);
    } else if (imlcGranted.has(state)) {
      covered.push(state);
      imlcCovered.push(state);
    } else {
      uncovered.push(state);
    }
  }

  return {
    coveredStates: covered,
    uncoveredStates: uncovered,
    imlcCoveredStates: imlcCovered,
  };
}
