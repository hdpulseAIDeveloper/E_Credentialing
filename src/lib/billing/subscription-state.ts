/**
 * Wave 5.3 — pure helpers for interpreting Stripe subscription state.
 *
 * Kept dependency-free so they can be unit-tested without spinning up
 * Stripe or Prisma.
 */

export type StripeSubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused";

export const ENTITLED_STATUSES: ReadonlySet<StripeSubscriptionStatus> = new Set([
  "active",
  "trialing",
]);

/**
 * Returns true when the subscription should grant feature access.
 * `past_due` intentionally still grants access — Stripe's smart
 * retries handle dunning, and we don't want to lock paying customers
 * out for a single failed card retry.
 */
export function isEntitled(status: string | null | undefined): boolean {
  if (!status) return false;
  return ENTITLED_STATUSES.has(status as StripeSubscriptionStatus);
}

/**
 * Returns true when the org is in a "soft warn" state — UI should
 * surface a banner asking them to update their payment method, but
 * features are still available.
 */
export function shouldShowDunningBanner(status: string | null | undefined): boolean {
  return status === "past_due" || status === "incomplete";
}

/**
 * Hard-blocked: Stripe says we should not deliver service.
 */
export function isLocked(status: string | null | undefined): boolean {
  if (!status) return false;
  return (
    status === "canceled" ||
    status === "incomplete_expired" ||
    status === "unpaid" ||
    status === "paused"
  );
}

/**
 * Maps a Stripe subscription event to the columns we mirror onto the
 * Organization row. Pure — given a parsed Stripe Subscription object,
 * returns the deltas to apply.
 */
export interface NormalizedSubscription {
  billingSubscriptionId: string;
  billingStatus: StripeSubscriptionStatus;
  billingCurrentPeriodEnd: Date | null;
  planSlug: string | null;
}

export function normalizeSubscription(
  raw: {
    id?: string;
    status?: string;
    current_period_end?: number | null;
    items?: { data?: Array<{ price?: { id?: string; lookup_key?: string | null; metadata?: Record<string, string> | null } }> };
    metadata?: Record<string, string> | null;
  } | null | undefined,
): NormalizedSubscription | null {
  if (!raw?.id || !raw.status) return null;
  const item = raw.items?.data?.[0];
  // Plan slug resolution priority:
  //   1. subscription.metadata.plan
  //   2. price.metadata.plan
  //   3. price.lookup_key (we recommend setting this to "starter" / "growth" / "enterprise")
  //   4. fallback: null (caller will keep existing plan slug)
  const planSlug =
    raw.metadata?.plan ??
    item?.price?.metadata?.plan ??
    item?.price?.lookup_key ??
    null;

  return {
    billingSubscriptionId: raw.id,
    billingStatus: raw.status as StripeSubscriptionStatus,
    billingCurrentPeriodEnd:
      typeof raw.current_period_end === "number"
        ? new Date(raw.current_period_end * 1000)
        : null,
    planSlug: planSlug ?? null,
  };
}
