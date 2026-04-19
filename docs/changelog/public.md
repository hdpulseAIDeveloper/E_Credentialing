# E-Credentialing CVO Platform — public changelog

Customer-facing release notes. Engineering-internal changes
(refactors, internal tooling, dependency bumps) live in
`/CHANGELOG.md`; this file is what we publish on `/changelog`.

Each release is a `## ` heading shaped `## YYYY-MM-DD — vMAJOR.MINOR.PATCH`
with grouped subsections:

- `### Added` — net-new customer-visible capability
- `### Improved` — meaningful enhancement to an existing surface
- `### Fixed` — customer-visible defect resolution
- `### Security` — security or compliance posture change
- `### Breaking` — incompatible API or behavior change

Anti-weakening: never delete a release. Strike-through a published
note instead and add a follow-up release if the underlying claim
turned out to be incorrect.

## 2026-04-19 — v1.14.0 (API)

### Added
- **Server-side request validation with field-level error reporting.**
  Query parameters on `/api/v1/providers`, `/api/v1/sanctions`, and
  `/api/v1/enrollments` are now validated against a typed schema
  before any database work is attempted. When validation fails, the
  API returns `400 Bad Request` instead of silently coercing or
  ignoring the bad input. Examples that now surface as a 400:
  `?page=0`, `?page=-1`, `?limit=99999`, `?limit=foo`, and
  `?status=NOT_A_REAL_STATUS`. Previously, some of these were
  silently clamped, others were ignored, and the wrong subset of
  rows was returned with a `200 OK` — a long-standing source of
  customer support tickets.
- **`ValidationProblem` response shape.** The 400 body is a
  superset of the RFC 9457 `Problem` shape introduced in v1.13.0,
  with two new pieces of guaranteed structure:
  - `type` is always
    `https://essen-credentialing.example/errors/invalid-request`.
    Match on the suffix `/errors/invalid-request` to identify
    validation failures regardless of the deployment hostname.
  - `errors[]` is a non-empty array. Every entry has three string
    fields: `field` (dot-joined path inside the parameters,
    e.g. `"limit"` or `"page"`), `code` (stable Zod issue code such
    as `too_small`, `too_big`, `invalid_type`, `invalid_enum_value`,
    `invalid_string`), and `message` (human-readable English
    explanation). All offending parameters are reported in one
    response, so clients no longer need to retry once per fix.
  The legacy `error: { code: "invalid_request", message }` envelope
  is preserved at the same path as every other v1 error.
- **`BadRequest` reusable response in the OpenAPI spec.** The
  hand-authored OpenAPI document now declares
  `components.responses.BadRequest`, referenced from every list
  operation that performs query validation. SDK and Postman
  consumers pick up the new shape automatically on the next
  regeneration.
- **TypeScript SDK exposes `V1ValidationProblem` +
  `isValidationProblem()`.** Two new dependency-free integrations in
  `@e-credentialing/api-client`:
  - `V1ValidationProblem` — narrow type with `status: 400` and a
    required `errors: V1ValidationFieldError[]` array.
  - `isValidationProblem(problem)` — type guard that matches on
    both the stable `type` URI suffix AND the `errors[]` array
    shape, so a future server that emits `errors[]` on a
    non-validation Problem will not accidentally match. After a
    `V1ApiError` is thrown, do
    `if (err.problem && isValidationProblem(err.problem)) { … }`
    and TypeScript narrows `err.problem.errors` for you.

### Improved
- **Versioning policy & sandbox documentation.** `docs/api/versioning.md`
  gains a §3.9 explaining the validation contract (which routes,
  which fields, which Zod codes are stable). The public sandbox at
  `/sandbox` adds a new "Server-side request validation" section
  with a copy-pasteable `curl` example showing the 400 body shape.
- **Correction of v1.13.0 documentation.** The v1.13.0 release note
  below described content-type negotiation as
  "`Accept: application/json` returns `Content-Type: application/json`."
  That description was wrong: the actual implementation aggressively
  emits `application/problem+json` whenever the client accepts JSON
  in any form (`application/json`, `application/problem+json`, or
  `*/*`), and only falls back to `application/json` when the
  `Accept` header explicitly excludes both JSON variants. No
  behavior changed; only the documentation is being corrected. See
  `docs/api/versioning.md` §3.8 for the authoritative description.
  Similarly, the v1.13.0 note used the placeholder hostname
  `api.e-credentialing.example.com/problems/...` for `type` URIs;
  the actual URIs are
  `essen-credentialing.example/errors/...`. Match on the path
  suffix (e.g. `/errors/insufficient-scope`), not the hostname.

### Compatibility
- This is a strictly additive minor bump (v1.13.0 → v1.14.0). The
  validation contract narrows the set of inputs the server
  accepts, but every request that v1.13.0 returned `200` for still
  returns `200`. The narrowing only converts previously-undefined
  behavior (silent clamping, silent rejection) into an explicit,
  machine-readable 400. Clients that always sent valid pagination
  and filters see no change.
- The 400 body is a superset of the v1.13.0 `Problem` shape; SDKs
  on v1.13.0 see `parseProblem()` return a `V1Problem` with a
  populated `errors` extension member they can ignore safely.
- Spec version: `1.8.0` → `1.9.0`.

## 2026-04-19 — v1.13.0 (API)

### Added
- **Problem Details for HTTP APIs (RFC 9457).** Every error
  response from `/api/v1/*` now carries a Problem-shaped JSON
  body — a superset of the existing `{ error: { code, message } }`
  envelope. The new top-level members are:
  - `type` — stable absolute URI for the error class
    (e.g. `https://api.e-credentialing.example.com/problems/insufficient-scope`).
    Two distinct errors will never share a `type`; clients can
    switch on it without parsing English.
  - `title` — short, human-readable label
    (e.g. `"Insufficient scope"`).
  - `status` — numeric HTTP status, mirroring the response line.
  - `detail` — human-readable, request-specific explanation
    (matches the legacy `error.message`).
  - `instance` — the request path that produced the problem
    (e.g. `/api/v1/providers/abc123`).

  The legacy `error: { code, message, ...extras }` envelope is
  preserved verbatim under the same key, so existing integrations
  continue to work. New clients SHOULD switch on `type` and read
  `detail`/`status` directly.
- **Content-Type negotiation.** Clients that send
  `Accept: application/problem+json` receive
  `Content-Type: application/problem+json` (per RFC 9457 §3).
  All other clients — including those that send
  `Accept: application/json`, `*/*`, or no `Accept` header —
  continue to receive `Content-Type: application/json`. The body
  is byte-identical in either case; only the media type
  parameter changes. This keeps every existing parser working
  unchanged.
- **Rate-limit errors are Problem-shaped too.** `429 Too Many
  Requests` responses now ship a Problem body with
  `type=…/problems/rate-limited` and the existing
  `retryAfterSeconds` extension member preserved alongside the
  `Retry-After` header.
- **TypeScript SDK exposes `parseProblem()` + `V1ApiError.problem`.**
  Two new dependency-free integrations in
  `@e-credentialing/api-client`:
  - `parseProblem(body)` accepts any v1 error JSON (Problem-shaped
    or legacy envelope) and returns a normalised `V1Problem` —
    synthesising `type`/`title`/`status`/`detail` from the legacy
    envelope when older deployments respond.
  - `V1ApiError.problem` is now populated on every non-2xx
    response with a JSON body, so error-handling code can read
    `err.problem.type` to switch on machine-stable URIs without
    reparsing.

### Improved
- **OpenAPI spec bumped to `v1.8.0`.** `Error` and
  `RateLimitProblem` schemas now describe both the RFC 9457
  members and the legacy envelope explicitly, so generated
  clients (TypeScript, Postman, Schemathesis) understand both
  shapes. All four reusable error responses (`Unauthorized`,
  `Forbidden`, `NotFound`, `RateLimited`) plus the inline `401`
  on `/health` now advertise both `application/problem+json` and
  `application/json` content types.
- **`docs/api/versioning.md` §3.8** documents the Problem
  Details contract — what `type` URIs we promise to keep stable,
  how content negotiation works, and how clients should detect
  it without breaking against legacy deployments.

### Compatibility
- **Non-breaking** for every existing client. The legacy
  `error: { code, message }` envelope is still present at the
  same path inside every error body. Clients that ignore unknown
  members (the recommended posture) see no change in behavior.

## 2026-04-19 — v1.12.0 (API)

### Added
- **Deprecation + Sunset header machinery (RFC 9745 / RFC 8594 /
  RFC 5829).** The contract our versioning policy has been
  promising since `v1.2.0` is now live in code: when an operation
  enters its deprecation window, every response (200, 304, 4xx,
  5xx) carries advisory headers describing the timeline.
  - `Deprecation: @<unix-seconds>` — when deprecation took
    effect (e.g. `@1796083200` is `2026-12-01T00:00:00Z`).
  - `Sunset: <HTTP-date>` — the wall-clock at which the
    operation will start returning `410 Gone` (always at least
    180 days in the future at first publication).
  - `Link: <upgrade-guide-url>; rel="deprecation"` and
    `; rel="sunset"` — pointer to the public upgrade guide.
  - `Link: <new-endpoint-url>; rel="successor-version"` —
    optional, present when a direct replacement exists.

  **Operations on the supported path do NOT emit these
  headers** — their presence is the signal. No customer-visible
  changes today (the registry is empty); the wiring is live so
  the day we ship our first deprecation, every endpoint
  participates without a new spec bump.
- **TypeScript SDK exposes `parseDeprecation()` + an
  `onDeprecated` callback.** Two new dependency-free integrations
  in `@e-credentialing/api-client`:
  - `parseDeprecation(response.headers)` returns
    `{ deprecatedAt, sunsetAt, infoUrl, successorUrl }` or
    `undefined` — works on any v1 `Response`.
  - `new V1Client({ ..., onDeprecated })` fires the callback at
    most once per `(method, path)` per process, so a polling
    loop on a deprecated endpoint logs once, not every minute.
    Default callback emits a single `console.warn` with the
    sunset date and upgrade-guide URL; pass `() => undefined`
    to silence entirely.
  - `V1ApiError.deprecation` is now populated on errors from
    deprecated endpoints (so failures don't hide the warning).

### Improved
- **Versioning policy `docs/api/versioning.md` §4 rewritten.**
  Previously aspirational ("we will emit `Deprecation` /
  `Sunset` headers"); now backed by code. Adds the cacheable
  subset rules for `Sunset` interaction with conditional GETs,
  the SDK observation contract, and a worked example showing
  the headers a customer would see throughout a 180-day sunset
  window.
- **OpenAPI spec bumped to `1.7.0`.** New
  `components.headers.Deprecation` + `components.headers.Sunset`
  documented as conditional headers (description explicitly
  notes "absent unless this operation is on a deprecation
  path"). The `Link` header description now covers both the
  pagination and deprecation classes of entries.
- **Postman collection regenerated** (`/api/v1/postman.json`)
  so the documented response headers reflect the new contract.

### Compatibility
- **Non-breaking minor release.** No request shape changes; no
  response body changes; new headers only fire on deprecated
  operations (and the registry is empty today). The TypeScript
  SDK's `V1ApiError` constructor gained an optional 6th
  positional `deprecation` parameter — supported call sites
  should not be affected (the SDK is the only constructor).

## 2026-04-18 — v1.11.0 (API)

### Added
- **Conditional GETs — `ETag` + `If-None-Match`.** Every read
  endpoint now emits a weak `ETag` response header derived from a
  stable hash of the cacheable subset of the response body
  (excluding per-request fields like timestamps, rate-limit
  snapshots, and last-used markers). Echo the value back as
  `If-None-Match: "<etag>"` on the next poll and the API replies
  `304 Not Modified` with an empty body — saving bandwidth, DB
  round-trips, and your rate-limit budget. Wired into:
  `GET /health`, `GET /me`, `GET /providers`,
  `GET /providers/{id}`, `GET /sanctions`, `GET /enrollments`,
  plus the spec-delivery endpoints (`/openapi.yaml`,
  `/openapi.json`, `/postman.json`). `GET /providers/{id}/cv.pdf`
  is intentionally excluded this release (binary streams have a
  different caching strategy). Documented in the OpenAPI 3.1
  spec at `/api/v1/openapi.yaml` (apiVersion `1.6.0`) and
  reflected in the regenerated Postman collection at
  `/api/v1/postman.json`.

### Improved
- **Polling integrations cost less.** A typical "is anything new
  in /providers?" poll loop drops from ~5 KB/response to ~80
  bytes when nothing has changed (a 304 is just headers).
  Independent of the body size — works the same way for our
  largest payloads.
- **TypeScript SDK exposes `parseEtag()` + `conditionalGetWith()`.**
  Two new dependency-free helpers in `@e-credentialing/api-client`:
  - `parseEtag(response.headers)` reads the raw `ETag` token
    (e.g. `W/"deadbeef"`) off any v1 response.
  - `conditionalGetWith(client, path, ifNoneMatch)` performs a
    conditional GET in one call and returns either
    `{ status: "fresh", etag, data }` or
    `{ status: "not-modified", etag }`. Throws `V1ApiError` for
    auth/rate-limit failures so you don't need to special-case
    errors.
- **OpenAPI spec bumped 1.5.0 → 1.6.0** (additive minor bump per
  our [versioning policy](../api/versioning.md)). New
  `components.headers.ETag`, `components.parameters.IfNoneMatchHeader`,
  and `components.responses.NotModified` definitions, attached to
  every cacheable GET operation. `Health.apiVersion` example
  bumped to `1.6.0` so health-check consumers see the matching
  version string.

### Compatibility
- **Non-breaking.** The `ETag` header is purely additive on 200
  responses. Clients that don't send `If-None-Match` are
  unaffected — they continue to receive full bodies with the new
  header attached. The `304 Not Modified` response only fires
  when the client explicitly opts in by sending
  `If-None-Match`.

## 2026-04-18 — v1.10.0 (API)

### Added
- **Standard pagination links — RFC 8288 `Link` header.** Every
  paginated list endpoint (`GET /api/v1/providers`,
  `GET /api/v1/sanctions`, `GET /api/v1/enrollments`) now returns
  a `Link` response header with `rel="first"`, `rel="prev"`,
  `rel="next"`, and `rel="last"` URLs that preserve all of your
  existing query parameters (filters, `limit`, etc.). Clients can
  walk the whole result set without doing arithmetic on `page`
  and `totalPages`, which is the conventional REST pattern (also
  used by GitHub, Stripe, and Atlassian). Empty result sets emit
  no `Link` header — there's nothing to link to. Documented in
  the OpenAPI 3.1 spec at `/api/v1/openapi.yaml` (apiVersion
  `1.5.0`) and reflected in the regenerated Postman collection
  at `/api/v1/postman.json`.

### Improved
- **TypeScript SDK exposes `parseLinkHeader`.** The SDK now
  re-exports a tiny, dependency-free helper:
  `import { parseLinkHeader } from "@e-credentialing/api-client";`
  → `parseLinkHeader(response.headers.get("Link"))` returns a
  `{ first, prev, next, last }` map of absolute URLs (or `{}` for
  older deployments). Useful for building "Load more" buttons or
  cursor-style pagers without re-implementing RFC 8288 parsing.
- **OpenAPI spec bumped 1.4.0 → 1.5.0** (additive minor bump per
  our [versioning policy](../api/versioning.md)). The `Health`
  schema's `apiVersion` example now reads `1.5.0` so health-check
  consumers see the matching version string.

### Compatibility
- **Non-breaking.** Existing pagination metadata (`page`,
  `limit`, `total`, `totalPages` in the JSON envelope) is
  unchanged — the new `Link` header is purely additive. Clients
  that ignore response headers are unaffected.

## 2026-04-18 — v1.9.0 (API)

### Added
- **API key introspection — `GET /api/v1/me`.** The canonical
  "what can my API key actually do?" check. Returns the key's
  `keyId`, human-readable `name`, granted `scopes` (filtered to
  the stable vocabulary), `createdAt`, `expiresAt` (or `null`
  for keys that never expire), `lastUsedAt`, and a snapshot of
  the current rate-limit budget. Like `/health`, requires only
  a valid bearer key — no specific scope needed — so it's the
  natural follow-up call when debugging "why am I getting 403?"
  problems. Documented in the OpenAPI 3.1 spec at
  `/api/v1/openapi.yaml` (apiVersion `1.4.0`), available in the
  TypeScript SDK as `client.me()`, and present in the Postman
  collection at `/api/v1/postman.json`. **Non-breaking minor
  bump** under the published API versioning policy.

### Improved
- **One-call key debugging.** Customers no longer need to dig
  into our admin UI to confirm which scopes they have or when
  their key expires — the SDK call returns exactly what the
  server sees.

## 2026-04-18 — v1.8.0 (API)

### Added
- **Request correlation header on every v1 response.** Every
  `/api/v1/*` request now carries an `X-Request-Id` header on both
  the request and the response. If you supply one (any string
  matching `^[A-Za-z0-9_\-]{8,128}$` — ULID, UUID, Stripe-style
  `req_*`, or your own opaque token), we honour it and stamp it
  onto our audit log + Pino structured logs. If you don't, we
  generate one (`req_<16-hex>`) and return it. Surface it verbatim
  in support tickets — it's the lookup key our on-call engineers
  use. Documented in the OpenAPI 3.1 spec at
  `/api/v1/openapi.yaml` (apiVersion `1.3.0`).
- **TypeScript SDK forwards & captures request ids.** Pass
  `requestIdFactory: () => myCorrelationId()` when constructing
  `V1Client` to forward your client-side correlation id; on every
  thrown `V1ApiError`, `error.requestId` exposes the server-assigned
  id from the response header. Available in
  `src/lib/api-client/v1.ts` and the regenerated Postman collection
  at `/api/v1/postman.json`.

### Improved
- **Faster support triage.** Customers can now hand us a single id
  that pinpoints both their client-side log and our server-side
  audit row — no more correlating by timestamp + key id. This is a
  **non-breaking minor bump** under the published API versioning
  policy.

## 2026-04-18 — v1.7.0 (API)

### Added
- **Standard rate-limit headers on every v1 response.** Every
  successful 2xx response from `/api/v1/*` now carries
  `X-RateLimit-Limit`, `X-RateLimit-Remaining`, and
  `X-RateLimit-Reset` (Unix-seconds). When you exceed the per-key
  budget the API returns a `429 RateLimitProblem` with the same
  three headers plus `Retry-After`. The TypeScript SDK exposes the
  parsed snapshot on `V1ApiError.rateLimit` and via
  `parseRateLimit(response.headers)`. Documented in the OpenAPI
  3.1 spec at `/api/v1/openapi.yaml` (apiVersion `1.2.0`).
- **Standardised v1 error envelope.** Every non-2xx response now
  uses `{ "error": { "code": "...", "message": "..." } }` —
  matching the spec, the SDK's `V1ApiError` parser, and the
  customer-facing documentation. Stable `error.code` values
  (`missing_authorization`, `invalid_api_key`, `expired_api_key`,
  `insufficient_scope`, `unauthorized`, `rate_limited`,
  `not_found`, `cv_generation_failed`) are now part of the v1
  contract.

### Improved
- **Predictable client back-off.** SDKs and integrations can now
  read remaining quota proactively instead of waiting for a 429.
  This is a **non-breaking minor bump** under the published API
  versioning policy.

## 2026-04-18 — v1.6.0 (API)

### Added
- **Public REST API `v1.1.0` — `/api/v1/health` endpoint.** A
  customer-facing health probe that verifies an API key is active
  and the environment is reachable. Requires a valid Bearer key but
  no specific scope, so it's the natural first call when wiring up
  a new integration. Returns `{ ok, keyId, apiVersion, time }`.
  Documented in the OpenAPI 3.1 spec at `/api/v1/openapi.yaml`,
  available in the TypeScript SDK as `client.health()`, and present
  in the Postman collection at `/api/v1/postman.json`. This is a
  **non-breaking minor bump** under our published API versioning
  policy (URL-path major + SemVer minor for additive surfaces).

## 2026-04-18 — v1.5.0

### Added
- **CVO platform positioning + public sandbox.** Marketing landing
  page now leads with the "Credentialing Verification Organization"
  story, with a dedicated `/cvo` explainer covering the NCQA element
  catalog and a comparison against in-house builds and legacy CVOs.
  A new public `/sandbox` exposes read-only synthetic data so
  evaluators can wire a POC without onboarding.
- **Auditor-package one-click export.** `/settings/compliance` now
  ships a SOC 2 Type I evidence pack — chained audit log, NCQA
  snapshots, and per-control evidence — as a single
  byte-stable .zip with a SHA-256 the auditor can re-verify.
- **Stripe Billing scaffolding.** Behind the new `BILLING_ENABLED`
  feature flag: Checkout, Billing Portal, webhook ingestion, and an
  in-app `/settings/billing` page with current plan, dunning banners,
  and upgrade buttons. Three published plan tiers: Starter, Growth,
  Enterprise.
- **Public `/changelog` + RSS feed.** Customer-facing release notes
  now ship at `/changelog` with anchor-stable release cards and an
  RSS 2.0 feed at `/changelog.rss`. Subscribe with any reader to be
  notified when a new release ships.

### Improved
- **Multi-tenancy shim.** All PHI-bearing tables now carry an
  `organization_id` column; the Prisma client transparently injects
  the request-scoped tenant id on every query. Single-tenant
  customers see no behavior change.
- **Visual regression coverage.** Playwright snapshots now run
  per-browser (Chromium, Firefox, WebKit) for both anonymous and
  staff routes — drift detection lands earlier.

### Security
- **OWASP ZAP baseline scan in CI.** Each pull request gets a
  passive scan + consolidated security summary. High-or-above
  findings fail the build.
- **Tamper-evident audit log fully chained.** Every audit row now
  carries an HMAC-SHA-256 hash of the previous row; integrity
  verification ships in the auditor package.

## 2026-04-15 — v1.4.0

### Added
- **FHIR R4 public directory.** `/api/fhir/Practitioner`,
  `PractitionerRole`, `HealthcareService`, and `InsurancePlan`
  endpoints conform to the DaVinci PDex Plan-Net IG. The
  `$everything` operation returns the full provider envelope in one
  call. CapabilityStatement is published at `/api/fhir/metadata`.
- **CME & CV auto-generation.** `/api/v1/providers/:id/cv.pdf`
  renders a deterministic, board-aligned CV from the provider's
  current credentialing state.

### Improved
- **OPPE/FPPE workflow.** Quarterly scorecard build, peer review
  routing, and Joint Commission NPG-12 evidence chain are now first-
  class — no spreadsheets.

## 2026-04-10 — v1.3.0

### Added
- **Telemetry stack.** Sentry + Application Insights + Prometheus +
  Grafana dashboards now publish out of the box.
- **k6 perf suites.** Public + authenticated baselines run in CI to
  catch regressions before they reach customers.

### Security
- **Postgres index audit.** Nightly script verifies all PHI-touching
  query paths are covered by an index; gaps page on-call.

## 2026-04-01 — v1.2.0

### Added
- **NCQA CVO baseline catalog.** All thirteen NCQA primary-source
  verification elements seeded with reference policies; `/dashboard`
  shows live compliance percent against the catalog.
- **Sanctions weekly check.** OIG, SAM, and state Medicaid pulls run
  on a recurring schedule with structured alerts on hits.

### Improved
- **Document AI extraction.** Faster, more accurate parsing of
  malpractice declarations and board certificates.

## 2026-03-15 — v1.1.0

### Added
- **Provider self-service portal.** Token-gated invite flow, in-app
  attestation history, and document upload with virus scan.

### Security
- **PHI column-level encryption.** Sensitive provider fields are
  encrypted at rest with a deployment-managed key; key rotation
  runbook published.

## 2026-03-01 — v1.0.0

### Added
- **General availability.** First production release of the
  E-Credentialing CVO Platform: NCQA-aligned PSV bot fleet,
  tamper-evident audit log, FHIR R4 directory beta, and a
  full credentialing-committee workflow.
