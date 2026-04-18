# Per-screen card: `/settings/billing`

| Field | Value |
| --- | --- |
| Route(s) | `/settings/billing` (HTML), `/api/billing/checkout`, `/api/billing/portal`, `/api/billing/webhook` |
| Source file | `src/app/settings/billing/page.tsx`, `src/app/settings/billing/billing-actions.tsx`, `src/app/api/billing/**/route.ts` |
| Dynamic | yes — reads `Organization` row + Stripe state |
| Group | authenticated / org-scoped |
| Roles allowed | every authenticated user in the organization (Admin/Compliance trigger upgrades; reads visible to all org members in scope) |
| Roles denied (must redirect/403) | unauthenticated → redirect to `/auth/signin` |
| PHI fields rendered | none. Only billing metadata (plan, status, current period end). |

## Key actions / mutations

- "Manage in Stripe" button → POST `/api/billing/portal` → Stripe Billing Portal redirect.
- Per-plan "Upgrade" form → POST `/api/billing/checkout` → Stripe Checkout redirect.
- Webhook handler at `/api/billing/webhook` mirrors Stripe state into
  `Organization.{billingStatus,billingSubscriptionId,billingCurrentPeriodEnd}`.
- All three flows write audit events (`BILLING_CHECKOUT_STARTED`,
  `BILLING_PORTAL_OPENED`, `BILLING_WEBHOOK_*`).
- Behind `BILLING_ENABLED=false` the page renders a "Billing not
  enabled" notice and the API routes 404. See
  [ADR 0016](../../dev/adr/0016-stripe-billing.md).

## Linked specs

- `tests/unit/lib/billing/plans.test.ts` (10 tests)
- `tests/unit/lib/billing/subscription-state.test.ts`
- See [Pillar S — Billing](../per-pillar/pillar-s-billing.md).

## Linked OpenAPI / tRPC procedures

- REST: `POST /api/billing/checkout`, `POST /api/billing/portal`,
  `POST /api/billing/webhook`. No tRPC procedures (Stripe redirects
  require classic POST handlers).

## Known defects

_None recorded._

## Last verified

2026-04-18 by Wave 5.3 (Stripe billing scaffolding).
