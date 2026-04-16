/**
 * Provider status transition rules.
 *
 * Single source of truth for "can a provider move from X to Y?".
 * This is intentionally a pure module with no I/O — it's used by the tRPC
 * provider router, background jobs that advance providers, and tests.
 *
 * Keep this aligned with the state machine documented in
 * docs/user/credentialing.md and docs/planning/workflows.md.
 */

import type { ProviderStatus } from "@prisma/client";

/**
 * Valid outbound transitions from each status. Add the inverse where
 * "back-out" is explicitly allowed (e.g., moving from COMMITTEE_READY
 * back to VERIFICATION_IN_PROGRESS if new evidence is found).
 */
export const STATUS_TRANSITIONS: Readonly<Record<ProviderStatus, readonly ProviderStatus[]>> = {
  INVITED: ["ONBOARDING_IN_PROGRESS"],
  ONBOARDING_IN_PROGRESS: ["DOCUMENTS_PENDING", "INVITED"],
  DOCUMENTS_PENDING: ["VERIFICATION_IN_PROGRESS", "ONBOARDING_IN_PROGRESS"],
  VERIFICATION_IN_PROGRESS: ["COMMITTEE_READY", "DOCUMENTS_PENDING"],
  COMMITTEE_READY: ["COMMITTEE_IN_REVIEW", "VERIFICATION_IN_PROGRESS"],
  COMMITTEE_IN_REVIEW: ["APPROVED", "DENIED", "DEFERRED", "COMMITTEE_READY"],
  APPROVED: ["INACTIVE"],
  DENIED: ["INVITED"],
  DEFERRED: ["COMMITTEE_READY", "VERIFICATION_IN_PROGRESS"],
  INACTIVE: ["INVITED"],
};

export class InvalidStatusTransitionError extends Error {
  readonly code = "INVALID_STATUS_TRANSITION";
  constructor(
    readonly from: ProviderStatus,
    readonly to: ProviderStatus,
  ) {
    super(`Provider cannot transition from ${from} to ${to}`);
    this.name = "InvalidStatusTransitionError";
  }
}

/**
 * Check whether a transition is allowed. Returns true if allowed, false otherwise.
 */
export function canTransition(from: ProviderStatus, to: ProviderStatus): boolean {
  if (from === to) return false;
  const allowed = STATUS_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserting variant. Throws InvalidStatusTransitionError when the
 * transition is not allowed. Use in services and routers where the
 * caller wants to short-circuit with an error.
 */
export function assertCanTransition(
  from: ProviderStatus,
  to: ProviderStatus,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidStatusTransitionError(from, to);
  }
}

/**
 * The set of statuses we treat as "active" (provider is still moving
 * through the pipeline). Used by dashboards and reports.
 */
export const ACTIVE_STATUSES: readonly ProviderStatus[] = [
  "INVITED",
  "ONBOARDING_IN_PROGRESS",
  "DOCUMENTS_PENDING",
  "VERIFICATION_IN_PROGRESS",
  "COMMITTEE_READY",
  "COMMITTEE_IN_REVIEW",
  "DEFERRED",
];

export const TERMINAL_STATUSES: readonly ProviderStatus[] = [
  "APPROVED",
  "DENIED",
  "INACTIVE",
];

export function isActive(status: ProviderStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminal(status: ProviderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}
