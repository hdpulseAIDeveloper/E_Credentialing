/**
 * Wave 5.3 — Stripe Billing Portal session creation.
 *
 * The portal is the customer self-service surface for updating cards,
 * changing plans, and viewing invoices. Requires that the org has
 * already been provisioned with a Stripe customer id (handled by the
 * /api/billing/checkout flow).
 */
import { NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { BillingDisabledError, getStripeClient } from "@/lib/billing/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json(
      { error: "billing_disabled" },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const orgId = (session.user as { organizationId?: string }).organizationId ?? "org_essen";
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return NextResponse.json({ error: "org_not_found" }, { status: 404 });
  }
  if (!org.billingCustomerId) {
    return NextResponse.json(
      {
        error: "no_customer",
        message: "Start a checkout first to provision a Stripe customer.",
      },
      { status: 409 },
    );
  }

  let stripe;
  try {
    stripe = await getStripeClient();
  } catch (err) {
    if (err instanceof BillingDisabledError) {
      return NextResponse.json({ error: err.code, message: err.message }, { status: 503 });
    }
    throw err;
  }

  const portal = await stripe.billingPortal.sessions.create({
    customer: org.billingCustomerId,
    return_url:
      env.STRIPE_BILLING_PORTAL_RETURN_URL ??
      `${env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  await writeAuditLog({
    actorId: session.user.id ?? null,
    actorRole: (session.user as { role?: string }).role ?? null,
    action: "BILLING_PORTAL_OPENED",
    entityType: "Organization",
    entityId: org.id,
    metadata: { portalSessionId: portal.id },
  }).catch((err) => logger.warn({ err }, "audit write failed for BILLING_PORTAL_OPENED"));

  return NextResponse.json({ url: portal.url });
}
