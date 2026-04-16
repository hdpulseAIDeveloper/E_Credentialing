/**
 * Expirable date helpers.
 *
 * Pure functions for computing expirable status buckets ("expired", "≤7d",
 * "≤30d", "≤60d", "≤90d"), the next-check date for background renewal jobs,
 * and the default cadence per expirable type.
 *
 * No DB access, no network. Designed to be trivially unit-testable.
 */

import type { ExpirableType } from "@prisma/client";

export type ExpirationBucket =
  | "EXPIRED"
  | "IN_7_DAYS"
  | "IN_30_DAYS"
  | "IN_60_DAYS"
  | "IN_90_DAYS"
  | "LATER";

/**
 * Sort an expiration date into a bucket for dashboards, using the same cut-offs
 * the Expirables dashboard uses. `now` is parameterized for testability.
 */
export function bucketExpiration(
  expirationDate: Date,
  now: Date = new Date(),
): ExpirationBucket {
  const ms = expirationDate.getTime() - now.getTime();
  const days = ms / (1000 * 60 * 60 * 24);
  if (days < 0) return "EXPIRED";
  if (days <= 7) return "IN_7_DAYS";
  if (days <= 30) return "IN_30_DAYS";
  if (days <= 60) return "IN_60_DAYS";
  if (days <= 90) return "IN_90_DAYS";
  return "LATER";
}

/**
 * Default renewal cadence (days) per expirable type. Anything not listed
 * falls back to 365 days (1-year cycle).
 *
 * These values are picked to match state/payer norms; overrides can be stored
 * per-expirable via Expirable.renewalCadenceDays.
 */
export const DEFAULT_CADENCE_DAYS: Readonly<Partial<Record<ExpirableType, number>>> = {
  STATE_LICENSE: 365 * 2,
  DEA: 365 * 3,
  BOARD_CERTIFICATION: 365 * 10,
  MALPRACTICE_INSURANCE: 365,
  CAQH_ATTESTATION: 120,
  BLS: 365 * 2,
  ACLS: 365 * 2,
  PALS: 365 * 2,
  FLU_SHOT: 365,
  PPD: 365,
  HOSPITAL_PRIVILEGE: 365 * 2,
};

export function defaultCadenceDays(type: ExpirableType): number {
  return DEFAULT_CADENCE_DAYS[type] ?? 365;
}

/**
 * Compute the next "check date" — i.e., when the bot / reminder job should
 * re-verify this expirable. Starts nudging at 90 days before expiration,
 * then accelerates as we approach the expiration date.
 */
export function computeNextCheckDate(
  expirationDate: Date,
  now: Date = new Date(),
): Date {
  const ms = expirationDate.getTime() - now.getTime();
  const days = ms / (1000 * 60 * 60 * 24);

  // Past expiration → check daily.
  if (days <= 0) return addDays(now, 1);
  // Within 30 days → check every 3 days.
  if (days <= 30) return addDays(now, 3);
  // Within 90 days → weekly.
  if (days <= 90) return addDays(now, 7);
  // Further out → monthly.
  return addDays(now, 30);
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}
