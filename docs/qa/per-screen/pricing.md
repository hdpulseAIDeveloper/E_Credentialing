# Per-screen card: `/pricing`

| Field | Value |
| --- | --- |
| Route(s) | `/pricing` |
| Source file | `src/app/pricing/page.tsx` |
| Dynamic | no |
| Group | public / marketing |
| Roles allowed | **anonymous** (public), every authenticated role |
| Roles denied (must redirect/403) | none — fully public |
| PHI fields rendered | none |

## Key actions / mutations

- Renders Starter / Growth / Enterprise tiers from the catalog in
  `src/lib/billing/plans.ts`.
- Pricing values are indicative on this page; live values come from
  Stripe at checkout when `BILLING_ENABLED=true`. See
  [ADR 0016 — Stripe billing](../../dev/adr/0016-stripe-billing.md).
- CTA links route to `/auth/signin` (sign-in or sign-up).

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E, axe scan)
- `tests/unit/lib/billing/plans.test.ts` (catalog correctness)
- See [Pillar S](../per-pillar/pillar-s-billing.md).

## Linked OpenAPI / tRPC procedures

None on this page. Authenticated upgrade flow lives at
`/settings/billing` and posts to `/api/billing/checkout`.

## Known defects

_None recorded._

## Last verified

2026-04-18 by Wave 5.3 (billing scaffolding); pricing copy updated to
reflect Stripe as the source of truth at checkout.
