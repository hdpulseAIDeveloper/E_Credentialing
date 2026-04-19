# ADR 0027 — Public, machine-readable v1 error catalog

- **Status:** Accepted
- **Date:** 2026-04-19
- **Wave:** 21
- **Supersedes:** —
- **Related:**
  ADR [0020](0020-openapi-v1-spec.md) (OpenAPI spec),
  ADR [0022](0022-public-rest-v1-sdk.md) (TypeScript SDK),
  ADR [0023](0023-api-versioning-policy.md) (versioning policy),
  ADR [0024](0024-deprecation-sunset-headers.md) (deprecation headers),
  ADR [0025](0025-problem-details-rfc-9457.md) (Problem Details — body shape),
  ADR [0026](0026-server-side-request-validation.md) (server-side request validation),
  [`docs/api/versioning.md`](../../api/versioning.md) §3.10 (error catalog contract),
  [`src/lib/api/error-catalog.ts`](../../../src/lib/api/error-catalog.ts),
  [`src/app/api/v1/errors/route.ts`](../../../src/app/api/v1/errors/route.ts),
  [`src/app/api/v1/errors/[code]/route.ts`](../../../src/app/api/v1/errors/[code]/route.ts),
  [`src/app/errors/page.tsx`](../../../src/app/errors/page.tsx),
  [`src/app/errors/[code]/page.tsx`](../../../src/app/errors/[code]/page.tsx),
  [`tests/unit/api/error-catalog.test.ts`](../../../tests/unit/api/error-catalog.test.ts),
  [`docs/changelog/public.md`](../../changelog/public.md) (`v1.15.0 (API)`).

## Context

Wave 19 (ADR 0025) shipped RFC 9457 Problem Details on every v1 error
response. Each Problem body's `type` field is — per RFC 9457 §3.1.1 —
"the primary identifier for the problem type" and is supposed to be a
URI that resolves to a human-readable description of what the error
means and how to fix it. Through Wave 20 we were emitting a
`type` URI of the form
`https://essen-credentialing.example/errors/<kebab-code>` but the URI
**did not actually resolve to anything** — there was no page at
`/errors/<kebab-code>`, and no machine-readable enumeration of the
codes the platform could emit.

This had three concrete consequences:

1. **Customers couldn't enumerate the failure surface ahead of time.**
   The OpenAPI spec named individual codes inline in operation
   responses but there was no flat list "every code v1 can return,
   with its HTTP status, summary, and remediation". Onboarding a new
   integrator meant reading the entire spec to extract the set of
   codes their error handler had to dispatch on.
2. **The `type` URI's promise was unfulfilled.** Following the URI in
   a browser produced a 404. RFC 9457 §3.1.1 strongly implies the URI
   ought to be dereferenceable; the convention in well-behaved Problem
   Details deployments (Stripe, GitHub) is for the URI to land on a
   human-readable page. We were paying the contract cost (URI must
   never change for an existing code — see ADR 0025 §Anti-weakening)
   without delivering the contract benefit.
3. **There was no obvious place for "what does code X mean?" docs to
   live.** Per-code prose was scattered across operation descriptions,
   the SDK's JSDoc, and the changelog. The catalog gives every code
   exactly one home; everything else can link there.

The Wave 6 iterator-aware coverage gate caught that none of the new
`/errors/*` routes had a per-screen card or contract test, but the
gate could not generate them because there was no error-catalog
contract to test against. Wave 21 closes that loop.

## Decision

We introduced a **public, machine-readable error catalog** with three
non-negotiable properties:

1. **One source of truth** for every code the platform emits, the
   HTTP status it produces, and the human-readable English title /
   summary / description / remediation. The single source is
   [`src/lib/api/error-catalog.ts`](../../../src/lib/api/error-catalog.ts).
   Every `v1ErrorResponse` / `buildProblem` call site MUST pass a
   code that appears in the catalog; the contract test in
   [`tests/unit/api/error-catalog.test.ts`](../../../tests/unit/api/error-catalog.test.ts)
   enforces this by grepping the v1 source tree for code literals
   passed to those helpers and asserting each one has an entry.
2. **The `type` URI now resolves.** Every Problem body's `type` field
   points at `<base>/errors/<kebab-code>`, served by
   `src/app/errors/[code]/page.tsx` with both the snake_case and
   kebab-case forms accepted (so callers can either use the same
   `error.code` value verbatim or chop the URI suffix). The detail
   page is statically pre-rendered for every catalog entry so the
   URI is fast and DB-free.
3. **The catalog has both a JSON and an HTML face.** The HTML face
   (`/errors`, `/errors/{code}`) is the URL the `type` URI points
   to and the natural surface for support / integrators. The JSON
   face (`GET /api/v1/errors`, `GET /api/v1/errors/{code}`) is the
   programmatic surface for SDKs, support tooling, and dashboards
   that want to enumerate or look up codes. Both faces share the
   same registry, so they cannot disagree.

Specifics:

- **The `code` is the contract.** Renaming any `code` row is a SemVer
  breaking change because (a) clients dispatch on
  `body.error.code`, (b) the kebab-case `type` URI suffix is derived
  from it, and (c) any old SDK that already shipped will look up the
  retired URI when interpreting an old log line. Retire codes by
  setting `retiredInVersion` on the catalog row; the row stays in
  the registry forever.
- **The catalog is fully public.** Every code, every title, every
  summary, every description, every remediation is shown to any
  caller of `GET /api/v1/errors`. There is intentionally no
  org-scoped variation: the contract is identical for every tenant
  so SDKs can ship a hard-coded type guard for `…/errors/not-found`
  and trust it everywhere.
- **Authentication is "any active API key."** Like `/health` and
  `/me`, the catalog endpoints accept any active key with any scope
  (or none). This makes the catalog the second-most-natural call
  after `/health` when wiring up a new integration: "is my key
  active, and what failure modes do I need to handle?"
- **ETag + If-None-Match works.** The catalog only changes when the
  platform ships a new release, so the ETag is stable across
  thousands of polls. The 304 still counts against the rate-limit
  budget per the contract from ADR 0025 / Wave 17.
- **Both URL casings are accepted.** The path parameter on
  `GET /api/v1/errors/{code}` and the dynamic route on
  `/errors/[code]` accept both `insufficient_scope` and
  `insufficient-scope`, normalising internally to the snake_case
  registry key. This means callers can pass the raw `error.code`
  value or chop the `type` URI suffix verbatim — whichever is
  closer to hand.
- **Unknown codes are 404.** The catalog is the contract; an
  unknown code returns a Problem-shaped 404 with extension member
  `requestedCode` carrying the verbatim path parameter so the
  customer can see what they typed. We deliberately do NOT
  synthesise a placeholder entry for unknown codes — that would let
  the catalog drift from reality silently.
- **The OpenAPI spec is the source of truth for the wire shape.**
  Spec bumped from `1.9.0` to `1.10.0`. New `errors` tag, new
  `/api/v1/errors` and `/api/v1/errors/{code}` paths, new
  `ErrorCatalogEntry` and `ErrorCatalogList` schemas. The drift
  gate (`npm run sdk:check` + `npm run postman:check`) fails fast
  if the SDK or Postman collection diverges.
- **The SDK gets two new methods.** `client.listErrors()` and
  `client.getError(code)` thin wrappers around the JSON endpoints,
  fully typed via the regenerated `paths` / `components` from
  `openapi-typescript`. No new types to maintain by hand —
  `V1ErrorCatalogEntry` is just a re-export of the generated
  schema.
- **The legacy `PROBLEM_TITLES` map stays, derived from the
  catalog.** Existing callers that imported `PROBLEM_TITLES` keep
  working unchanged — the map is now built at module load by
  looking up each title in the catalog with a defensive fallback,
  so the catalog cannot accidentally regress historical titles.
  New code SHOULD call `findCatalogEntry(code).title` directly.

## Consequences

### Positive

- **The `type` URI fulfils its RFC 9457 contract.** A customer can
  follow any Problem body's `type` URI into a real page that tells
  them what the error means and how to fix it, in one click, without
  waiting for support.
- **The failure surface becomes enumerable.** A new integrator can
  hit `GET /api/v1/errors` and immediately see every code they need
  to handle, with the same English text the support team uses, and
  with the `sinceVersion` field showing what's new since their last
  integration.
- **Per-code documentation has one home.** The English description
  and remediation text moves from being scattered across operation
  descriptions and JSDoc into one place. The OpenAPI spec, the SDK,
  the public changelog, and support tickets can all link to the
  same canonical URL.
- **Coverage gate stops complaining about orphan routes.** The new
  `/errors`, `/errors/[code]`, `/api/v1/errors`, and
  `/api/v1/errors/[code]` routes get a per-screen card
  (`docs/qa/per-screen/errors.md`) and contract tests
  (`tests/unit/api/error-catalog.test.ts` +
  `tests/contract/pillar-j-openapi.spec.ts` Wave 21 block).
- **The contract test prevents the catalog from drifting.** The
  registry-completeness test grep-walks the v1 source tree for
  string literals passed as `code` to `v1ErrorResponse` /
  `buildProblem` and asserts every one has a catalog row. Adding a
  new error code to the platform without adding it to the catalog
  is a CI failure.

### Negative

- **The catalog is now part of the wire contract.** Any new error
  code requires a catalog entry, which requires a SemVer minor bump
  on the OpenAPI spec, which requires regenerating the SDK and
  Postman. We accept this cost — it's the price of having a
  truthful contract.
- **Pre-rendering doubles the number of static pages.** We emit
  both the snake_case and kebab-case forms via
  `generateStaticParams()` so both URL shapes hit a pre-rendered
  page rather than dynamic rendering. This adds N×2 pages to the
  build (currently 10×2 = 20) — negligible, but worth noting if
  the catalog ever grows large.

### Neutral

- **The HTML pages are publicly indexable.** This is intentional —
  the canonical "what does Stripe error X mean" Google result for a
  developer should be the platform's own catalog page, not a
  third-party Q&A site that may be out of date.
- **The catalog uses the same content-type negotiation as every
  other v1 surface.** Default `application/json`, `Cache-Control:
  no-store`, `X-Content-Type-Options: nosniff`. Conditional GETs
  use the standard `evaluateConditionalGet` helper from Wave 17.

## Rejected alternatives

1. **Embed per-code prose in the OpenAPI operation descriptions
   only.** This is what we had through Wave 20. Rejected because
   (a) the same code is referenced from multiple operations and
   the prose drifted between them, (b) there was no way to
   enumerate "every code v1 can return", and (c) the `type` URI
   resolved to nothing.
2. **Generate the catalog automatically by walking the source
   tree.** Considered for "no manual maintenance" purity. Rejected
   because the per-code English (`summary`, `description`,
   `remediation`) is human-authored prose that cannot be mined
   from the call sites. The grep-based contract test gives us the
   reverse property (catalog ⊇ source) without forcing the catalog
   to be auto-generated.
3. **Make the catalog an admin-only surface.** Considered for the
   "minimum-disclosure" school of API design. Rejected because the
   exact opposite is what we want: every code, every title, every
   remediation, fully public, hard-cached, indexable by Google.
   The catalog is documentation, not a security-relevant surface.
4. **Store the catalog in the database.** Considered for "edit
   without a release" flexibility. Rejected because (a) the
   catalog is part of the wire contract — changing it requires
   regenerating the SDK and Postman anyway, (b) DB-backed prose
   creates a latency / availability dependency where there isn't
   one today, and (c) source-controlled prose gets PR review.
5. **Use a different URL shape for the JSON endpoints, e.g.
   `/api/v1/error-codes` instead of `/api/v1/errors`.** Considered
   to disambiguate "error catalog" from "error responses".
   Rejected because the `type` URI already uses `/errors/<code>`
   and matching the JSON path keeps the two surfaces symmetrical.

## Operational notes

- **No new env vars.** The `PROBLEM_BASE_URL` env var introduced in
  Wave 19 still controls the host portion of the `type` URI; the
  catalog routes are mounted at the relative path under whatever
  host serves the app.
- **Per-request cost is negligible.** The catalog is an in-memory
  module-load constant; the JSON endpoint just sorts and serialises
  it. The HTML pages are statically pre-rendered.
- **The drift gate is unchanged in shape.** Spec → SDK → Postman
  pipeline picks up `ErrorCatalogEntry`, `ErrorCatalogList`, and
  the two new operations automatically.
- **Coverage gate** (Wave 6 iterator) automatically generates one
  contract assertion per (route × method) the moment the new
  routes appear in the inventory, plus the bespoke tests added in
  this wave.

## Anti-weakening

- The catalog MUST remain the single source of truth for every
  code. New codes go into the catalog FIRST, then into call sites.
- A code's `code` value is invariant for life. Renaming is breaking.
- A code's `status` is invariant. If the same condition can produce
  two statuses, it's two codes.
- A row MAY be marked `retiredInVersion` but MUST NOT be deleted —
  the URI contract outlives the emitting code path.
- The grep-based completeness contract test MUST stay green. A
  failing test means either (a) a new code was added to a call
  site without a catalog entry — fix by adding the entry, or
  (b) a code was removed from the catalog while still in use — fix
  by reverting the catalog edit or the call site.
- The `/errors` and `/errors/{code}` HTML routes MUST remain
  publicly accessible (no auth, no tenant scoping). Restricting
  them to authenticated users would break the `type` URI's RFC
  9457 contract for unauthenticated tooling (browser devtools,
  IntelliJ HTTP client, support agents triaging in incognito).
