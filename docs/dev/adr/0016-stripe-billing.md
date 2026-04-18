# ADR 0016 — Stripe Billing scaffolding behind BILLING_ENABLED feature flag

**Status:** Accepted — implemented (W5.3 landed 2026-04-18)
**Date:** 2026-04-18
**Deciders:** Engineering (autonomous lock-in per user directive 2026-04-18)
**Related:** Wave 5.3 in the local Cursor plan
`unblock_+_commercialize_ecred` (commercial monetization).

## Context

To sell the CVO platform commercially we need a billing surface. The
constraints:

- **No hard runtime dependency on `stripe` for non-billing deploys.**
  Existing internal Essen-only deploys must keep building and running
  with `BILLING_ENABLED=false` and zero billing config.
- **No write to PHI tables from the billing path.** The billing
  surface only reads/writes `Organization` rows.
- **Webhook signature verification is non-negotiable**, even in dev.
  Stripe CLI forwarding is the supported dev workflow.
- **Plan limits enforced at the application layer** until usage-based
  metering is wired (a deliberate later step).

## Decision

1. Add a server feature flag `BILLING_ENABLED` (default `false`) and a
   parallel `NEXT_PUBLIC_BILLING_ENABLED` for client-side gating.
2. Extend `Organization` with `billingSubscriptionId`, `billingStatus`,
   and `billingCurrentPeriodEnd` columns mirrored from Stripe via the
   webhook handler.
3. Treat `stripe` as an **optional npm dependency**: it is loaded via
   dynamic `import("stripe")` and the type surface used by the
   application is captured by the local `StripeClientLike` interface.
   The build does not require `stripe` to be installed; `getStripeClient()`
   throws a friendly `BillingDisabledError` when it isn't.
4. Concentrate all `dangerouslyBypassTenantScope` calls for billing in
   `src/server/db/internal/billing-org-store.ts`. The webhook arrives
   without a tenant context (Stripe doesn't know our tenant ids), so
   the bypass is necessary; the existing `no-tenant-bypass` ESLint
   rule keeps the import limited to that single file.
5. Provide three route handlers — `POST /api/billing/checkout`,
   `POST /api/billing/portal`, `POST /api/billing/webhook` — and an
   in-app `/settings/billing` page that gracefully degrades when the
   flag is off.
6. Pure helpers (`plans.ts`, `subscription-state.ts`) live in
   `src/lib/billing/` so they can be unit-tested without spinning up
   Stripe or Prisma.

## Plan catalog

| Slug       | Display    | Price (indicative)  | Cap        |
| ---------- | ---------- | ------------------- | ---------- |
| starter    | Starter    | $499/mo             | 25 providers   |
| growth     | Growth     | $1,999/mo           | 250 providers  |
| enterprise | Enterprise | Contact sales       | Unlimited      |

The displayed price on `/pricing` is indicative; the actual
`unit_amount` always comes from Stripe at checkout.

## Consequences

- New env vars: `BILLING_ENABLED`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_GROWTH`,
  `STRIPE_PRICE_ENTERPRISE`, `STRIPE_BILLING_PORTAL_RETURN_URL`.
  All optional — the system boots without any of them.
- New audit actions: `BILLING_CHECKOUT_STARTED`, `BILLING_PORTAL_OPENED`,
  `BILLING_CUSTOMER_SUBSCRIPTION_*`, `BILLING_INVOICE_PAYMENT_*`.
- Pricing page (`/pricing`) keeps current scaffolding but the in-app
  `/settings/billing` page now drives real Stripe checkout when the
  flag is on.

## Alternatives considered

- **Hard-import `stripe` and ship it.** Rejected: bundle bloat for
  Essen-only deploys, mandatory secret in dev, cycle time impact.
- **Run Stripe sync in the worker.** Rejected for now: the webhook
  handler is the canonical source of truth and worker indirection
  adds replay-failure modes without solving anything.
- **Per-tenant Stripe Connect accounts.** Out of scope; we'll
  revisit when a customer needs marketplace-style billing.

## Anti-weakening

- DO NOT add a top-level `import Stripe from "stripe"`.
- DO NOT bypass webhook signature verification for any reason.
- DO NOT add new callers of `dangerouslyBypassTenantScope` from the
  billing path; extend `billing-org-store.ts` instead.
