# Public REST API — Versioning, Deprecation, and Sunset Policy

- **Status:** v1 — current stable (spec `1.8.0`)
- **Last reviewed:** 2026-04-19 (Wave 19)
- **Related:**
  ADR [0020](../dev/adr/0020-openapi-v1-spec.md) (OpenAPI spec),
  ADR [0022](../dev/adr/0022-public-rest-v1-sdk.md) (TypeScript SDK),
  ADR [0023](../dev/adr/0023-api-versioning-policy.md) (this policy),
  ADR [0024](../dev/adr/0024-deprecation-sunset-headers.md) (deprecation headers),
  ADR [0025](../dev/adr/0025-problem-details-rfc-9457.md) (Problem Details),
  [`docs/api/openapi-v1.yaml`](openapi-v1.yaml).

This document is the **contract** between the platform and any
external consumer of the `/api/v1/*` surface. It is the source of
truth for what counts as a breaking change, what notice we owe
customers, and how the wire-format signals deprecation.

## TL;DR

| Question | Answer |
|---|---|
| How is a version named? | URL prefix: `/api/v1/...`. No header negotiation. |
| When does a new major version ship? | When we'd otherwise need a breaking change. |
| How long do we run two majors in parallel? | **At least 12 months** after the new major is generally available. |
| How do we tell customers something is going away? | `Deprecation: @<unix-seconds>` (RFC 9745) + `Sunset: <HTTP-date>` (RFC 8594) + `Link: <new>; rel="successor-version"` headers (since spec v1.7.0) + a `/changelog` entry **at least 180 days** before sunset. |
| What's a breaking change? | See [§2](#2-what-counts-as-a-breaking-change). |

## 1. Versioning model

We use **URL-path versioning** (`/api/v1/...`, `/api/v2/...` once it
ships). This is the most common pattern in the wider API ecosystem
(Stripe, Twilio, GitHub) and the easiest to reason about for
consumers behind corporate proxies, log aggregators, and WAFs.

We do NOT use:

- `Accept: application/vnd.platform.v2+json` content negotiation —
  invisible to most ops tooling.
- Query-parameter versioning (`?v=2`) — easy to drop in proxies.
- Date-stamped versioning (`/api/2026-04-18/...`) — high cognitive
  load for customers and forces them to track a moving target.

### 1.1 What `info.version` in the OpenAPI spec means

The `info.version` field in `docs/api/openapi-v1.yaml` follows
**SemVer 2.0** within a major:

- **Patch** (`1.2.3` → `1.2.4`): docs-only changes, typo fixes.
- **Minor** (`1.2.0` → `1.3.0`): backwards-compatible additions —
  new optional fields, new endpoints, new optional query params,
  new enum values added to a response (see §2 caveats).
- **Major** (`1.x.x` → `2.0.0`): breaking changes — these only ship
  in a brand-new URL prefix (`/api/v2/`).

A consumer pinned to `/api/v1/*` will never see a major bump on
their URL; they'll see minor/patch bumps freely.

## 2. What counts as a breaking change

### 2.1 Always breaking (require a new major + 12-month parallel run)

- Removing an endpoint.
- Removing a property from a response payload.
- Renaming any property (URL path segment, query param, header,
  body field, schema name).
- Changing the type of a property (e.g. `string` → `number`).
- Adding a new **required** request property or query param.
- Tightening any input validation (e.g. shortening a maximum length).
- Changing pagination defaults (`limit` from 25 → 10).
- Changing the meaning of an existing enum value.
- Changing the HTTP status code or error `code` for a previously
  documented error case.

### 2.2 Sometimes breaking (treat as breaking unless coordinated)

- **Adding a new enum value** to a response: customers using
  exhaustive switch statements will break. We mitigate by
  documenting on the relevant schema that consumers MUST treat
  unknown enum values as the closest known value or as
  `"UNKNOWN"`. Adding a new value is then *minor*, not major.
- **Adding a new required header on responses**: technically
  additive but we treat it as breaking because some HTTP clients
  reject unexpected headers in strict modes.

### 2.3 Never breaking (free at any time)

- Adding new endpoints.
- Adding new optional query params.
- Adding new optional request body properties.
- Adding new properties to a response payload (consumers MUST
  ignore unknown response properties — JSON forward-compat).
- Adding new examples / docs to the OpenAPI spec.
- Performance improvements that don't change the wire shape.
- Bug fixes that bring behaviour into line with what the spec
  already documents.

## 3. Deprecation lifecycle

When we decide to remove something:

```
T = decision-to-deprecate

T + 0      Add an entry to DEPRECATION_REGISTRY in
           src/lib/api/deprecation.ts. Headers fire on every
           response (200, 304, 4xx, 5xx) from the matched op.
           Public /changelog entry under category "deprecation".
           OpenAPI spec adds `deprecated: true` on the operation,
           and the endpoint description gains the deprecation
           context block (see §3.2).

T + 180d   Earliest possible Sunset date. The `Sunset` header
           value (HTTP-date) is the wall-clock at which the
           operation will start returning `410 Gone`.

T + Sunset Endpoint returns `410 Gone` for at least 30 days,
           then is fully removed in the next minor bump.
```

### 3.1 Header contract (live since spec v1.7.0)

When an endpoint is on the deprecation path, **every** response
from it (2xx success, 304 not-modified, 4xx auth/scope/not-found,
429 rate-limit, 5xx server error) carries the advisory headers.
Operations that are NOT on the deprecation path do NOT emit
these headers — their absence is the contract signal.

| Header | Value | Reference |
|---|---|---|
| `Deprecation` | `@<unix-seconds>` (structured-fields integer; e.g. `@1796083200`) | [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745) |
| `Sunset` | IMF-fixdate per RFC 9110 §5.6.7 (e.g. `Sun, 11 Nov 2030 23:59:59 GMT`) | [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594) |
| `Link` | `<upgrade-guide-url>; rel="deprecation"` | [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) |
| `Link` | `<upgrade-guide-url>; rel="sunset"` | RFC 8288 |
| `Link` | `<successor-url>; rel="successor-version"` (optional, when a direct replacement exists) | [RFC 5829](https://www.rfc-editor.org/rfc/rfc5829) |

If the operation also emits pagination links (RFC 8288 `first` /
`prev` / `next` / `last`) those entries are merged into the same
`Link` header value, comma-separated.

The `Deprecation` value uses RFC 9745's structured-fields integer
form (`@<unix-seconds>`) rather than the alternate boolean form
(`?1`). The integer carries the wall-clock when deprecation took
effect, so customers can compute remaining-days locally without
parsing `Sunset`.

### 3.2 OpenAPI spec contract

The same operation in `docs/api/openapi-v1.yaml` MUST get:

```yaml
get:
  summary: List legacy things
  deprecated: true
  description: |
    **Deprecated 2026-06-01, sunset 2026-12-01.** Use
    `/api/v1/new-things` (`GET`) instead. See
    `/changelog#v1.12.0-legacy-things` for migration guidance.
```

The runtime headers and the spec `deprecated: true` flag MUST
ship together — adding one without the other is a contract
violation. The OpenAPI `components.headers.Deprecation` and
`components.headers.Sunset` definitions are attached to every
2xx, 304, and reusable error response in the spec; their
description explicitly notes "absent unless this operation is
on a deprecation path".

### 3.3 SDK observation contract

The TypeScript SDK reads the headers and surfaces the advisory
through two integration points:

```ts
import { V1Client, parseDeprecation } from "@e-credentialing/api-client";

// 1) Per-client callback — fires once per (method, path) per process.
const client = new V1Client({
  baseUrl,
  apiKey,
  onDeprecated: (info, ctx) => {
    metrics.increment("v1.deprecation_seen", {
      method: ctx.method,
      path: ctx.path,
    });
    console.warn(
      `${ctx.method} ${ctx.path} sunsets at ${info.sunsetAt?.toISOString()} — see ${info.infoUrl}`,
    );
  },
});

// 2) Per-call ad-hoc inspection — useful in raw fetch flows.
const res = await fetch(`${baseUrl}/api/v1/legacy-thing`, { headers: { Authorization: `Bearer ${apiKey}` } });
const info = parseDeprecation(res.headers);
if (info) {
  // info.deprecatedAt: Date    — when deprecation took effect
  // info.sunsetAt:    Date|undef — when 410 Gone starts
  // info.infoUrl:     string|undef — Link rel="deprecation"
  // info.successorUrl: string|undef — Link rel="successor-version"
}
```

The default `onDeprecated` callback emits a single `console.warn`.
Callers wanting a different policy (metrics, structured logs,
silent) supply their own; failures inside the callback are
swallowed so they cannot break the request path.

`V1ApiError.deprecation` is also populated when a deprecated
operation returns a non-2xx status — failures don't hide the
warning.

### 3.4 Standard rate-limit response headers (since spec v1.2.0)

Every successful 2xx response from `/api/v1/*` carries three
standard headers that describe the caller's per-key budget:

| Header | Type | Meaning |
|---|---|---|
| `X-RateLimit-Limit` | integer | Maximum requests allowed in the current fixed window. |
| `X-RateLimit-Remaining` | integer | Requests still available in the current window (>= 0). |
| `X-RateLimit-Reset` | integer | Unix-seconds (UTC) when the window resets. |

When the budget is exhausted the API returns a `429 Too Many
Requests` whose body matches the `RateLimitProblem` schema in the
OpenAPI spec:

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit of 120 requests/min exceeded. Retry in 7s.",
    "retryAfterSeconds": 7
  }
}
```

The 429 response carries the same three `X-RateLimit-*` headers
plus `Retry-After: <seconds>` (RFC 9110 §10.2.3). The
`error.code` value `"rate_limited"` is a fixed literal — see
ADR 0023 for why we treat error codes as part of the contract.

These headers were added in spec `1.2.0` (additive, non-breaking).
Removing them, renaming them, or changing their semantics would be
a breaking change and require a `/api/v2/`.

### 3.5 Request correlation header (since spec v1.3.0)

Every `/api/v1/*` request carries an `X-Request-Id` header on
**both** the request and the response. The header lets customers
join their client-side log lines to ours: paste the id into a
support ticket and on-call can pull both halves of the trace from
the audit log + Pino structured logs.

| Direction | Behaviour |
|---|---|
| Inbound | If supplied and matches `^[A-Za-z0-9_\-]{8,128}$`, we honour it. Anything else is silently replaced (we do NOT 400 - that's customer-hostile). |
| Outbound | Always present on every 2xx, 4xx, and 5xx response - including `401`, `403`, `404`, `429`, and `500`. |
| Format (server-generated) | `req_<16-hex-chars>` - opaque, never embeds a tenant id, customer id, or PHI fragment. |

The TypeScript SDK supports this end-to-end:

```ts
const client = new V1Client({
  baseUrl: "https://api.example.com",
  apiKey: process.env.API_KEY!,
  requestIdFactory: () => myCorrelationId(),
});

try {
  await client.getProvider("nope");
} catch (e) {
  const err = e as V1ApiError;
  console.error("Lookup failed", err.requestId, err.status, err.code);
}
```

Surface `err.requestId` verbatim to your support team. Removing
the header, renaming it, relaxing the format gate, or skipping it
on any response status would be a breaking change and require a
`/api/v2/`.

### 3.6 Pagination Link header (since spec v1.5.0)

Every paginated list endpoint (`GET /api/v1/providers`,
`GET /api/v1/sanctions`, `GET /api/v1/enrollments`) returns an
[RFC 8288](https://datatracker.ietf.org/doc/html/rfc8288) `Link`
response header alongside the existing JSON envelope. This is the
conventional REST pagination contract (also used by GitHub,
Stripe, Atlassian) and it lets SDKs walk the result set without
arithmetic on `page`/`totalPages`.

| `rel` value | When emitted | Notes |
|---|---|---|
| `first` | Always (when results exist) | Page 1 of the current query. |
| `prev` | When `page > 1` | Previous page. Omitted on page 1. |
| `next` | When `page < totalPages` | Next page. Omitted on the last page. |
| `last` | Always (when results exist) | `totalPages` of the current query. |

Empty result sets (`total === 0`) emit **no** `Link` header — there
is nothing to link to. The JSON envelope's `pagination` block is
unchanged and remains the source of truth for `total`,
`totalPages`, etc.

All link targets are absolute URLs that **preserve every inbound
query parameter** (filters, `limit`, future query params). Clients
can follow `next` blindly and inherit their existing filters.

The TypeScript SDK exposes a tiny helper for clients that want to
decode the header without re-implementing RFC 8288:

```ts
import { parseLinkHeader } from "@e-credentialing/api-client";

const res = await fetch(`${baseUrl}/api/v1/providers?page=2&limit=25`, {
  headers: { Authorization: `Bearer ${apiKey}` },
});
const links = parseLinkHeader(res.headers.get("Link"));
// → { first: "...", prev: "...", next: "...", last: "..." }

if (links.next) {
  const nextRes = await fetch(links.next, { headers: ... });
}
```

Removing the header, renaming any `rel` value, dropping query
parameters from link targets, or emitting non-absolute URLs would
be a breaking change and require a `/api/v2/`.

### 3.7 Conditional GETs — ETag + If-None-Match (since spec v1.6.0)

Every read endpoint emits a weak `ETag` response header (per
[RFC 9110 §8.8.3](https://www.rfc-editor.org/rfc/rfc9110#section-8.8.3))
derived from a stable hash of the *cacheable subset* of the
response body. Clients echo it back as `If-None-Match: "<etag>"`
on the next request; the server compares using weak comparison
(RFC 9110 §13.1.2) and returns either the full body with a fresh
ETag (`200`) or an empty body (`304 Not Modified`) when nothing
has changed. This is the conventional REST cache-validation
pattern (also used by GitHub, Stripe, AWS S3, npm registry).

Wired into:

| Endpoint | Cacheable subset (what the ETag covers) |
|---|---|
| `GET /api/v1/health` | `{ ok, keyId, apiVersion }` (excludes `time`) |
| `GET /api/v1/me` | `{ keyId, name, scopes, createdAt, expiresAt }` (excludes `lastUsedAt`, `rateLimit`) |
| `GET /api/v1/providers` | full JSON envelope |
| `GET /api/v1/providers/{id}` | full JSON envelope |
| `GET /api/v1/sanctions` | full JSON envelope |
| `GET /api/v1/enrollments` | full JSON envelope |
| `GET /api/v1/openapi.yaml` | raw response bytes |
| `GET /api/v1/openapi.json` | raw response bytes |
| `GET /api/v1/postman.json` | raw response bytes |

`GET /api/v1/providers/{id}/cv.pdf` is intentionally excluded
this release — binary streams have a different caching strategy
(byte-range support, separate ADR pending).

The `304 Not Modified` response carries `ETag`, `X-Request-Id`,
and the rate-limit headers but has an empty body (RFC 9110
§15.4.5). Cached requests still count against the customer's
rate-limit budget — visible via the `X-RateLimit-*` headers on
the 304.

ETag format is **always weak** (`W/"<40-hex>"`). The hash
algorithm (currently SHA-1) is an internal detail and can change
without notice; clients must treat the value as opaque. Send
`If-None-Match: *` (RFC 9110 §13.1.2) to match any current
representation.

The TypeScript SDK exposes two helpers:

```ts
import { parseEtag, conditionalGetWith } from "@e-credentialing/api-client";

const result = await conditionalGetWith<HealthShape>(
  client,
  "/api/v1/health",
  cachedEtag,
);
if (result.status === "fresh") {
  cache.put(result.etag, result.data);
} else {
  // result.status === "not-modified" — keep using the cached copy.
}
```

Removing the header, switching to strong validators without
opt-in, requiring `If-None-Match` (i.e. returning `412 Precondition
Failed` on absence), or breaking the weak comparison contract
would all be breaking changes and require a `/api/v2/`.

### 3.8 Problem Details for HTTP APIs (since spec v1.8.0)

Every error response from `/api/v1/*` ships an
[RFC 9457](https://datatracker.ietf.org/doc/html/rfc9457) Problem
Details body. The body is a **superset** of the legacy `error`
envelope, so existing clients that read `body.error.code` /
`body.error.message` continue to work unchanged.

**Body shape** (all error statuses — 401, 403, 404, 410, 429, 5xx):

```json
{
  "type": "https://api.e-credentialing.example.com/problems/insufficient-scope",
  "title": "Insufficient scope",
  "status": 403,
  "detail": "API key lacks required scope: providers:read",
  "instance": "/api/v1/providers/abc123",
  "error": {
    "code": "insufficient_scope",
    "message": "API key lacks required scope: providers:read",
    "required": "providers:read"
  }
}
```

**Stability contract:**

- The `type` URI for a given error code is **permanent**. We will
  never re-point `…/problems/insufficient-scope` to mean a different
  error class. New error classes get new URIs.
- The legacy `error` envelope (with the same `code`, `message`, and
  any `extras` we previously emitted) stays at the same path inside
  every error body. New consumers SHOULD switch on `type`; existing
  consumers MAY keep reading `error.code`.
- `instance` is the request path (without query string) that
  produced the problem.

**Content-Type negotiation** (RFC 9457 §3):

- Clients that send `Accept: application/problem+json` receive
  `Content-Type: application/problem+json`.
- Clients that send `Accept: application/json`, `*/*`, or no
  `Accept` header receive `Content-Type: application/json`. The
  body is byte-identical; only the media-type parameter changes.

**SDK observation contract:**

- `parseProblem(body)` from `@e-credentialing/api-client` accepts
  any v1 error JSON — Problem-shaped or legacy — and returns a
  normalised `V1Problem`. When the body is the legacy envelope
  only, the function synthesises `type`/`title`/`status`/`detail`
  from `error.code`/`error.message` and the response status.
- `V1ApiError.problem` is populated on every non-2xx response with
  a JSON body. Code that needs to react to a specific error class
  reads `err.problem?.type` (a stable URI), not the English
  `message` string.

Removing or repurposing a `type` URI, dropping the legacy `error`
envelope, or changing the status mapping for an existing `code`
would all be breaking changes and require a `/api/v2/`.

## 4. Major-version overlap window

When `/api/v2` ships:

- We commit to running **both** `/api/v1` and `/api/v2` for
  **at least 12 months** after `v2` is generally available.
- `/api/v1` operations remain in the OpenAPI spec for the full
  overlap window. The spec gains `info.x-version-status: "supported"`
  on v1 and `"current"` on v2 during the overlap.
- All `/api/v1/*` responses gain `Deprecation: @<unix-seconds>`
  + `Sunset: <HTTP-date>` headers on day one of the overlap, even
  if the specific endpoint hasn't changed semantics. The
  `Deprecation` value carries the v2-GA timestamp; the `Sunset`
  value is the v1 removal date (≥ 12 months later). Customers
  MUST take this as the migration signal. Operationally this is
  one bulk `DEPRECATION_REGISTRY` entry per surface, applied via
  `applyDeprecationByRoute` in middleware.
- We commit to a **migration runbook** in
  `docs/dev/runbooks/api-migration-v1-to-v2.md` published on day
  one of the overlap.

## 5. Communication

- **Public changelog at `/changelog`** is the source of truth for
  customer-visible API changes. Every deprecation, every breaking
  change in a new major, and every behavioural change goes there.
- **OpenAPI spec** is the machine-readable mirror. Bump
  `info.version` on every shipped change.
- **Email to customers with active API keys** for deprecations
  with `Sunset < T + 180d`.

## 6. Anti-weakening rules

The following invariants MUST be preserved:

1. **No silent breaking changes.** If `npm run sdk:check` would
   fail because the regenerated `v1-types.ts` lost a property,
   that's a breaking change that needs a new major — fix the
   spec, don't just regenerate.
2. **The 12-month overlap window is non-negotiable.** Internal
   roadmap pressure does not shrink it.
3. **`Deprecation` + `Sunset` headers MUST be present** before any
   endpoint can return `410 Gone`. The runbook in `docs/dev/runbooks/api-migration-v1-to-v2.md`
   (Wave 12 candidate) will host the deploy checklist that enforces this.
4. **Customers with active API keys MUST be emailed** for any
   deprecation with `Sunset` within 180 days. The mailing list is
   driven by `api_keys.organization` ownership.
5. **This document MUST NOT be edited without an ADR.** Any
   relaxation to any of the above rules is, by definition, an
   architectural change.

## 7. Quick reference for engineers

- "Is this change breaking?" → §2.
- "How long until I can delete this endpoint?" → §3 (180 days
  minimum after `Deprecation`-header-on date).
- "What headers do I need on a deprecated endpoint?" → §3.1.
- "How do I observe deprecations from the SDK?" → §3.3.
- "What rate-limit headers must I emit?" → §3.4.
- "What request-id headers must I emit?" → §3.5.
- "How do I emit pagination Link headers?" → §3.6.
- "How do I add ETag support to a new endpoint?" → §3.7.
- "What error-body shape do I emit?" → §3.8 (Problem Details).
- "How do I document this deprecation in the spec?" → §3.2.
- "When can I ship `/api/v2`?" → After at least one of:
  - Required customer feature that can't ship in v1, OR
  - Critical safety fix that requires a wire-format change.
  Then commit to the 12-month parallel-run window from §4.

## 8. See also

- [`docs/api/openapi-v1.yaml`](openapi-v1.yaml) — current v1 spec
- [Public changelog source](../changelog/public.md) — customer-visible feed (rendered at `/changelog`)
- ADR [0020](../dev/adr/0020-openapi-v1-spec.md) — spec authoring decision
- ADR [0022](../dev/adr/0022-public-rest-v1-sdk.md) — SDK + drift gate
- ADR [0023](../dev/adr/0023-api-versioning-policy.md) — this policy
- Runbook [SDK generation](../dev/runbooks/sdk-generation.md)
- Runbook [Schemathesis fuzz](../dev/runbooks/schemathesis-fuzz.md)
