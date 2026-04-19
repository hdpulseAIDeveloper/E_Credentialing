# Per-screen card: `/errors`

| Field | Value |
| --- | --- |
| Route(s) | `/errors` (HTML index) |
| Source file | `src/app/errors/page.tsx`, registry: `src/lib/api/error-catalog.ts` |
| Dynamic | no (Server Component reading the in-memory catalog) |
| Group | public / developer |
| Roles allowed | **anonymous** (public), every authenticated role |
| Roles denied (must redirect/403) | none — fully public |
| PHI fields rendered | none. The catalog is all curated English prose; no PHI, no per-tenant data, no DB hit. |

## Key actions / mutations

- No mutations. Read-only public surface.
- One outbound link per catalog row to `/errors/<kebab-code>`.
- Cross-links to `/cvo`, `/sandbox`, `/pricing`, `/auth/signin` in the
  shared header.
- Anti-weakening: the page MUST stay publicly accessible. Restricting
  it would break RFC 9457 §3.1.1 — the `type` URI in every Problem
  body points here, and the URI MUST resolve for unauthenticated
  tooling (browser devtools, IntelliJ HTTP client, support agents
  triaging in incognito).

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A — every static
  route, every authenticated role)
- `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts` (Pillar A —
  ANONYMOUS reachability of every `route-inventory.json`
  `group: public` route, including `/errors` and a sample
  `/errors/<code>` in both kebab and snake casings — the runtime gate
  that closes the DEF-0007 coverage gap)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E — axe scan)
- `tests/unit/api/error-catalog.test.ts` (registry contract: per-row
  invariants, lookup helpers, registry-completeness gate, legacy
  `PROBLEM_TITLES` parity)
- `tests/contract/pillar-j-openapi.spec.ts` Wave 21 block
  (`ErrorCatalogEntry` / `ErrorCatalogList` schemas, `/api/v1/errors`
  + `/api/v1/errors/{code}` operations, response envelope, 404 on
  unknown code)

## Linked OpenAPI / tRPC procedures

- `GET /api/v1/errors`            → `listErrorCatalog`
- `GET /api/v1/errors/{code}`     → `getErrorCatalogEntry`

Both endpoints are documented in `docs/api/openapi-v1.yaml` (since
spec v1.10.0) and surface through the TypeScript SDK as
`client.listErrors()` and `client.getError(code)`.

## Known defects

- **DEF-0007 — Closed (fixed) 2026-04-19.** The middleware in
  `src/middleware.ts` was missing `/errors` from its public allow-list,
  so anonymous visitors got a 307 redirect to `/auth/signin` instead of
  the catalog page (captured evidence + closure attestation in
  `docs/qa/defects/DEF-0007.md`). Fixed by adding `pathname === "/errors"`
  to the allow-list; runtime gate added at
  `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts`.
- **DEF-0008 — Open / Escalated 2026-04-19.** Same-shape PRE-EXISTING
  drift on `/legal/*`, `/cvo`, `/sandbox`, `/pricing`, `/changelog`,
  `/settings/billing`, `/settings/compliance`. Documented for user
  triage; the runtime gate from DEF-0007 will turn red on these in any
  DB-up CI run, surfacing them automatically until DEF-0008 is closed
  by a structural fix (see the card for the three options).

## Last verified

2026-04-19 by Wave 21 (error catalog launch — registry contract test
green; both HTML pages statically pre-rendered for every catalog
entry; see ADR 0027) AND DEF-0007 closure (anonymous browser
reachability of `/errors` confirmed via direct HTTP probe against the
prod bundle; see DEF-0007.md "Captured evidence" + "Attempt 1" for
the before/after status codes).
