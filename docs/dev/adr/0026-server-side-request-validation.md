# ADR 0026 — Server-side request validation with Problem Details

- **Status:** Accepted
- **Date:** 2026-04-19
- **Wave:** 20
- **Supersedes:** —
- **Related:**
  ADR [0020](0020-openapi-v1-spec.md) (OpenAPI spec),
  ADR [0022](0022-public-rest-v1-sdk.md) (TypeScript SDK),
  ADR [0023](0023-api-versioning-policy.md) (versioning policy),
  ADR [0024](0024-deprecation-sunset-headers.md) (deprecation headers),
  ADR [0025](0025-problem-details-rfc-9457.md) (Problem Details — body shape),
  [`docs/api/versioning.md`](../../api/versioning.md) §3.9 (validation contract),
  [`src/lib/api/validation.ts`](../../../src/lib/api/validation.ts),
  [`tests/unit/api/validation.test.ts`](../../../tests/unit/api/validation.test.ts),
  [`docs/changelog/public.md`](../../changelog/public.md) (`v1.14.0 (API)`).

## Context

Through Wave 19 the v1 public REST surface accepted query parameters
on its three paginated list endpoints (`/api/v1/providers`,
`/api/v1/sanctions`, `/api/v1/enrollments`) without a unified
validation layer. Each route handler did some combination of:

- `Number(searchParams.get("page"))` then `Math.max(1, …)` —
  silently clamping `?page=0` and `?page=-1` to `1`.
- `Number(searchParams.get("limit"))` then `Math.min(100, …)` —
  silently clamping `?limit=99999` to `100`.
- `searchParams.get("status")` checked only for membership in a
  hand-maintained allowlist; values outside the allowlist were
  silently dropped from the WHERE clause, returning the wrong
  subset of rows with `200 OK`.
- `?limit=foo` (a non-numeric string) became `NaN`, then was
  silently coerced to a tiny default by `Math.max`/`Math.min`.

Every one of these was a long-standing source of customer support
tickets ("why does `?page=0` not error? why does
`?status=PENDIG` return all statuses?") and an integration footgun:
a typo in a customer's pagination loop could deliver `200 OK` with
the wrong rows, masking the bug for hours.

The QA standard's iterator-aware coverage (Wave 6) caught that
none of these edge cases had a contract test, but the gate could
not generate validation tests because there was no validation
contract to test against.

## Decision

We introduced **strict server-side request validation** for every
public list endpoint, with two non-negotiable properties:

1. **Field-level errors are reported in the RFC 9457 Problem body
   from ADR 0025.** A new `ValidationProblem` shape extends the
   `Problem` shape with one extension member: a non-empty
   `errors[]` array. Each entry has three string fields —
   `field`, `code`, `message` — and every offending parameter is
   reported in **one** response. Clients no longer need to retry
   once per fix.
2. **Validation runs before any database work.** The new
   `parseQuery(request, schema)` helper in
   [`src/lib/api/validation.ts`](../../../src/lib/api/validation.ts)
   is the first call inside every list handler's `GET`. On
   failure it returns a 400 wrapped with the standard
   `applyRateLimitHeaders` / `applyRequestIdHeader` /
   `applyDeprecationByRoute` envelope so the failure is
   indistinguishable from any other v1 error in terms of
   correlation, observability, and deprecation signalling.

Specifics:

- **Zod is the schema runtime.** It was already a transitive
  dependency via tRPC (`@trpc/server` requires it); promoting it
  to a direct dependency adds zero new bytes to the runtime
  bundle but unlocks discriminated unions, refinements, and
  coercions that ad-hoc validation cannot express.
- **The Zod issue codes are part of the wire contract.** We
  surface `issue.code` directly (`too_small`, `too_big`,
  `invalid_type`, `invalid_enum_value`, `invalid_string`,
  `unrecognized_keys`, `custom`). Renaming any of these is a
  SemVer breaking change and will fail the drift gate. New codes
  MAY be added in a minor; clients SHOULD treat unknown `code`
  values as generic `invalid_request`.
- **Field paths are dot-joined.** Top-level query parameters
  surface as bare names (`"page"`, `"limit"`); nested shapes use
  dots (`"filters.status"`). Empty string is reserved for
  root-level failures (e.g. `unrecognized_keys` on the parsed
  object as a whole).
- **The `type` URI is stable across deployments.** Every
  validation Problem ships
  `type: <PROBLEM_BASE_URL>/invalid-request`. The SDK exposes
  `VALIDATION_PROBLEM_TYPE_SUFFIX = "/errors/invalid-request"`
  for clients to match against — substring-matching the path
  suffix, never the hostname.
- **The OpenAPI spec is the source of truth.** Spec bumped from
  `1.8.0` to `1.9.0`. New `ValidationFieldError` and
  `ValidationProblem` schemas, new reusable
  `components.responses.BadRequest`, and `400` responses added
  to every paginated list operation. SDK types and Postman
  collection regenerate cleanly from the spec.
- **The SDK ships a type guard, not a parser.** `V1ApiError`
  already exposes `problem: V1Problem | undefined` (since ADR
  0025); Wave 20 only adds the narrow type
  `V1ValidationProblem` and the type guard
  `isValidationProblem(problem)`. The guard checks both the
  `type` URI suffix AND the `errors[]` array shape, so a future
  server that emits `errors[]` on a non-validation Problem will
  not accidentally match.

## Consequences

### Positive

- **Customer support burden drops.** Validation failures now
  return a structured 400 the customer can read, log, and react
  to programmatically. The previous "silent clamp" behaviour was
  the single most common source of "but I asked for X and got Y"
  tickets.
- **Integration testing is easier.** Customers can write a
  single integration test asserting that `?page=0` returns 400
  with a specific Zod `code` instead of guessing what the server
  will silently do.
- **The OpenAPI spec is more honest.** Every paginated list
  endpoint now declares 400 explicitly; Schemathesis
  (Wave 9) and contract tests (Wave 8) automatically pick up
  the new failure mode.
- **The Problem-Details contract from ADR 0025 grows naturally.**
  `ValidationProblem` is a strict superset of `Problem`; the SDK
  `parseProblem()` from Wave 19 returns a populated `errors`
  extension member with no code change. Adding more
  Problem-shaped error classes in future waves (e.g.
  `OutOfQuotaProblem`) follows the same pattern.

### Negative

- **Some inputs that previously returned `200 OK` now return
  400.** This is a deliberate narrowing of accepted inputs but,
  by the SemVer rules of `docs/api/versioning.md` §2, is **not**
  a breaking change because every input that v1.13.0 returned
  `200` for still returns `200`. The narrowing only converts
  previously-undefined behaviour (silent clamping, silent
  rejection) into an explicit, machine-readable 400. We
  documented this explicitly in the v1.14.0 changelog entry.
- **Zod is now a direct runtime dependency.** Already transitive
  via tRPC, so this is a label change rather than a bundle-size
  change, but it does mean a Zod breaking change can now block a
  release. Mitigated by the drift gate
  (`npm run sdk:check`) failing fast on any wire-shape change.

### Neutral

- **The validation layer lives in `src/lib/api/`, not in
  middleware.** A middleware-level validator would need to know
  about every route's schema, which would either be a god-object
  registry or magical reflection. Keeping validation as the
  first call inside the route handler is more verbose but keeps
  the schema visible at the call site, which is what reviewers
  want.

## Rejected alternatives

1. **Use Next.js's built-in `Request` parsing only (no Zod).**
   `URLSearchParams.get()` returns `string | null`; everything
   else is hand-rolled. This is what we had through Wave 19 and
   it's the source of the silent-clamp bugs. Rejected because
   it cannot express enums, refinements, or numeric coercion in
   a way the OpenAPI spec can mirror.
2. **Use a hand-written validator per route.** Considered briefly
   for "no new deps" purity; rejected because it would have meant
   re-implementing Zod's discriminated unions, refinements, and
   error aggregation in TypeScript. Zod is already in our
   dependency tree; not using it would have been ideology, not
   engineering.
3. **Throw a generic 400 with a single `message` string.** This
   is what most APIs do. It has the same forensic problem as the
   pre-RFC-9457 `error` envelope: the client cannot programmatically
   discover which field failed without parsing English. Rejected
   in favour of the structured `errors[]` array.
4. **Validate on a separate endpoint (`POST /api/v1/validate`).**
   Considered for symmetry with some payment APIs. Rejected: it
   doubles the round-trip count for every list operation, and
   the right place to validate inputs is in the handler that's
   about to act on them.

## Operational notes

- **No new env vars.** `parseQuery` reads only from the request.
- **Per-request CPU cost is negligible.** Zod parses the
  ~3-field query schemas in microseconds; the bottleneck is
  still Postgres.
- **The drift gate is unchanged.** Spec → SDK → Postman pipeline
  picks up `ValidationFieldError` and `ValidationProblem`
  automatically.
- **Coverage gate** (Wave 6 iterator) automatically generates
  one contract assertion per (route × method × validation
  scenario) the moment a new list endpoint declares a 400 in
  the spec.

## Anti-weakening

- The `errors[]` array MUST stay non-empty on every 400. A 400
  with zero errors is incoherent and would defeat the contract.
- Renaming any Zod issue `code` is a SemVer breaking change,
  full stop.
- Loosening validation (i.e. expanding the set of accepted
  inputs without changing the schema) is fine and is a minor
  bump. **Tightening** validation (rejecting inputs that
  previously succeeded) is a breaking change and requires
  `/api/v2/`.
- The legacy `error: { code: "invalid_request", message }`
  envelope MUST stay at the same path inside every
  `ValidationProblem` body, exactly as ADR 0025 requires for
  every Problem-shaped error.
