# Pillar S — Billing (Stripe scaffolding behind feature flag)

> **Wave:** 5.3
> **ADR:** [0016 — Stripe Billing scaffolding](../../dev/adr/0016-stripe-billing.md)
> **Feature flag:** `BILLING_ENABLED` (server) + `NEXT_PUBLIC_BILLING_ENABLED` (client)

## Surface

| Surface | Path | Auth | Behavior when `BILLING_ENABLED=false` |
| ------- | ---- | ---- | ------------------------------------- |
| Marketing pricing page | `/pricing` | none | Shows indicative tiers; CTAs link to register/pricing |
| In-app settings | `/settings/billing` | required | Renders read-only with disabled banner |
| Checkout API | `POST /api/billing/checkout` | required | Returns `503 billing_disabled` |
| Billing portal API | `POST /api/billing/portal` | required | Returns `503 billing_disabled` |
| Webhook | `POST /api/billing/webhook` | Stripe HMAC | Returns `503 billing_disabled` |

## Pure helpers (covered by unit tests)

| Module | Tests |
| ------ | ----- |
| `src/lib/billing/plans.ts` | `tests/unit/lib/billing/plans.test.ts` (10 tests) |
| `src/lib/billing/subscription-state.ts` | `tests/unit/lib/billing/subscription-state.test.ts` (11 tests) |

## Anti-weakening rules

1. **Webhook signature verification is mandatory.** Even in dev — use
   the Stripe CLI to forward signed events.
2. **No top-level `import Stripe from "stripe"`** anywhere in the
   codebase. Use `getStripeClient()` from `stripe-client.ts`.
3. **`dangerouslyBypassTenantScope` only inside `src/server/db/internal/billing-org-store.ts`.**
   The `no-tenant-bypass` ESLint rule enforces this.
4. **Plans cannot be deleted.** Mark `archived: true` and add a new
   slug. Slug renames are also forbidden — they break Stripe metadata.
5. **Indicative prices on `/pricing` are NOT authoritative.** Stripe's
   `unit_amount` at checkout is the source of truth.

## Failure modes covered

| Scenario | Expected response |
| -------- | ----------------- |
| Flag off → checkout call | `503 { error: "billing_disabled" }` |
| Flag on but no Stripe price env | `503 { error: "price_not_configured" }` |
| Flag on but `stripe` npm pkg missing | `503 BillingDisabledError` |
| Webhook with bad signature | `400 { error: "bad_signature" }` |
| Webhook for unknown org / customer | `200 { received: true }` + warn log |
| Webhook handler throws | `500 { error: "handler_error" }`; Stripe will retry |

## Future work (not in 5.3)

- Stripe usage records for per-provider metered billing on Growth.
- Plan limit enforcement at provider create time (today
  `assertWithinPlanLimits()` is a callable helper but not yet wired
  into the create flow — that lands in W5.4).
- Webhook event-id idempotency table to short-circuit Stripe retries
  before they hit the audit chain.
