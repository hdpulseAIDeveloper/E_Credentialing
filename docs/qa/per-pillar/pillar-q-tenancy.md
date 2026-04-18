# Pillar Q — Tenancy isolation

Wave 5.1 lands the multi-tenancy *shim* (per ADR 0014). This pillar
asserts that the shim does what it claims: every read/update/delete
issued through `db` is silently scoped to the active organization id,
and that bypass is impossible from any normal call site.

## What the shim provides

- `Organization` table (root tenant entity)
- `organization_id` column on `users`, `providers`, `documents`,
  `audit_logs`, `bot_runs` (W5.1.a slice; widening to all PHI tables
  follows in W5.1.b)
- `withTenant({ organizationId }, fn)` — runs `fn` inside an
  `AsyncLocalStorage` slot the Prisma extension reads.
- `dangerouslyBypassTenantScope(fn)` — the only way to opt out, locked
  by `ecred-local/no-tenant-bypass` ESLint rule to
  `src/server/db/internal/**`.

## Tests

| Layer | File | Asserts |
| --- | --- | --- |
| Unit | `tests/unit/server/db/tenant-extension.test.ts` | `injectTenant` adds `organizationId` to `where`/`data` for read/create/update; respects caller-provided overrides; `upsert` injects on `create` only. |
| Unit | `tests/unit/eslint-rules/no-tenant-bypass.test.ts` | RuleTester verifies the bypass import is rejected outside `src/server/db/internal/**` + tests/unit/server/db/** + tests/e2e/tenancy/**. |
| E2E (planned, W5.1.e) | `tests/e2e/tenancy/cross-org.spec.ts` | A logged-in `org_a` user cannot list, read, mutate, or delete an `org_b` provider — both via the UI and via direct tRPC calls. |

## Anti-weakening (STANDARD.md §4.2)

- DO NOT add a model to the implicit "global" set just to silence a
  "missing organizationId" runtime error. Add the column AND add the
  model to `TENANT_SCOPED_MODELS` in `src/server/db/tenant-extension.ts`.
- DO NOT use `dangerouslyBypassTenantScope` inside a tRPC router or UI
  component. The ESLint rule will block the import; if you find
  yourself wanting to disable that rule, reconsider — the bypass is
  always a data-leak risk.
- DO NOT toggle the tenant ALS slot mid-request. The slot is set once
  by the auth middleware at the request boundary and read everywhere
  else.

## Failure modes the pillar must catch

1. A new model added to the schema with PHI columns but **without**
   `organizationId` → the unit suite will pass but a Pillar Q E2E
   spec must fail when an `org_a` user can read `org_b` data via that
   model.
2. A regression that drops the Prisma extension wiring in
   `src/server/db.ts` → unit tests covering the extension itself stay
   green; the cross-org E2E spec catches it.
3. A query that bypasses the extension by importing `dbRaw` directly →
   the ESLint rule blocks the import; if it slipped through, the
   cross-org E2E spec catches it.
