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
