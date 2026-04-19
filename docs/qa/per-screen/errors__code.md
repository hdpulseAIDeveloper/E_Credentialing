# Per-screen card: `/errors/[code]`

| Field | Value |
| --- | --- |
| Route(s) | `/errors/[code]` (HTML detail page — both snake_case and kebab-case forms accepted) |
| Source file | `src/app/errors/[code]/page.tsx`, registry: `src/lib/api/error-catalog.ts` |
| Dynamic | yes (path param), but **statically pre-rendered** at build time for every catalog entry via `generateStaticParams()` |
| Group | public / developer |
| Roles allowed | **anonymous** (public), every authenticated role |
| Roles denied (must redirect/403) | none — fully public |
| PHI fields rendered | none. The page renders the catalog row's `code`, `title`, `summary`, `description`, `remediation`, and a wire-format example with the row's `status` — all curated English prose. |

## Key actions / mutations

- No mutations. Read-only public surface.
- One outbound link to `/errors` (the catalog index).
- Pre-renders both URL casings (`/errors/insufficient_scope` and
  `/errors/insufficient-scope`) so the URI form a customer types
  matches what the `type` field in any Problem body points to.
- `notFound()` is invoked for unknown codes — Next.js renders the
  standard 404 page; the JSON sibling `/api/v1/errors/{code}`
  returns a Problem-shaped 404 with extension member `requestedCode`.
- Anti-weakening: this page is the canonical resolver of every
  `type` URI in every Problem body. The page MUST remain publicly
  accessible (no auth, no tenant scoping). The Problem body example
  in the "Wire-format reference" section MUST stay in sync with
  what `buildProblem()` actually emits — both pull `status` and
  `title` from the same catalog row.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A — every
  static route, including the pre-rendered detail pages, every
  authenticated role)
- `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts` (Pillar A —
  ANONYMOUS reachability of `/errors/insufficient-scope` AND
  `/errors/insufficient_scope` — both casings exercised explicitly
  because the dynamic-filter excludes `[code]` from the iterator;
  closes the DEF-0007 coverage gap)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E — axe scan)
- `tests/unit/api/error-catalog.test.ts` (registry contract — every
  emitted code has a row, every row has a docsPath that matches
  the route shape)
- `tests/contract/pillar-j-openapi.spec.ts` Wave 21 block
  (404 NotFound on `/api/v1/errors/{code}` for unknown codes)

## Linked OpenAPI / tRPC procedures

- `GET /api/v1/errors/{code}`     → `getErrorCatalogEntry`

The HTML page is the human-readable face of the same catalog row
the JSON endpoint returns. Both share the registry in
`src/lib/api/error-catalog.ts`.

## Known defects

- **DEF-0007 — Closed (fixed) 2026-04-19.** Same root cause as the
  `/errors` index card: the middleware's public allow-list was missing
  `/errors/`, so every Problem body's `type` URI redirected anonymous
  callers to `/auth/signin` instead of resolving to the catalog detail
  page. Fixed by adding `pathname.startsWith("/errors/")` to
  `src/middleware.ts`. Runtime gate now exists at
  `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts` and explicitly
  exercises both kebab-case and snake_case detail URLs. See
  `docs/qa/defects/DEF-0007.md` for the captured 307-evidence and
  before/after probe table.

## Last verified

2026-04-19 by Wave 21 (error catalog launch — both URL casings
pre-rendered; unknown codes correctly resolve to Next.js 404; see
ADR 0027) AND DEF-0007 closure (kebab + snake forms confirmed
returning 200 anonymously via direct HTTP probe — see DEF-0007.md
"Attempt 1" for `/errors/insufficient-scope` and
`/errors/insufficient_scope` both 200).
