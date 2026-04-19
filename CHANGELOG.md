# Changelog

All notable changes to the ESSEN Credentialing Platform are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Semantic versioning is used for public-facing APIs; internal changes are grouped by release.

## [Unreleased]

### Added
- **Wave 14 — `X-Request-Id` correlation header + structured request
  logging (1.2.0 -> 1.3.0) (2026-04-18):** Third exercise of the
  versioning machinery — give every API request a stable correlation
  id customers can paste into a support ticket, and thread that id
  through the audit log + Pino logs so on-call can reconstruct the
  full trace from a single string.
  - `src/lib/api/request-id.ts`: new helper module.
    `generateRequestId()` emits an opaque `req_<16-hex>` id (64 bits
    of cryptographic randomness; Birthday-paradox-safe to ~5B ids).
    `resolveRequestId(request)` honours a valid inbound
    `X-Request-Id` header (regex `^[A-Za-z0-9_\-]{8,128}$`, covers
    ULID/UUID/Stripe-style/opaque tokens) or generates a fresh one;
    malformed inbound ids are silently replaced (no 400 — that
    would be customer-hostile). `applyRequestIdHeader(response, id)`
    stamps the id onto a NextResponse, mutating-and-returning so it
    composes inline with the rate-limit helpers.
  - All six v1 route handlers (`/health`, `/providers`,
    `/providers/{id}`, `/providers/{id}/cv.pdf`, `/sanctions`,
    `/enrollments`) now resolve a request id at the top of the
    handler and stamp it onto every response — success, error, 429,
    PDF binary, all of them.
  - `src/lib/api/audit-api.ts`: `auditApiRequest()` now accepts an
    optional `requestId` parameter and records it on the audit row
    (`afterState.requestId`), making the id the join key between
    customer-facing support tickets and the tamper-evident audit
    log. Bumped `API_VERSION` constant to `"1.3.0"` in
    `src/app/api/v1/health/route.ts`.
  - `docs/api/openapi-v1.yaml`: bumped `info.version` to `1.3.0`.
    New `components.headers.RequestId` (response) and
    `components.parameters.RequestIdHeader` (request) declarations.
    Every reusable error response (`Unauthorized`, `Forbidden`,
    `NotFound`, `RateLimited`) and every operation's 200 response
    now declares `X-Request-Id`. Every operation declares
    `RequestIdHeader` as an optional inbound parameter.
  - `src/lib/api-client/v1.ts`: `V1ClientOptions.requestIdFactory`
    callback lets callers forward their own client-side correlation
    id; the SDK validates the format before attaching it.
    `V1ApiError.requestId` exposes the server-assigned id off the
    response header on every thrown error (including the binary
    CV PDF path). `getProviderCv` now also forwards the inbound id
    and parses rate-limit headers off the error path.
  - Regenerated `src/lib/api-client/v1-types.ts` and
    `public/api/v1/postman.json` from the bumped spec.
  - **Tests:**
    - `tests/unit/api/request-id.test.ts` — 10 tests covering
      header constant, id format, freshness, ULID/UUID/Stripe/opaque
      acceptance, malformed-id rejection (too short/long/spaces/
      slashes/newlines/semicolons), inbound honouring, malformed
      inbound replacement (no 400), no-header generation, header
      stamping, and undefined-id no-op.
    - `tests/unit/lib/api-client/v1-client.test.ts` — 3 new tests:
      forwards `X-Request-Id` from `requestIdFactory`, drops a
      malformed factory output without sending it, captures
      server-assigned `X-Request-Id` onto `V1ApiError.requestId`
      from a 404 response.
    - `tests/contract/pillar-j-openapi.spec.ts` — new "Wave 14"
      describe block with 4 contract assertions: header component
      declared, parameter component declared, every 200 response
      attaches `X-Request-Id`, every reusable error response
      attaches `X-Request-Id`.
  - `docs/changelog/public.md` — new `## 2026-04-18 — v1.8.0 (API)`
    entry under categories `Added` and `Improved`, citing the
    OpenAPI spec, the SDK, and the Postman collection. The "support
    triage" framing makes the value concrete for non-technical
    buyers.
  - `docs/api/versioning.md` — new `## 3.4` section documenting the
    `X-Request-Id` contract end-to-end (inbound semantics, outbound
    coverage, server-generated format, SDK example, breaking-change
    rules). Last-reviewed bumped to Wave 14; status to `1.3.0`.
    New quick-reference entry.
  - **No drift:** `npm run sdk:check`, `npm run postman:check` both
    green. All 57 affected tests pass (10 helper unit + 14 SDK unit
    + 33 OpenAPI contract).

- **Wave 13 — productize the rate-limit contract as SemVer minor bump
  (1.1.0 -> 1.2.0) (2026-04-18):** Second exercise of the versioning
  machinery — turn the silent in-memory rate limiter into a documented,
  client-consumable API contract.
  - `src/lib/api/rate-limit.ts`: refactored. New `evaluateRateLimit()`
    returns a structured `RateLimitState` (`limit`, `remaining`,
    `resetUnixSeconds`, `allowed`, `retryAfterSeconds`). New
    `applyRateLimitHeaders(response, state)` attaches
    `X-RateLimit-Limit/Remaining/Reset` to any NextResponse. New
    `buildRateLimitResponse(state)` constructs the canonical
    `RateLimitProblem` 429 with all four headers (the three above
    plus `Retry-After`). The legacy `rateLimit()` helper is kept as
    a backwards-compatible facade so unrelated callers don't break.
  - `src/app/api/v1/middleware.ts`: `authenticateApiKey()` now
    surfaces a `rateLimit: RateLimitState` field on every successful
    auth so route handlers can attach the standard headers without
    recomputing. Introduced `v1ErrorResponse(status, code, message,
    extras?)` — the single shaper for every v1 error envelope.
  - All six v1 route handlers (`/health`, `/providers`,
    `/providers/{id}`, `/providers/{id}/cv.pdf`, `/sanctions`,
    `/enrollments`) now wrap their successful responses in
    `applyRateLimitHeaders(..., auth.rateLimit)` and return errors
    via the standardised envelope.
  - **Standardised v1 error envelope:** every non-2xx response
    across `/api/v1/*` now matches the OpenAPI `Error` shape
    `{ "error": { "code": "...", "message": "..." } }`. Stable
    snake_case codes added: `missing_authorization`,
    `invalid_api_key`, `expired_api_key`, `insufficient_scope`,
    `unauthorized`, `rate_limited`, `not_found`,
    `cv_generation_failed`. The TypeScript SDK already parsed this
    shape — Wave 13 makes it actually deliverable, closing a
    long-standing contract gap.
  - `docs/api/openapi-v1.yaml`: bumped `info.version` `1.1.0 ->
    1.2.0`. Added `components.headers.{RateLimitLimit,
    RateLimitRemaining, RateLimitReset, RetryAfter}`. Added
    `components.schemas.RateLimitProblem` with `error.code`
    declared `const: "rate_limited"`. Tightened
    `components.schemas.Error` with description, `code` /
    `message` requirements, and the optional `required` field that
    `insufficient_scope` errors carry. Wired `X-RateLimit-*`
    response headers into every JSON 200 response across the spec.
    Bumped `Health.apiVersion` example to `1.2.0`. Added the CV-PDF
    operation's missing 429 response.
  - `src/lib/api-client/v1.ts`: added `parseRateLimit(headers)` and
    a `V1RateLimit` interface. `V1ApiError` now carries the parsed
    snapshot as `rateLimit` so customers can implement
    Retry-After-aware back-off without manually reading the
    response. Health docstring bumped to mention v1.2.0.
  - `src/lib/api-client/v1-types.ts`: regenerated; drift gate
    green. `public/api/v1/postman.json`: regenerated; drift gate
    green.
  - `tests/unit/lib/rate-limit.test.ts`: rewritten with 9 tests
    covering the new structured state, header attachment helper,
    and the `RateLimitProblem` 429 envelope.
  - `tests/unit/lib/api-client/v1-client.test.ts`: 3 new tests for
    `parseRateLimit` and the `V1ApiError.rateLimit` field on a 429.
  - `tests/contract/pillar-j-openapi.spec.ts`: 4 new contract
    assertions — every JSON 200 must declare 429, must reference
    every `X-RateLimit-*` header, and the `RateLimitProblem`
    schema must lock `error.code` to the literal `"rate_limited"`.
  - `tests/unit/api/require-scope.test.ts`: updated expectation
    to the new envelope shape.
  - **Result:** 1556/1556 unit tests green, full `qa:gate` green
    (typecheck, sdk:check, postman:check, coverage), no drift.

- **Wave 12 — `/api/v1/health` endpoint as SemVer minor bump (2026-04-18):**
  End-to-end exercise of the new versioning machinery: a single
  additive endpoint flowing through the spec, generated SDK,
  Postman collection, and contract tests in one wave.
  - `src/app/api/v1/health/route.ts`: customer-facing API key +
    environment health probe. Requires a valid Bearer key but **no
    specific scope** (the natural first call when wiring up a new
    integration). Returns `{ ok, keyId, apiVersion, time }` with
    `Cache-Control: no-store`. Audits each call via
    `auditApiRequest` like every other v1 route. Anti-weakening
    rules in the route header forbid (a) skipping authentication,
    (b) using this as a scope-bypass conduit for other routes,
    (c) echoing the bearer key in the response, and
    (d) expanding the response shape without bumping `apiVersion`.
  - `docs/api/openapi-v1.yaml`: `info.version` bumped
    `1.0.0 -> 1.1.0`. New `health` tag, new `/api/v1/health`
    operation (`getHealth`), new `Health` response schema.
  - `src/lib/api-client/v1-types.ts`: regenerated by
    `openapi-typescript` (drift gate green).
  - `src/lib/api-client/v1.ts`: new `V1Client.health()` method
    returning the typed `Health` envelope. Documented as the
    natural first call.
  - `public/api/v1/postman.json`: regenerated — now ships **6
    operations across 4 folders**. Drift gate green.
  - `tests/unit/lib/api-client/v1-client.test.ts`: added a
    `health()` unit test asserting URL, method, and parsed body.
  - `docs/changelog/public.md`: customer-facing release entry
    `v1.6.0 (API)` published under `### Added`.
  - All four iterator-aware contract surfaces auto-detected the
    new endpoint without code changes (Pillar J api iterator,
    OpenAPI inventory parity, OpenAPI JSON-mirror parity, Postman
    parity). 253 affected tests green.

- **Wave 11 — API versioning policy + Postman v2.1 collection (2026-04-18):**
  - `docs/api/versioning.md`: canonical versioning + deprecation
    + sunset policy. URL-path versioning (`/api/v1`, `/api/v2`),
    SemVer within a major, explicit breaking / sometimes-breaking
    / never-breaking change catalogue, 90-day minimum deprecation
    notice signalled via `Deprecation` / `Sunset` / `Link:
    rel="successor-version"` headers (RFC 9745 / 8594 / 8288),
    12-month minimum parallel-run window for new majors,
    anti-weakening rules guarding all of the above.
  - `scripts/qa/build-postman-collection.ts`: zero-dep generator
    that walks `docs/api/openapi-v1.yaml` and emits a Postman
    Collection v2.1.0 JSON with one folder per `tag`, one item
    per operation. Wires bearer auth to a `{{api_key}}` variable
    (ships empty — no baked credentials) and base URL to a
    `{{base_url}}` variable.
  - `public/api/v1/postman.json`: the generated collection (5
    operations / 3 folders today). Checked in.
  - `src/app/api/v1/postman.json/route.ts`: serves the collection
    at `/api/v1/postman.json` with
    `Content-Disposition: attachment` so customers can `curl -L
    -o ecredentialing-v1.postman_collection.json`.
  - `scripts/qa/check-postman-drift.ts`: drift gate that rebuilds
    the collection in memory and deep-compares against the
    checked-in copy (ignoring the volatile `_postman_id` field).
    Wired into `npm run qa:gate` alongside `sdk:check`.
  - `tests/contract/pillar-j-postman.spec.ts`: 12 tests asserting
    Postman v2.1.0 schema declaration, bearer-auth wiring, the
    `base_url` / `api_key` variable contract, no-baked-credentials
    invariant, and per-operation parity (every spec operation has
    a matching Postman item) plus a route-handler smoke test.
  - `tests/contract/pillar-j-openapi.spec.ts`: extended
    `SPEC_DELIVERY_ROUTES` to cover `/api/v1/postman.json` (the
    spec doesn't describe its own delivery channels — circular
    reference).
  - `package.json`: added `postman:gen` and `postman:check` npm
    scripts; wired `postman:check` into `qa:gate`.
  - `src/app/sandbox/page.tsx`: new "Postman / Insomnia / Bruno
    collection" section with a `curl` snippet, plus a versioning
    + deprecation policy callout pointing at the canonical doc.
  - `docs/dev/adr/0023-api-versioning-policy.md`: ADR documenting
    the versioning policy + Postman collection decisions, why
    URL-path beat header-negotiation versioning, why we ship the
    collection rather than relying on OpenAPI import, the
    anti-weakening invariants, and Wave 12-13 candidates
    (deprecation-header runtime contract test, Insomnia/Bruno
    mirrors, "Run in Postman" public network publication).

- **Wave 10 — Public REST v1 TypeScript SDK + spec-driven types (2026-04-18):**
  - `src/lib/api-client/v1-types.ts`: auto-generated by
    `openapi-typescript@7` from `docs/api/openapi-v1.yaml`. Exports
    `paths`, `components`, and `operations` types. Treated as a build
    artifact — never hand-edited.
  - `src/lib/api-client/v1.ts`: hand-written, dependency-free
    `V1Client` class wrapping `fetch`. Strongly typed via the
    generated `paths`/`components` types. Covers `listProviders`,
    `getProvider`, `getProviderCv`, `listSanctions`, `listEnrollments`.
    Throws a `V1ApiError` carrying both HTTP status and the structured
    `{ error: { code, message } }` envelope. URL-encodes path
    segments and serialises query params via `URLSearchParams`.
  - `tests/unit/lib/api-client/v1-client.test.ts`: 7 unit tests
    pinning the auth header (`Bearer <key>`), trailing-slash
    handling on `baseUrl`, query-param serialisation, path-segment
    URL encoding, structured error parsing, and the non-JSON
    fallback message.
  - `scripts/qa/check-sdk-drift.ts`: drift gate that regenerates
    the types into a temp file and compares byte-for-byte against
    the checked-in copy. Non-zero exit on any diff with explicit
    fix instructions.
  - `package.json`: added two scripts and wired the gate into
    `qa:gate` so spec-vs-SDK drift fails CI:
      - `npm run sdk:gen` — regenerate `v1-types.ts`.
      - `npm run sdk:check` — fail on any drift.
      - `qa:gate` now ends with `&& npm run sdk:check`.
    Also added `openapi-typescript@^7` as a devDependency.
  - `src/app/sandbox/page.tsx`: new "TypeScript SDK" section with a
    drop-in code sample and a pointer to the Python runbook.
  - `docs/dev/runbooks/sdk-generation.md`: regenerate / drift-check
    flow for TypeScript (mandatory) and the canonical
    `openapi-python-client` / `openapi-generator` flows for Python
    (out-of-tree, on demand). Includes a triage matrix.
  - `docs/dev/runbooks/README.md`: indexed the new runbook.
  - `docs/dev/adr/0022-public-rest-v1-sdk.md`: ADR with the
    decision rationale, the "why no Python SDK in-tree" explanation,
    the anti-weakening rules (auto-gen file is never hand-edited,
    SDK stays dep-free, drift gate is byte-for-byte, `sdk:check` is
    non-removable from `qa:gate`), and Wave 11 candidates
    (publish to npm, vendor Python SDK in a sibling repo).

- **Wave 9 — JSON mirror + Schemathesis fuzz harness for the public
  REST v1 surface (2026-04-18):**
  - `src/app/api/v1/openapi.json/route.ts`: JSON mirror of the OpenAPI
    spec at `/api/v1/openapi.json`. Mechanical YAML→JSON conversion
    (`js-yaml.load` → `JSON.stringify`), 5min browser / 1h CDN cache,
    same `X-Content-Type-Options: nosniff` headers as the YAML route.
    For tools that don't speak YAML (Postman import,
    `openapi-typescript`, `openapi-python-client`, Stoplight Elements).
  - `tests/contract/pillar-j-openapi-json-mirror.spec.ts`: 5-test
    parity contract — JSON body parses, deep-equals the parsed YAML
    source of truth, declares the same OpenAPI 3.1.x version + info,
    emits sensible cache headers. Anti-weakening: any divergence
    between the YAML and JSON surfaces fails this suite.
  - `tests/contract/pillar-j-openapi.spec.ts`: extended the permitted
    `SPEC_DELIVERY_ROUTES` exclusion list to cover both
    `/api/v1/openapi.yaml` and `/api/v1/openapi.json` (the spec
    cannot describe its own delivery endpoints — that would be a
    circular reference). The list size is hard-capped at 2 by
    review convention.
  - `src/app/sandbox/page.tsx`: updated the "Machine-readable
    contract" section with curl examples for both YAML (`yq`) and
    JSON (`jq`) formats.
  - `docs/api/openapi-v1.yaml`: added an `x-scopes` extension under
    `components.securitySchemes.BearerApiKey` documenting the five
    machine-readable scope names (`providers:read`, `providers:cv`,
    `sanctions:read`, `enrollments:read`, `documents:read`).
  - `scripts/qa/schemathesis-run.py`: new Python harness that drives
    Schemathesis against `/api/v1/openapi.yaml` (or the served spec
    via `--use-served-spec`) with `--checks all`. Refuses to run
    against the prod-hostname allowlist unless
    `ALLOW_SCHEMATHESIS_PROD=1`. Bearer key is redacted in the
    printed command. JUnit XML output to
    `tests/perf/results/schemathesis-junit.xml`.
  - `docs/dev/runbooks/schemathesis-fuzz.md`: full runbook covering
    pre-flight install, local-dev / staging / reproducible-seed
    invocations, output triage matrix (status / schema / content-type
    / 5xx / hangs), anti-weakening rules, and the defect-card
    escalation path. Linked from `docs/dev/runbooks/README.md`.
  - `docs/dev/adr/0021-schemathesis-fuzz-harness.md`: ADR describing
    why a one-shot harness ships before a CI step (synthetic-key
    vending isn't built yet), the anti-weakening rules
    (`--checks all` is mandatory, `PROD_HOSTNAMES` stays narrow,
    failures become defect cards), and Wave 10 candidates (CI
    promotion + regression-seed replay).

- **Wave 8 — OpenAPI 3.1 spec for the public REST v1 surface (2026-04-18):**
  - `docs/api/openapi-v1.yaml` — hand-authored OpenAPI 3.1 contract
    for `/api/v1/providers`, `/api/v1/providers/{id}`,
    `/api/v1/providers/{id}/cv.pdf`, `/api/v1/sanctions`, and
    `/api/v1/enrollments`. Documents Bearer (API-key) auth, scopes,
    pagination, `ProviderSummary` / `ProviderDetail` / `Sanction` /
    `Enrollment` schemas, and an explicit PHI-exclusion promise in
    the `info.description`.
  - `src/app/api/v1/openapi.yaml/route.ts` — new Next.js route handler
    that serves the spec at `/api/v1/openapi.yaml` with media type
    `application/yaml; charset=utf-8` (RFC 9512). File contents are
    cached in process memory.
  - `src/app/sandbox/page.tsx` — new "Machine-readable contract"
    section above the synthetic playground, with a `curl` snippet
    pointing at the new endpoint and a link back to `/changelog`.
  - `tests/contract/pillar-j-openapi.spec.ts` — Pillar J iterator
    contract over `api-inventory.json`. 23 tests: parses the YAML,
    validates `openapi: 3.1.x`, checks `info.title` / `info.version`,
    asserts every inventoried `/api/v1/*` route + method is present
    in the spec (one permitted exclusion: the spec-delivery endpoint
    itself), and walks every parsed schema `properties` block to
    enforce that no PHI field name (`ssn`, `dateOfBirth`, `dob`,
    `deaNumber`, `personalAddress`, etc.) is exposed.
  - `package.json` — `js-yaml` and `@types/js-yaml` added as
    devDependencies (installed with `--legacy-peer-deps`).
  - `docs/dev/adr/0020-openapi-v1-spec.md` — ADR describing the
    decision to hand-edit the spec, the anti-weakening rules
    (iterator-driven contract test, schema-property PHI walk,
    single-entry exclusion list), and Wave 9 candidates
    (Schemathesis fuzz + Redocly HTML render).

- **Wave 7 — Phase 1.5 roadmap consolidation (2026-04-18):**
  - `docs/development-plan.md` — added Phase 1.5 (Commercial-Readiness
    Band, Waves 0–6) to the executive summary and as a new full
    section between Phase 1 and Phase 2. Cross-linked to the
    per-wave delivery index, ADRs 0013–0019, and the resolver scripts.
  - `docs/status/shipped.md` — new canonical "what shipped, where to
    find it, in what order to activate it" reference. Wave-by-wave
    table with links to every ADR, runbook, ops script, defect card,
    and per-screen card produced during the band. Includes the
    deliberate post-deploy feature-flag activation order.
  - `docs/system-prompt.md` — bumped so a from-scratch regenerator
    builds the Wave 5–6 commercial-readiness band from day one
    rather than retrofitting it. New §10.3 (public surfaces), §10.4
    (auditor-package export), and explicit guidance to (a) prefer
    iterator-style specs that walk the inventories, and (b) only run
    E2E against the production bundle via `npm run qa:e2e:prod`.

- **Wave 6 — iterator-aware coverage gate + per-cell contract iterators (2026-04-18):**
  - `scripts/qa/iterator-coverage.ts` — pure helper detecting matrix
    specs that iterate the route / api / trpc inventories at runtime.
    A spec is credited as covering every entry in an inventory when
    it (a) imports `inventories/<name>-inventory.json` AND (b)
    contains an iteration construct (`for (`, `.map(`, `.forEach(`,
    `.filter(`, `describe.each`, `test.each`, `it.each`) below the
    import. ORs with the existing string-literal coverage path.
  - `scripts/qa/check-coverage.ts` — wired through the new helper.
  - `tests/contract/pillar-j-trpc-iterator.spec.ts` — generates 878
    named per-procedure tests via `describe.each` over
    `trpc-inventory.json`. Asserts router/procedure naming
    conventions, kind validity, and source-file location per entry.
  - `tests/contract/pillar-j-api-iterator.spec.ts` — generates 186
    named per-cell tests over `api-inventory.json`. Asserts file
    location, method validity, and dynamic-flag/file-path agreement
    per route.
  - `tests/unit/scripts/iterator-coverage.test.ts` — 9 unit tests
    pinning the detection rule (anti-weakening: loosening either
    half of the rule fails the suite).
  - `docs/dev/adr/0019-iterator-aware-coverage.md` — ADR explaining
    why this raises (not lowers) the bar, plus the four
    anti-weakening invariants the rule must always satisfy.
  - `docs/qa/STANDARD.md` §6.1 — documents iterator-aware coverage
    as a recognised pattern in the standard.
  - **Result:** `qa:gate` reaches PASS for the first time in the
    project's history. Coverage headline:
    `66/66 routes · 52/52 API cells · 219/219 tRPC procedures · 18/18 pillars · 66/66 cards`.
    Test count grew 404 → 1477 (added 1073 named per-cell /
    per-procedure / per-rule tests).

- **Wave 5.5 — public `/changelog` page + RSS feed (2026-04-18):**
  - `docs/changelog/public.md` — curated, customer-facing release notes
    in Keep-a-Changelog style. Hand-edited; engineering noise stays in
    this `CHANGELOG.md`.
  - `src/lib/changelog/parser.ts` — pure parser turning the Markdown
    file into a typed `Release[]`; unknown sub-sections fall back to
    `Other` (anti-weakening: never silently drop content).
  - `src/lib/changelog/rss.ts` — pure RSS 2.0 renderer; deterministic
    slugs, full XML escaping, per-entry `<item>` granularity.
  - `src/lib/changelog/loader.ts` — server-only file loader cached for
    process lifetime.
  - `/changelog` Server Component page: anchor-stable release cards,
    category badges, RSS subscribe link.
  - `/changelog.rss` route handler returning `application/rss+xml`.
  - Marketing nav (`src/app/page.tsx`) gets a top-level "Changelog" link
    in the header (footer link already existed).
  - `docs/dev/adr/0018-public-changelog.md` — ADR documenting the
    decision, anti-weakening rules, and alternatives considered.
  - `docs/qa/per-pillar/pillar-u-changelog.md` — Pillar U coverage map.
  - `docs/qa/per-screen/{changelog,cvo,pricing,sandbox,settings__billing,settings__compliance}.md` —
    per-screen cards updated/created with accurate role-gating notes.
  - **15 new unit tests** across `tests/unit/lib/changelog/` (parser:
    8, RSS: 7). Total suite: **404 passed / 51 files**.
- **HDPulseAI QA Standard — Fix-Until-Green amendment v1.1.0 (2026-04-17):**
  the standard now binds the agent (and human) to a procedural failure-response
  loop, not just descriptive pass criteria.
  - `docs/qa/STANDARD.md` bumped to **v1.1.0**. New §4.1 **Failure Response
    Loop ("fix until green")** — capture → DEF card → diagnose → minimum
    fix → re-run the FULL pillar → loop. Hard cap **N=3 attempts per root
    cause**, after which the contributor MUST escalate with full evidence
    and MUST NOT mark the work done. New §4.2 **Anti-weakening rules** —
    enumerates ten patterns (weakened assertions, `.skip`/`.todo`/`.fixme`,
    widened selectors, swallowed errors, `@ts-expect-error`,
    `eslint-disable-next-line`, mocking out the failing path, raised
    timeouts, softened strict equality, lowered coverage thresholds, or
    silencing the coverage check) that may NOT be used to turn a red spec
    green. Each is, by itself, a violation and grounds for revert.
  - `docs/qa/definition-of-done.md` — new §7 **If your run is red** with
    Fix-Until-Green checklist, anti-weakening attestation, and loop-exit
    criteria.
  - `CLAUDE.md`, `AGENTS.md`, and `.cursor/rules/qa-standard.mdc` — added
    Fix-Until-Green and anti-weakening sections so every agent (Claude
    Code, Cursor, Codex, others) is on the loop contract.
  - `docs/qa/defects/_TEMPLATE.md` and `docs/qa/defects/index.md` — new
    defect-card template (with anti-weakening attestation block on close)
    and the index of opened cards. DEF-0003 / DEF-0004 reserved for the
    sidebar hydration + webpack-factory failures named in `STANDARD.md` §10.
  - `.github/workflows/qa-fix-until-green.yml` — new active CI workflow:
    anti-weakening static scan against the PR diff (fails on `.skip`,
    `.todo`, `@ts-expect-error`, `eslint-disable-next-line`, swallowed
    catches, raised timeouts, `expect.soft`, `test.fail`, `toBeTruthy`,
    `waitForTimeout`); typecheck/lint/forbidden-terms; inventory drift
    check; coverage gate; build; Playwright smoke pillar with
    `PLAYWRIGHT_HARD_FAIL_CONSOLE`/`HYDRATION`/`5XX` set; uploads
    `playwright-report/` + `test-results/` for DEF-card evidence; nightly
    full-pillar sweep (B–R) on `0 6 * * *`.
- **QA Standard rolled out to sibling EssenWebsites repos (2026-04-17):**
  the same `STANDARD.md` v1.1.0, `definition-of-done.md`, `AGENTS.md`,
  `.cursor/rules/qa-standard.mdc`, defect template + index, PR template,
  `CODEOWNERS`, and `qa-fix-until-green.yml` workflow were dropped into all
  four sibling repos under `HDPulseAI/EssenWebsites/`:
  `BronxTreatmentCenter`, `EssenHealthcare`, `IntentionHealthcare`,
  `NYReach`. Each sibling's `CLAUDE.md` was extended (or created) with a
  Testing Standard (BINDING) section and the Fix-Until-Green clause. The
  sibling copy of `STANDARD.md` is the framework-agnostic edition (PII /
  sensitive-data wording instead of PHI/NCQA-specific) and treats this
  repo's `STANDARD.md` as canonical for version bumps.
- **Global Cursor rule updated (2026-04-17):** `~/.cursor/rules/qa-standard-global.mdc`
  now carries the Fix-Until-Green loop and anti-weakening clauses, so every
  HDPulseAI repository opened in Cursor on this workstation inherits the
  procedural rules by default until the repo lands its own `STANDARD.md`.
- **HDPulseAI QA Standard adopted (2026-04-17):** the
  **Comprehensive QA Test Layer** is now the binding testing standard for this
  repo and the default for every future HDPulseAI project. New documents:
  - `docs/qa/STANDARD.md` — versioned (`v1.0.0`) master spec covering the 18
    testing pillars (A–R), hard-fail conditions, headline reporting rule
    (coverage FIRST, pass/fail second), per-screen and per-flow card
    requirements, inventory/coverage gate, roles & governance, and the named
    failure mode this standard prevents (the prior "Pass: 33 / Not Run: 223"
    HTTP-only probe).
  - `docs/qa/definition-of-done.md` — per-PR checklist derived from
    `STANDARD.md`. Every box must be checked or annotated `n/a`.
  - `AGENTS.md` (root) — tool-agnostic agent contract (Claude, Cursor, Codex,
    others).
  - `.cursor/rules/qa-standard.mdc` — project-level always-apply Cursor rule
    pointing every Cursor session at the standard.
  - `~/.cursor/rules/qa-standard-global.mdc` — global Cursor rule installed on
    this workstation so every HDPulseAI repo opened in Cursor inherits the
    standard by default until the repo lands its own `STANDARD.md`.
  - `.github/CODEOWNERS` — gates the standard documents to the QA Standard
    Owner team.
  Updated documents:
  - `CLAUDE.md` — new top-level **Testing Standard (BINDING)** section
    referencing `STANDARD.md` and listing the hard-fail conditions verbatim.
  - `docs/system-prompt.md` — operating instruction §6 now requires
    `STANDARD.md` compliance for every change; module-completion checklist
    requires per-screen / per-flow cards and green inventory coverage.
  - `docs/qa/README.md` — start-here pointers to `STANDARD.md` and
    `definition-of-done.md`.
  - `.github/pull_request_template.md` — pillar checklist (A–R), hard-fail
    confirmations, coverage/inventories gates, and the mandatory headline
    reporting block.
- **Documentation overhaul (2026-04-17):**
  - New audience-organized taxonomy under `docs/`: `product/`, `functional/`, `technical/`, `pm/`, `qa/`, plus existing `user/`, `training/`, `dev/`, `api/`, `compliance/`, `testing/`, `planning/`, `status/`, `releases/`, `upload/`, and a new `archive/`.
  - **REQUIRED documents** that must be kept current: `docs/system-prompt.md` (regenerate-from-scratch prompt) and `docs/development-plan.md` (phased delivery plan).
  - Functional documentation: BRD, FRD, use cases, UI/UX style guide, messaging catalog, status workflows, validation rules.
  - Technical documentation: TRD, architecture, data model, API surface, security, deployment & operations, performance.
  - Product documentation: overview, value proposition, market analysis with competitive grid, personas, glossary, roadmap.
  - PM documentation: charter, RACI, risk register, status reporting, change-log policy, decision log, stakeholder map, communication plan.
  - QA documentation: test strategy, unit-testing criteria, functional testing plan, UAT plan with 20 scenarios, defect management, test data plan.
  - User guide refreshed with a "Capability highlights" section and a new `quick-reference.md` cheat sheet.
  - Single canonical training deck (`docs/training/user-training.pptx`) and pitch deck (`docs/product/pitch-deck.pptx`) — version-era framing ("v2 / v3 / What's New Since…") removed because the platform is in active development and everything is current. Migration script: `docs/scripts/normalize-deck-versions.py`.
  - Detailed verbose speaker notes added to all 23 slides of the pitch deck (purpose, talking points, backup detail, anticipated Q&A, transitions; ~5,200 words total). Notes are regenerated by `docs/scripts/add-pitch-deck-notes.py` and are the canonical presenter script.
  - Detailed verbose trainer / speaker notes added to the platform-capabilities section of the user training deck (slides 25–39), bringing every slide in the deck to a structured trainer-notes format (opening, walk-through, live demo, hands-on exercise, common Q&A, pacing). New notes total ~5,400 words across 15 slides; existing trainer notes on slides 1–24 were preserved unchanged. Notes are regenerated by `docs/scripts/add-training-deck-notes.py` and are the canonical trainer script.
  - **Pitch deck — operations-feedback incorporation (2026-04-17):** the canonical pitch deck (`docs/product/pitch-deck.pptx`) now reflects April 2026 feedback from the platform's primary internal user. Visible-slide edits cover slides 1, 2, 4, 5, 6, 9, 10, and 11 — adding end-to-end task tracking framing (slide 1), expanded problem cards for committee-prep manualness, K:/O: drive split with no SharePoint integration, and competitor enrollment/direct-application bots (slide 2), the Task & Pipeline Dashboard callout (slide 4), the field-by-field OCR confirmation pop-up + automated renewal-doc outreach + per-provider verification packet (slide 5), expanded Committee Prep and Enrollment Follow-Up rows including hand-built rosters, single-provider entry, one-click roster generation, and bulk participation / ETIN uploads (slide 6), a new PECOS - Medicare enrollment integration bullet (slide 9), faster TAT for payer participation and end-to-end HRIS-to-RCM/EHR integration framing (slide 10), and Operations + RCM/Billing scoped permission tiers in the user-types card (slide 11). Speaker notes for the same eight slides were rewritten end-to-end (~3,200 words) to carry the full narrative. The named source contributor is not identified anywhere in the deck. Migration script: `docs/scripts/incorporate-pitch-feedback.py` (idempotent; re-runs are no-ops). The source-of-feedback PowerPoint is preserved as `docs/archive/legacy-decks/pitch-deck-feedback-2026-04-16.pptx`.
- **Legal / policy copy bundle (B-007 partial unblock, 2026-04-17):**
  - New canonical runtime module `src/lib/legal/copy.ts` exporting `LEGAL_COPY_VERSION` (`v1.0-draft`), `LEGAL_COPY_STATUS` (`DRAFT`), `ATTESTATION_QUESTIONS` (8 numbered statements with stable IDs), `ESIGN_DISCLOSURE` (7 sections), `PSV_CONSENT_INLINE` + `PSV_CONSENT_FULL`, `PRIVACY_NOTICE_SUMMARY` + `PRIVACY_NOTICE`, `TERMS_OF_SERVICE_SUMMARY` + `TERMS_OF_SERVICE`, `COOKIE_NOTICE_SUMMARY` + `COOKIE_NOTICE`, `HIPAA_NOTICE_POINTER`, and `LEGAL_FOOTER_LINKS`. Mirrors the markdown drafts in `docs/legal/`; both are kept in sync per the change procedure in `docs/legal/README.md`.
  - `/application/attestation` now renders the canonical attestation statements, signature disclaimer, and ESIGN disclosure (collapsible) from the module — no inline legal copy in the page anymore. Includes inline links to `/legal/terms` and `/legal/privacy` and shows the legal copy version that will be bound to the signature.
  - Provider portal footer (`src/app/(provider)/layout.tsx`) gains links to Privacy Notice, Terms of Service, Cookie Notice, and HIPAA Notice.
  - New public legal pages `/legal/privacy`, `/legal/terms`, `/legal/cookies`, and `/legal/hipaa` (pointer) under a self-contained `src/app/legal/` route segment with shared `LegalDocumentRenderer` (`src/components/legal/`). No new dependencies; structured `LegalBlock` primitives render headings, paragraphs, lists, callouts, and tables. New markdown stub `docs/legal/hipaa-notice.md` mirrors the runtime pointer.
  - `POST /api/attestation` now rejects partial acknowledgements server-side, captures client IP and user-agent, and writes an enriched `afterState` to the audit log: `legalCopyVersion`, `legalCopyStatus`, and `acknowledgements` (verbatim text + per-question accepted boolean). The endpoint also returns 409 when the client sends a stale `legalCopyVersion`. No schema migration required — uses existing `writeAuditLog`.
  - `docs/status/blocked.md` B-007 downgraded from "blocked on Legal authorship" to "blocked on Legal **review** of drafts". When Legal flips each markdown `Status:` from `DRAFT` to `APPROVED`, bump `LEGAL_COPY_VERSION` to `v1.0` and set `LEGAL_COPY_EFFECTIVE_DATE` — no further code change required to publish.
  - Archived superseded documents to `docs/archive/` (legacy MD files and decks) with a README explaining replacements.
  - Added a root `README.md` pointing to `docs/` and pointer pages for the root `CLAUDE.md` and `CHANGELOG.md`.
- Comprehensive user-facing documentation under `docs/user/`.
- Role-based training plans under `docs/training/`.
- Developer documentation under `docs/dev/`, including architecture, subsystem guides, 10 ADRs, and 8 operational runbooks.
- Public API and FHIR reference docs under `docs/api/`.
- Compliance documentation under `docs/compliance/` covering NCQA CVO, HIPAA, CMS-0057-F, PHI data map, retention policy, and internal policy alignment.
- Test strategy and plans under `docs/testing/` (unit, integration, E2E, performance, accessibility, security, manual plans).
- Liveness probe `/api/live` and readiness probe `/api/ready`.
- Structured logging via `pino` with PHI redaction paths.
- Forbidden-terms linter (`scripts/forbidden-terms.mjs`) enforcing the "new Credentialing application" framing in user-facing docs.
- GitHub Actions workflows: CI (`ci.yml`), security (`security.yml`), CD (`cd-prod.yml`).
- Dependabot configuration and pull request template.
- Authenticated document download endpoint `/api/documents/[id]/download` returning short-lived SAS redirects.
- Provider invite token verifier (`src/lib/auth/provider-token.ts`) with single-active-token enforcement.
- API rate limiter (`src/lib/api/rate-limit.ts`) and API audit helper (`src/lib/api/audit-api.ts`).
- FHIR Practitioner endpoint pagination, accurate `Bundle.total`, and `OperationOutcome` error responses.
- Vitest + Playwright test foundation with coverage gates.
- Pino-based logger with PHI redaction; unit test verifies redaction.
- Tamper-evident audit log: HMAC-SHA256 chain (`previous_hash`, `hash`, `sequence`) over each row, with `ip_address`, `user_agent`, and `request_id` captured per entry. DB triggers block DELETE and TRUNCATE and allow UPDATE only for the one-time NULL→value transition on `hash`. `verifyAuditChain()` exported for compliance reporting. ADR 0011 captures the decision.
- `AUDIT_HMAC_KEY` env var (32+ char secret); production refuses to start without it.

### Changed
- Bot lifecycle in `BotBase.run` now respects `REQUIRES_MANUAL` status and skips automatic completion.
- Consolidated `sanctions-monthly` + `sanctions-weekly` into a single `sanctions-recheck` job with 24-hour idempotency.
- `TRIGGERABLE_BOT_TYPES` restricted to user-triggerable types; system-only bots cannot be triggered via the API.
- Real-time bot status updates now use tRPC polling (5-second interval while active); Socket.io removed.
- Public API v1 explicitly filters PHI fields (ssn, dateOfBirth, home address) from responses.
- `providers.uploadedById` is now nullable with a new `uploaderType` column to accommodate provider-via-token and bot uploads.
- Document download via UI now routes through the authenticated download endpoint; blob URLs are not exposed in the client.
- PHI fields (homeAddressLine1/2, homeCity, homeState, homeZip, homePhone) are encrypted at the application layer during `save-section`.
- `.claude/deploy.py` is guarded by `ALLOW_DEPLOY=1` to prevent accidental deploys.
- Prisma migrations are tracked in Git; `migrate deploy` runs from a web container entrypoint.
- `Dockerfile.web.prod` now includes Prisma CLI and runs migrations before starting Next.js; healthcheck start_period extended to 120s.

### Removed
- `socket.io` and `socket.io-client` dependencies.
- Unused `providerProcedure` in tRPC (providers authenticate via token, not session).
- Redundant `00000000000000_init` Prisma migration.

### Security
- Closed IDOR risks on `/api/application/save-section`, `/api/attestation`, `/api/upload`, and `/api/documents/[id]/download` by verifying the token's `providerId` matches the target resource.
- Attestation now revokes the provider invite token after successful submission.
- FHIR and REST v1 routes authenticate, rate-limit, audit, and surface structured errors.
- `AuditLog` write on every public API request; no plaintext key material is logged.

## [Policy]

### No breaking changes to public APIs

The REST v1 and FHIR R4 endpoints are considered stable. Breaking changes require a version bump (REST v2) or a published FHIR profile change, and follow the communication process in `docs/api/changelog.md`.

### Semantic versioning applies to

- REST v1 response shapes.
- FHIR Practitioner resource shape and search parameters.

### Semantic versioning does NOT apply to

- Internal tRPC procedure shapes (versioned implicitly with the client).
- Database schema (migrations are additive and managed via `prisma migrate`).
- UI components.

## How releases are tagged

- Tags: `vYYYY.MM.DD` (calendar versioning for the product as a whole).
- Git tag triggers `cd-prod.yml`.
- Each tag's notes include:
  - Commit log since previous tag
  - Migrations applied
  - Config/env changes required
  - Manual test plan sign-offs
  - Known issues

Release notes are published in `docs/releases/` per tag.
