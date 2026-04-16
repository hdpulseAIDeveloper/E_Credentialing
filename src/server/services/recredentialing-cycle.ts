/**
 * Recredentialing cycle math.
 *
 * NCQA requires recredentialing at least every 36 months. Essen policy sets
 * the window to exactly 36 months from the most recent approval, with
 * warnings at 90 / 60 / 30 days out and an "overdue" state once due.
 *
 * This module is pure. All functions take an explicit `now` to make tests
 * deterministic.
 */

/**
 * Standard Essen recredentialing cycle length, in months.
 * Do not change without consulting Compliance (triggers NCQA schedule audit).
 */
export const RECREDENTIALING_CYCLE_MONTHS = 36;

/**
 * The date the next recredentialing is due, given the most recent approval.
 * Returns `null` if the provider has never been approved.
 */
export function nextRecredentialingDueDate(
  initialOrLastApprovalDate: Date | null | undefined,
): Date | null {
  if (!initialOrLastApprovalDate) return null;
  const out = new Date(initialOrLastApprovalDate.getTime());
  out.setMonth(out.getMonth() + RECREDENTIALING_CYCLE_MONTHS);
  return out;
}

export type RecredentialingUrgency =
  | "NOT_DUE"
  | "DUE_SOON_90"
  | "DUE_SOON_60"
  | "DUE_SOON_30"
  | "OVERDUE";

/**
 * Classify how urgent a recredentialing is. Used by dashboards and the
 * "start bulk recred" admin tool.
 */
export function recredentialingUrgency(
  dueDate: Date,
  now: Date = new Date(),
): RecredentialingUrgency {
  const days = (dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (days < 0) return "OVERDUE";
  if (days <= 30) return "DUE_SOON_30";
  if (days <= 60) return "DUE_SOON_60";
  if (days <= 90) return "DUE_SOON_90";
  return "NOT_DUE";
}
