/**
 * Wave 5.3 — Stripe Checkout session creation.
 *
 * Behind BILLING_ENABLED feature flag. Returns:
 *   200 { url } — redirect the browser to Stripe Checkout
 *   400        — bad plan slug
 *   401        — unauthenticated
 *   503        — billing disabled or Stripe price id unconfigured
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { getPlan, resolveStripePriceId } from "@/lib/billing/plans";
import { BillingDisabledError, getStripeClient } from "@/lib/billing/stripe-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  planSlug: z.enum(["starter", "growth", "enterprise"]),
  /** Optional URL the customer returns to after success. */
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

export async function POST(request: Request) {
  if (!env.BILLING_ENABLED) {
    return NextResponse.json(
      { error: "billing_disabled", message: "Billing is currently disabled on this deployment." },
      { status: 503 },
    );
  }

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_body", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const plan = getPlan(parsed.data.planSlug);
  if (!plan || plan.archived) {
    return NextResponse.json({ error: "unknown_plan" }, { status: 400 });
  }

  const priceId = resolveStripePriceId(plan.slug);
  if (!priceId) {
    return NextResponse.json(
      {
        error: "price_not_configured",
        message: `${plan.stripePriceEnv} is not set; configure the Stripe price id to enable this plan.`,
      },
      { status: 503 },
    );
  }

  const orgId = (session.user as { organizationId?: string }).organizationId ?? "org_essen";
  const org = await db.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    return NextResponse.json({ error: "org_not_found" }, { status: 404 });
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

  let customerId = org.billingCustomerId;
  if (!customerId) {
    const created = await stripe.customers.create({
      email: session.user.email,
      name: org.name,
      metadata: { organizationId: org.id },
    });
    customerId = created.id;
    await db.organization.update({
      where: { id: org.id },
      data: { billingCustomerId: customerId },
    });
  }

  const successUrl =
    parsed.data.successUrl ??
    `${env.NEXT_PUBLIC_APP_URL}/settings/billing?status=success`;
  const cancelUrl =
    parsed.data.cancelUrl ??
    `${env.NEXT_PUBLIC_APP_URL}/pricing?status=cancel`;

  const checkout = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
    subscription_data: {
      metadata: { organizationId: org.id, plan: plan.slug },
    },
    client_reference_id: org.id,
  });

  await writeAuditLog({
    actorId: session.user.id ?? null,
    actorRole: (session.user as { role?: string }).role ?? null,
    action: "BILLING_CHECKOUT_STARTED",
    entityType: "Organization",
    entityId: org.id,
    metadata: { planSlug: plan.slug, checkoutId: checkout.id },
  }).catch((err) => logger.warn({ err }, "audit write failed for BILLING_CHECKOUT_STARTED"));

  if (!checkout.url) {
    return NextResponse.json({ error: "stripe_no_url" }, { status: 502 });
  }
  return NextResponse.json({ url: checkout.url });
}
