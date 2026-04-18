# Per-screen card: `/sandbox`

| Field | Value |
| --- | --- |
| Route(s) | `/sandbox` (HTML), `/api/sandbox/v1/providers`, `/api/sandbox/v1/providers/[id]`, `/api/sandbox/v1/fhir/metadata` |
| Source file | `src/app/sandbox/page.tsx`, `src/app/api/sandbox/v1/**/route.ts` |
| Dynamic | no (synthetic deterministic data) |
| Group | public / developer |
| Roles allowed | **anonymous** (public), every authenticated role |
| Roles denied (must redirect/403) | none — fully public |
| PHI fields rendered | none. Synthetic providers only (deterministic NPIs with valid Luhn checksum). |

## Key actions / mutations

- No mutations. All sandbox routes are read-only.
- Quick-start `curl` examples on the page.
- Anti-weakening: the synthetic data set is **fully synthetic** —
  no real PHI is ever served from `/api/sandbox/**`. See
  `src/lib/sandbox/synth.ts` and `tests/unit/lib/sandbox/synth.test.ts`.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E, axe scan)
- `tests/unit/lib/sandbox/synth.test.ts` (9 tests, determinism + uniqueness)

## Linked OpenAPI / tRPC procedures

REST only — no tRPC. The sandbox API surface is documented in
[`docs/dev/sandbox-api.md`](../../dev/sandbox-api.md).

## Known defects

_None recorded._

## Last verified

2026-04-18 by Wave 5.2 (sandbox launch).
