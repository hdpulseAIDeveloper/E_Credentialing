# ADR 0025 — Problem Details for HTTP APIs (RFC 9457)

- **Status:** Accepted
- **Date:** 2026-04-19
- **Wave:** 19
- **Supersedes:** —
- **Related:**
  ADR [0020](0020-openapi-v1-spec.md) (OpenAPI spec),
  ADR [0022](0022-public-rest-v1-sdk.md) (TypeScript SDK),
  ADR [0023](0023-api-versioning-policy.md) (versioning policy),
  ADR [0024](0024-deprecation-sunset-headers.md) (deprecation headers),
  [`docs/api/versioning.md`](../../api/versioning.md) §3.8 (Problem Details contract),
  [`src/lib/api/problem-details.ts`](../../../src/lib/api/problem-details.ts),
  [`tests/unit/api/problem-details.test.ts`](../../../tests/unit/api/problem-details.test.ts),
  [`docs/changelog/public.md`](../../changelog/public.md) (`v1.13.0 (API)`).

## Context

Through Wave 18 the v1 public REST surface emitted errors as a flat
`{ error: { code, message, ...extras } }` envelope. The shape was
internally consistent, machine-readable, and fully covered by the
OpenAPI spec — but it had two gaps that started to matter as we
prepared for our first paying integrations:

1. **No industry-standard error contract.** Customers integrating
   the API expected the IETF
   [RFC 9457 — Problem Details for HTTP APIs](https://datatracker.ietf.org/doc/html/rfc9457)
   (the successor of RFC 7807) shape. Specifically: a stable
   absolute `type` URI per error class, a human-readable `title`,
   and a request-specific `instance` pointer. Without these, any
   off-the-shelf error-handling middleware (pino-http, axios
   interceptors, FastAPI clients, etc.) had to be configured
   bespoke for our envelope.
2. **The `error.code` discriminator was opaque to outsiders.** A
   value like `"insufficient_scope"` is meaningful internally but
   has no globally-resolvable identity. RFC 9457's `type` URI fills
   exactly that gap — it gives each error class a permanent URI we
   can document, deep-link from runbooks, and that customer code
   can switch on without parsing English strings.

We also had a backward-compatibility constraint. The original
`error: { code, message }` envelope is referenced by every
integration we've shipped to date (TypeScript SDK, Postman
collection, internal tests, sandbox docs, customer trials). A pure
"replace the body" migration would have been a breaking change and
forced `/api/v2/`.

## Decision

We adopt **RFC 9457 Problem Details as a backward-compatible
superset** of the existing error envelope, served from a new helper
module `src/lib/api/problem-details.ts`, with two media-type
variants negotiated via the `Accept` header.

### 1. Body shape

Every v1 error response now ships the following JSON object:

```json
{
  "type":     "https://api.e-credentialing.example.com/problems/<kebab-code>",
  "title":    "Human-readable label",
  "status":   <numeric HTTP status>,
  "detail":   "Human-readable, request-specific explanation",
  "instance": "/api/v1/<request-path>",
  "error":    { "code": "<machine_code>", "message": "...", "<extras>": ... }
}
```

The legacy `error` envelope is preserved verbatim under the same
key. New consumers SHOULD switch on `type` (a permanent absolute
URI) and read `detail` / `status`. Existing consumers MAY keep
reading `error.code` — nothing they relied on has moved.

### 2. Stable `type` URI registry

`PROBLEM_BASE_URL` is `https://api.e-credentialing.example.com/problems`.
Each `error.code` deterministically maps to a `type` URI by
kebab-casing the underscored code (e.g. `insufficient_scope` →
`/problems/insufficient-scope`). The mapping is **append-only**:

- We will never re-point an existing `type` URI to a different
  error class.
- New error classes get new URIs and a row in `PROBLEM_TITLES`
  with a stable human-readable title.
- Removing a `type` URI is a breaking change and requires a major.

`PROBLEM_TITLES` is the only place where titles live, so a typo or
rewording is a one-line change with full repo grep coverage.

### 3. Content negotiation

Per RFC 9457 §3, the canonical media type is
`application/problem+json`. Per HTTP convention every existing
client expects `application/json`. We resolve this with strict
opt-in negotiation (`negotiateProblemContentType`):

- `Accept: application/problem+json` → respond with
  `Content-Type: application/problem+json`.
- Anything else (`application/json`, `*/*`, missing `Accept`,
  multi-value lists where `application/problem+json` is not the
  best match) → respond with `Content-Type: application/json`.

Critically the **body bytes are identical** in both cases — only
the `Content-Type` parameter changes. This guarantees that
existing clients continue to parse the new body just like the old
body, while new clients can opt in to RFC 9457 semantics with a
single header.

### 4. Wiring

- `v1ErrorResponse(status, code, message, extras?, request?)` in
  `src/app/api/v1/middleware.ts` is now the **only** way v1 routes
  produce an error. It builds the Problem body via `buildProblem`
  and the `NextResponse` via `problemResponse(request, ...)`.
- `buildRateLimitResponse` in `src/lib/api/rate-limit.ts` was
  refactored to also emit a Problem-shaped body, with the existing
  `retryAfterSeconds` extension member preserved alongside the
  `Retry-After` header (RFC 9457 §3.2 explicitly permits
  extensions).
- All v1 route handlers now thread the inbound `Request` into
  `requireScope` / `v1ErrorResponse` calls so that `instance` is
  correctly populated.

### 5. OpenAPI spec contract (`v1.8.0`)

- `components.schemas.Error` and `components.schemas.RateLimitProblem`
  redefined as Problem-shaped supersets, retaining the legacy
  `error` envelope as a required member.
- All four reusable error responses (`Unauthorized`, `Forbidden`,
  `NotFound`, `RateLimited`) plus the inline `401` on `/health`
  now advertise both `application/problem+json` and
  `application/json` content types.
- A new `info.description` paragraph documents the contract,
  content negotiation, and backward-compatibility guarantees.

### 6. SDK observation contract

- `parseProblem(body, fallbackStatus?)` in
  `src/lib/api-client/v1.ts` accepts any v1 error JSON
  (Problem-shaped or legacy) and returns a normalised
  `V1Problem` — synthesising `type` / `title` / `status` /
  `detail` from the legacy envelope when older deployments
  respond.
- `V1ApiError.problem` is populated on every non-2xx response
  with a JSON body. Code that needs to react to a specific error
  class reads `err.problem?.type`, not the English `message`.

## Consequences

### Positive

- **Standards-aligned.** New customers can point any RFC 9457
  toolchain at the API and get the expected behaviour out of the
  box.
- **Permanent error identity.** Every error class has a stable URI
  we can document, deep-link, and that customer logic can switch
  on without parsing strings.
- **Zero breaking change.** Every existing client — internal,
  external, SDK, Postman, k6 — continues to work because the
  legacy `error` envelope is still present at the same path.
- **Centralised builder.** `buildProblem` is the only path that
  ever produces a v1 error body, so adding a new `type` URI or a
  new title is a one-place change.

### Negative

- **Two media types to test.** The contract test in
  `tests/contract/pillar-j-openapi.spec.ts` now asserts that every
  reusable error response advertises both content types. This is
  one new line of test surface per error response; we accept the
  minor maintenance cost in exchange for the contract guarantee.
- **Slightly larger error bodies.** Each error gains
  `~120-200 bytes` of `type`/`title`/`status`/`detail`/`instance`
  members. For our error rates (low single-digit %, mostly 401
  during integration onboarding) the bandwidth impact is
  negligible.

### Neutral

- **The kebab-case URI scheme is implicit, not encoded.** Today we
  derive the URI from the code. If a future error class needs a
  different scheme (e.g. a versioned URI), `problemTypeUri` is the
  one function to update; the OpenAPI spec keeps the literal URIs
  as documented examples so drift is visible at review time.

## Alternatives considered

### A. Replace the legacy envelope outright

Drop `error: { code, message }` and emit only the RFC 9457 fields.

- ✅ Cleanest body shape.
- ❌ **Hard breaking change.** Every existing client (TypeScript
  SDK, Postman collection, k6 perf scripts, customer trials) reads
  `body.error.code` today. Forcing `/api/v2/` to fix a body shape
  that already works would be the wrong trade-off.

Rejected.

### B. Always serve `application/problem+json`

Ignore the `Accept` header and unconditionally label every error
as `application/problem+json`.

- ✅ Simplest implementation.
- ❌ Breaks any existing client whose JSON parser is registered
  only for `application/json`. We have at least one such client
  in the wild (an early customer trial that hard-coded the
  content-type check).

Rejected in favour of strict opt-in negotiation.

### C. Per-route Problem objects (no central builder)

Hand-author the Problem body inline in each route.

- ✅ No new module.
- ❌ Drift inevitable: `type` URIs would diverge across routes,
  titles would get reworded, the legacy envelope would be omitted
  by accident in new endpoints. The same drift pressure that
  motivated `applyDeprecationByRoute` (ADR 0024) applies here.

Rejected.

### D. RFC 7807 (the predecessor)

Use the older RFC 7807 wire format.

- ✅ Wider tooling support today.
- ❌ RFC 9457 is a strict superset, with clarifications around
  extensions and content negotiation that we want to lean on.
  Building against the older RFC means we'd revisit this decision
  the moment customer tooling moves to RFC 9457.

Rejected; we adopt RFC 9457 directly.

## Tests / Gates

- `tests/unit/api/problem-details.test.ts` — 19 tests covering URI
  generation, title resolution, body construction, content-type
  negotiation, and `NextResponse` construction.
- `tests/unit/api/require-scope.test.ts` — added a Wave 19 test
  asserting `403` bodies are RFC 9457 Problem-shaped while
  preserving the legacy `error` envelope.
- `tests/unit/lib/api-client/v1-client.test.ts` — added 4
  `parseProblem` tests + 3 `V1ApiError.problem` tests covering the
  full body, legacy-envelope synthesis, non-JSON bodies, and
  extension members.
- `tests/contract/pillar-j-openapi.spec.ts` — 3 new assertions:
  the `Error` and `RateLimitProblem` schemas declare RFC 9457
  members, and every reusable error response advertises both
  `application/problem+json` and `application/json` content types.
- Drift gates (`npm run sdk:check`, `npm run postman:check`)
  re-run after `info.version` bumps to `1.8.0`.

## Migration

- **Customers reading `body.error.code` / `body.error.message`** —
  no change required. The envelope remains at the same path.
- **Customers reading the new top-level RFC 9457 members** —
  switch on `body.type` (a stable URI) and read `body.detail` /
  `body.status`. To opt into the RFC 9457 media type, send
  `Accept: application/problem+json`.
- **TypeScript SDK consumers** — upgrade to the next published
  `@e-credentialing/api-client` to get `V1ApiError.problem` and
  `parseProblem`. No changes are forced; existing `V1ApiError`
  fields (`status`, `code`, `body`, `rateLimit`, `requestId`,
  `deprecation`) all remain.
