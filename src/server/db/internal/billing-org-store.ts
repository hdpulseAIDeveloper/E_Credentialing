/**
 * Wave 5.3 — internal helpers for the Stripe webhook handler.
 *
 * Lives under `src/server/db/internal/` because it MUST use
 * `dangerouslyBypassTenantScope`: the webhook arrives without a
 * tenant context (Stripe doesn't know our tenant ids), so we look up
 * the org by `billingCustomerId` or by the `organizationId` we
 * stamped in subscription metadata.
 *
 * Anti-weakening:
 *   - This module is the ONLY caller of dangerouslyBypassTenantScope
 *     in the billing path. Don't add more.
 *   - The exported helpers are scoped tightly to the Organization
 *     row and never touch PHI tables.
 */
import { dbRaw } from "@/server/db";
import { dangerouslyBypassTenantScope } from "@/server/db/tenant-context";
import type { NormalizedSubscription } from "@/lib/billing/subscription-state";

export async function findOrgForStripeEvent(args: {
  organizationIdFromMetadata?: string | null;
  stripeCustomerId?: string | null;
}): Promise<{ id: string; billingCustomerId: string | null } | null> {
  return dangerouslyBypassTenantScope(async () => {
    if (args.organizationIdFromMetadata) {
      return dbRaw.organization.findUnique({
        where: { id: args.organizationIdFromMetadata },
        select: { id: true, billingCustomerId: true },
      });
    }
    if (args.stripeCustomerId) {
      return dbRaw.organization.findFirst({
        where: { billingCustomerId: args.stripeCustomerId },
        select: { id: true, billingCustomerId: true },
      });
    }
    return null;
  });
}

export async function applySubscriptionState(
  organizationId: string,
  state: NormalizedSubscription,
): Promise<void> {
  await dangerouslyBypassTenantScope(async () =>
    dbRaw.organization.update({
      where: { id: organizationId },
      data: {
        billingSubscriptionId: state.billingSubscriptionId,
        billingStatus: state.billingStatus,
        billingCurrentPeriodEnd: state.billingCurrentPeriodEnd,
        ...(state.planSlug ? { plan: state.planSlug } : {}),
      },
    }),
  );
}

export async function findOrgByStripeCustomer(
  stripeCustomerId: string,
): Promise<{ id: string } | null> {
  return dangerouslyBypassTenantScope(async () =>
    dbRaw.organization.findFirst({
      where: { billingCustomerId: stripeCustomerId },
      select: { id: true },
    }),
  );
}
