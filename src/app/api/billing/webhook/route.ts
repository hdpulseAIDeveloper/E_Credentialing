/**
 * Wave 5.3 — Stripe webhook handler.
 *
 * Stripe POSTs subscription lifecycle events here. We verify the
 * signature, mirror the relevant fields onto the Organization row via
 * the internal `billing-org-store` helper, and write an audit log
 * entry per event. Replay-safety is provided by Stripe itself (event
 * ids are unique) plus the chained audit log.
 *
 * Anti-weakening (STANDARD.md §4.2):
 *   - DO NOT skip signature verification, even in dev. Use the Stripe
 *     CLI to forward signed events instead.
 *   - DO NOT widen the body parser; the raw text body is required for
 *     HMAC verification.
 *   - DO NOT import dangerouslyBypassTenantScope here directly; the
 *     internal store is the only legitimate caller. See ADR 0014.
 */
import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { BillingDisabledError, getStripeClient } from "@/lib/billing/stripe-client";
import { normalizeSubscription } from "@/lib/billing/subscription-state";
import {
  applySubscriptionState,
  findOrgByStripeCustomer,
  findOrgForStripeEvent,
} from "@/server/db/internal/billing-org-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json({ error: "billing_disabled" }, { status: 503 });
  }
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "webhook_secret_missing" }, { status: 503 });
  }

  const sig = headers().get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "missing_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  let stripe;
  try {
    stripe = await getStripeClient();
  } catch (err) {
    if (err instanceof BillingDisabledError) {
      return NextResponse.json({ error: err.code }, { status: 503 });
    }
    throw err;
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.warn({ err: String(err) }, "stripe webhook signature verification failed");
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  try {
    await handleEvent(event);
  } catch (err) {
    logger.error({ err: String(err), eventType: event.type }, "stripe webhook handler failed");
    return NextResponse.json({ error: "handler_error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleEvent(event: { id: string; type: string; data: { object: unknown } }): Promise<void> {
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const sub = event.data.object as {
        customer?: string;
        metadata?: Record<string, string> | null;
      };
      const normalized = normalizeSubscription(event.data.object as Parameters<typeof normalizeSubscription>[0]);
      if (!normalized) return;

      const org = await findOrgForStripeEvent({
        organizationIdFromMetadata: sub.metadata?.organizationId ?? null,
        stripeCustomerId: sub.customer ?? null,
      });
      if (!org) {
        logger.warn({ eventId: event.id, type: event.type }, "stripe webhook: no matching organization");
        return;
      }

      await applySubscriptionState(org.id, normalized);

      await writeAuditLog({
        action: `BILLING_${event.type.toUpperCase().replace(/\./g, "_")}`,
        entityType: "Organization",
        entityId: org.id,
        metadata: {
          eventId: event.id,
          subscriptionId: normalized.billingSubscriptionId,
          status: normalized.billingStatus,
          plan: normalized.planSlug,
        },
      }).catch((err) => logger.warn({ err }, "audit write failed for billing webhook"));
      return;
    }

    case "invoice.payment_failed":
    case "invoice.payment_succeeded": {
      const inv = event.data.object as { customer?: string; id?: string };
      if (!inv.customer) return;
      const org = await findOrgByStripeCustomer(inv.customer);
      if (!org) return;
      await writeAuditLog({
        action: `BILLING_${event.type.toUpperCase().replace(/\./g, "_")}`,
        entityType: "Organization",
        entityId: org.id,
        metadata: { eventId: event.id, invoiceId: inv.id },
      }).catch((err) => logger.warn({ err }, "audit write failed for invoice event"));
      return;
    }

    default:
      // Unhandled types are ack'd silently — Stripe will not retry.
      return;
  }
}
