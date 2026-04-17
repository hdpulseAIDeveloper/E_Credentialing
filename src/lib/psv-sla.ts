/**
 * PSV SLA — NCQA Primary Source Verification timing windows (P0 Gap #7).
 *
 * NCQA standards require Primary Source Verification of every credential
 * (license, board cert, education, work history, sanctions, etc.) within a
 * bounded window of the practitioner's signed application/attestation:
 *
 *   • Initial Credentialing (Certification): ≤ 90 days
 *   • Recredentialing (Accreditation):       ≤ 120 days
 *
 * Verifications dated outside that window must be re-run before the
 * credentialing committee can act on them. Missing this window is a
 * documented NCQA standard violation that surfaces during audits.
 *
 * This module exposes:
 *   • SLA window constants
 *   • computeSlaState() — given the application date and verification dates,
 *     returns deadline, days remaining, and breach status
 *   • slaStateColor() — Tailwind color class for badges
 *
 * Server-only — does not import React.
 */

export const PSV_SLA_INITIAL_DAYS = 90;
export const PSV_SLA_RECRED_DAYS = 120;

export type PsvSlaCycle = "INITIAL" | "RECRED";

export type PsvSlaStatus =
  | "ON_TRACK" // ≥ 30 days remaining
  | "AT_RISK" // < 30 days remaining
  | "OVERDUE" // 0 or fewer days remaining
  | "COMPLETE" // PSV completed before deadline
  | "BREACHED" // PSV completed AFTER deadline
  | "NOT_APPLICABLE"; // No application/cycle yet

export interface PsvSlaState {
  cycle: PsvSlaCycle;
  windowDays: number;
  appliedAt: Date | null;
  deadline: Date | null;
  completedAt: Date | null;
  daysRemaining: number | null;
  status: PsvSlaStatus;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * MS_PER_DAY);
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / MS_PER_DAY);
}

export interface PsvSlaInput {
  cycle: PsvSlaCycle;
  /**
   * Anchor date for the SLA window:
   *   • INITIAL → applicationSubmittedAt (date the practitioner attested)
   *   • RECRED  → cycle.startedAt (date the recred cycle began)
   */
  appliedAt: Date | string | null | undefined;
  /**
   * If PSV is fully complete, the timestamp it completed at. When provided,
   * status will be COMPLETE or BREACHED depending on whether it landed inside
   * or outside the window.
   */
  completedAt?: Date | string | null;
  /** Optional override for the SLA window (used by Joint Commission tracks). */
  windowDays?: number;
  /** Defaults to current time. Useful for deterministic tests. */
  now?: Date;
}

export function computeSlaState(input: PsvSlaInput): PsvSlaState {
  const cycle = input.cycle;
  const windowDays =
    input.windowDays ??
    (cycle === "INITIAL" ? PSV_SLA_INITIAL_DAYS : PSV_SLA_RECRED_DAYS);
  const now = input.now ?? new Date();

  const appliedAt = input.appliedAt ? new Date(input.appliedAt) : null;
  const completedAt = input.completedAt ? new Date(input.completedAt) : null;

  if (!appliedAt || Number.isNaN(appliedAt.getTime())) {
    return {
      cycle,
      windowDays,
      appliedAt: null,
      deadline: null,
      completedAt,
      daysRemaining: null,
      status: "NOT_APPLICABLE",
    };
  }

  const deadline = addDays(appliedAt, windowDays);
  const daysRemaining = diffDays(deadline, now);

  let status: PsvSlaStatus;
  if (completedAt && !Number.isNaN(completedAt.getTime())) {
    status = completedAt.getTime() <= deadline.getTime() ? "COMPLETE" : "BREACHED";
  } else if (daysRemaining < 0) {
    status = "OVERDUE";
  } else if (daysRemaining < 30) {
    status = "AT_RISK";
  } else {
    status = "ON_TRACK";
  }

  return { cycle, windowDays, appliedAt, deadline, completedAt, daysRemaining, status };
}

export function slaStateColor(status: PsvSlaStatus): string {
  switch (status) {
    case "ON_TRACK":
      return "bg-green-100 text-green-700 border-green-200";
    case "AT_RISK":
      return "bg-amber-100 text-amber-800 border-amber-200";
    case "OVERDUE":
    case "BREACHED":
      return "bg-red-100 text-red-700 border-red-200";
    case "COMPLETE":
      return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "NOT_APPLICABLE":
    default:
      return "bg-gray-100 text-gray-600 border-gray-200";
  }
}

export function slaStateLabel(state: PsvSlaState): string {
  switch (state.status) {
    case "ON_TRACK":
      return `${state.daysRemaining}d remaining`;
    case "AT_RISK":
      return `${state.daysRemaining}d remaining — at risk`;
    case "OVERDUE":
      return `${Math.abs(state.daysRemaining ?? 0)}d overdue`;
    case "COMPLETE":
      return "Completed within SLA";
    case "BREACHED":
      return "Completed past SLA — audit risk";
    case "NOT_APPLICABLE":
    default:
      return "—";
  }
}

/**
 * Lightweight check used by the metrics tile / list filter:
 * is this state currently a breach (overdue or completed past deadline)?
 */
export function isBreach(state: PsvSlaState): boolean {
  return state.status === "OVERDUE" || state.status === "BREACHED";
}

/** True when the SLA is in the "act now" window (< 30 days but not breached). */
export function isAtRisk(state: PsvSlaState): boolean {
  return state.status === "AT_RISK";
}
