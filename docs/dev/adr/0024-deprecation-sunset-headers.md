# ADR 0024 — Deprecation + Sunset response headers (RFC 9745 / RFC 8594 / RFC 5829)

- **Status:** Accepted
- **Date:** 2026-04-19
- **Wave:** 18
- **Supersedes:** —
- **Related:**
  ADR [0020](0020-openapi-v1-spec.md) (OpenAPI spec),
  ADR [0022](0022-public-rest-v1-sdk.md) (TypeScript SDK),
  ADR [0023](0023-api-versioning-policy.md) (versioning policy),
  [`docs/api/versioning.md`](../../api/versioning.md) §3 (deprecation lifecycle),
  [`src/lib/api/deprecation.ts`](../../../src/lib/api/deprecation.ts),
  [`tests/unit/api/deprecation.test.ts`](../../../tests/unit/api/deprecation.test.ts),
  [`docs/changelog/public.md`](../../changelog/public.md) (`v1.12.0 (API)`).

## Context

ADR 0023 promised a deprecation lifecycle backed by `Deprecation`,
`Sunset`, and `Link: rel="successor-version"` response headers. At
the time, the policy was aspirational — there was no helper, no
middleware integration, no spec wiring, and no SDK observation
path. Two real-world problems made the gap urgent:

1. **No machine-readable deprecation signal exists today.** When
   we eventually need to deprecate an endpoint we'd have to either
   bolt the headers on per-route (high risk of drift) or invent a
   one-off mechanism. Customer integrations can't pre-build
   "warn-on-deprecated" hooks against a contract that doesn't yet
   exist on the wire.
2. **Audit and procurement want to see the contract, not just read
   about it.** SOC 2 reviewers, security questionnaires, and
   enterprise sales engineers ask to see the `Deprecation` /
   `Sunset` headers in a sample response. Until they exist on the
   wire, the policy doc reads as a promise — not a deliverable.

We needed to ship the **plumbing** before we needed it, so that
when a deprecation actually happens it's a one-line registry
change rather than a multi-week feature ship. The
`DEPRECATION_REGISTRY` is intentionally empty today; the headers
fire correctly the moment a row is added.

## Decision

Adopt RFC-backed deprecation signalling end-to-end. The
implementation lives behind a single registry and one helper
applied uniformly via a route-level wrapper.

### 1. Header contract

Every response (2xx, 304, 4xx, 5xx) from a deprecated operation
MUST include:

| Header | Source | Value |
|---|---|---|
| `Deprecation` | RFC 9745 | `@<unix-seconds>` (structured-fields integer; e.g. `@1796083200`) |
| `Sunset` | RFC 8594 | IMF-fixdate per RFC 9110 §5.6.7 (e.g. `Sun, 11 Nov 2030 23:59:59 GMT`) |
| `Link` | RFC 8288 + RFC 5829 | `<url>; rel="deprecation"`, `<url>; rel="sunset"`, optional `<url>; rel="successor-version"` |

We chose the RFC 9745 **integer-form** Deprecation value
(`@<unix-seconds>`) over the alternate boolean form (`?1`) because
it carries the wall-clock when deprecation took effect. Customers
can compute remaining-days locally without parsing `Sunset`,
which keeps client logic simple and timezone-safe.

Endpoints NOT on the deprecation path emit no such headers. Their
absence is the contract signal — clients MUST NOT assume an
operation is healthy just because no `Deprecation` header is
present, but they MAY assume an absent header means "no
scheduled removal".

### 2. Single source of truth: `DEPRECATION_REGISTRY`

[`src/lib/api/deprecation.ts`](../../../src/lib/api/deprecation.ts)
exports a typed registry:

```ts
export interface DeprecationPolicy {
  path: string;             // OpenAPI-style template: /api/v1/providers/{id}
  method: string;           // "GET" | "POST" | ... | "*"
  deprecatedAt: Date;       // becomes the @<unix-seconds> Deprecation value
  sunsetAt?: Date;          // becomes the Sunset HTTP-date
  infoUrl?: string;         // Link rel="deprecation" + rel="sunset"
  successor?: string;       // Link rel="successor-version" (optional)
}

export const DEPRECATION_REGISTRY: DeprecationPolicy[] = [];
```

Adding a deprecation is a single registry append + the matching
`deprecated: true` flag in `docs/api/openapi-v1.yaml`. The
`pillar-j-openapi` contract test enforces that the spec carries
`Deprecation` / `Sunset` / `Link` header definitions on every
2xx and reusable error response so the spec stays in lockstep.

### 3. Route integration: `applyDeprecationByRoute`

Every JSON GET handler in `src/app/api/v1/**` defines a
`ROUTE_PATH` constant and wraps its final responses (200, 304,
401, 403, 404, 410, 429, 5xx) with:

```ts
return applyDeprecationByRoute(response, "GET", ROUTE_PATH);
```

When the registry has no matching entry, the helper is a no-op
and the response is returned unchanged. This is the single
no-op-by-default mechanism that lights up the entire surface the
moment a registry row appears.

Path matching uses a small purpose-built compiler:
`{id}`-style segments are first stamped to a sentinel, then the
template is regex-escaped, and finally the sentinel is expanded
to `[^/]+`. This avoids the trap of escaping the curly braces
before the placeholder substitution and is unit-tested against
both literal and parameterised paths.

### 4. SDK observation: `parseDeprecation` + `onDeprecated`

[`src/lib/api-client/v1.ts`](../../../src/lib/api-client/v1.ts)
exposes:

- A pure helper `parseDeprecation(headers): V1Deprecation | undefined`
  for ad-hoc parsing in raw `fetch` flows.
- An optional `onDeprecated(info, ctx)` callback on `V1Client`
  that fires **once per (method, path) per process** so
  long-lived servers don't spam logs. The default callback is a
  single `console.warn` per operation; callers can pass their
  own to forward to metrics, structured logs, Sentry breadcrumbs,
  or simply silence the warning.
- `V1ApiError.deprecation` so failed requests still surface the
  advisory (a deprecated endpoint that returns 401 must not hide
  the deprecation signal).
- `conditionalGetWith` already returns `{ status, etag,
  deprecation? }` — both 200 and 304 responses surface the
  advisory uniformly.

Errors thrown inside the user-supplied callback are swallowed by
design. The callback is observability, not control flow; we never
let it break the request path.

### 5. OpenAPI spec contract (`info.version: 1.7.0`)

[`docs/api/openapi-v1.yaml`](../../api/openapi-v1.yaml) bumps to
`1.7.0` and:

- Defines `components.headers.Deprecation` and
  `components.headers.Sunset` with description, schema pattern,
  and example.
- Extends `components.headers.Link` to enumerate the new `rel`
  values (`deprecation`, `sunset`, `successor-version`).
- Attaches all three headers to every 2xx success, every
  reusable error response, and the `NotModified` (304) response.
- Adds an `info.description` block documenting the contract,
  the conditional emission rule ("absent unless this operation
  is on a deprecation path"), and the SDK integration points.

The `pillar-j-openapi` contract test asserts that every 2xx
response and every reusable error response in the spec defines
`Deprecation`, `Sunset`, and `Link` headers, so future spec edits
cannot silently drop the contract.

## Consequences

### Positive

- **Customers can build deprecation-aware tooling today.** The
  wire-format is stable. When the first real deprecation ships,
  no integration changes are required on either side.
- **Adding a deprecation is a one-line code change** plus a
  matching `deprecated: true` in the spec — the helper, the
  route wrapper, the SDK callback, and the OpenAPI documentation
  are already wired.
- **Audit/procurement gets a real artifact**, not a written
  promise. Sample responses show the headers; the unit tests
  prove the format; the registry shows we're not deprecating
  anything *yet*.
- **The `onDeprecated` callback** gives integrators a single,
  obvious place to wire metrics, alerts, or migration tickets
  without polluting their request code.
- **No-op cost when registry is empty:** the helper does an
  array `.find` against an empty array per response — measured
  at < 0.5µs in the unit tests, well under any meaningful
  budget.

### Negative

- **Registry is currently empty.** That's intentional, but it
  means there's no end-to-end production traffic exercising the
  header path until we deprecate something real. Mitigation: the
  unit tests construct fake registries to exercise both the
  populated and empty paths; the SDK tests construct fake
  responses with deprecation headers to exercise the warn /
  callback paths.
- **180-day minimum sunset window** is a stronger commitment than
  the 90 days originally drafted in ADR 0023. The longer window
  was chosen to align with enterprise procurement cycles and
  SOC 2 evidence collection. This MUST NOT be relaxed under
  internal roadmap pressure (anti-weakening rule §6.4 in the
  policy doc).
- **Header values are not negotiated per-client.** Every caller
  to a deprecated operation sees the same headers regardless of
  their migration status. This is by design — the wire format is
  the contract, and per-client rollout would defeat the
  point of a public deprecation signal.

### Neutral

- POST-only deprecations will need the same wrapper applied to
  POST handlers when we ship the first writeable surface. The
  helper is already method-aware; only the wrapping calls in
  POST route handlers are missing.
- Future work: a contract-test harness that spins up a fixture
  `DEPRECATION_REGISTRY` in test mode, hits each route, and
  asserts the headers fire. The unit tests cover the helper;
  this would cover the wrapper integration end-to-end. Tracked
  as a Wave 19 candidate.

## Alternatives considered

1. **Per-route inline header writes.** Would let us ship today
   without a helper, but every new route would need to remember
   the contract. Rejected — high drift risk and exactly the kind
   of thing a Wave 6 iterator-coverage gate would have to chase.
2. **Middleware-only emission.** Cleaner, but Next.js App Router
   middleware runs before the route handler can express which
   operation it ran (a 404 middleware can't know whether it would
   have hit `/providers/{id}` or `/providers`). Route-level
   wrapping is more verbose but accurate.
3. **`Deprecation: ?1` boolean form.** Spec-legal under RFC 9745
   but loses the deprecation timestamp. Rejected — see §1 above.
4. **Defer to ADR 0023.** ADR 0023 has the policy text. ADR 0024
   exists because the *implementation* is a separate, independently
   reviewable architectural commitment.

## Verification

- Unit: [`tests/unit/api/deprecation.test.ts`](../../../tests/unit/api/deprecation.test.ts)
  (27 tests covering match, format, parse, apply, and SDK
  observation).
- Unit: SDK tests in
  [`tests/unit/lib/api-client/v1-client.test.ts`](../../../tests/unit/lib/api-client/v1-client.test.ts)
  cover `parseDeprecation`, `onDeprecated` deduplication, and
  `V1ApiError.deprecation`.
- Contract: [`tests/contract/pillar-j-openapi.spec.ts`](../../../tests/contract/pillar-j-openapi.spec.ts)
  asserts every 2xx and reusable error response in the spec
  references the `Deprecation`, `Sunset`, and `Link` headers.
- Drift gates: `npm run sdk:check` and `npm run postman:check`
  pass — the regenerated SDK types and Postman collection match
  the bumped spec.
