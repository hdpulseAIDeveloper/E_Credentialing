# Public REST API — Versioning, Deprecation, and Sunset Policy

- **Status:** v1 — current stable (spec `1.6.0`)
- **Last reviewed:** 2026-04-18 (Wave 17)
- **Related:**
  ADR [0020](../dev/adr/0020-openapi-v1-spec.md) (OpenAPI spec),
  ADR [0022](../dev/adr/0022-public-rest-v1-sdk.md) (TypeScript SDK),
  ADR [0023](../dev/adr/0023-api-versioning-policy.md) (this policy),
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
| How do we tell customers something is going away? | `Deprecation: true` + `Sunset: <RFC 9745 date>` + `Link: <new>; rel="successor-version"` headers + a `/changelog` entry **at least 90 days** before sunset. |
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

T + 0      Deprecation header starts on responses to that endpoint
           Public /changelog entry under category "deprecation"
           OpenAPI spec adds `deprecated: true` on the operation/property

T + 90d    Earliest possible Sunset date (RFC 9745)
           If sunset shipping, response includes:
             Deprecation: true
             Sunset: Wed, 17 Jul 2026 00:00:00 GMT
             Link: </api/v2/...>; rel="successor-version"

T + Sunset Endpoint returns 410 Gone for at least 30 days,
           then is fully removed.
```

### 3.1 Header contract

When an endpoint is deprecated, every successful response from it
MUST include:

| Header | Value | Reference |
|---|---|---|
| `Deprecation` | `true` | [RFC 9745](https://www.rfc-editor.org/rfc/rfc9745) |
| `Sunset` | RFC 7231 date — when the endpoint will start returning 410 | [RFC 8594](https://www.rfc-editor.org/rfc/rfc8594) |
| `Link` | `<successor-url>; rel="successor-version"` | [RFC 8288](https://www.rfc-editor.org/rfc/rfc8288) |
| `Link` | `<changelog-url>; rel="deprecation"; type="text/html"` | RFC 8288 |

Exactly one `Sunset`, exactly one `successor-version` link. If the
successor lives in a future major (`/api/v2/...`), the URL there.
If the successor is just another v1 endpoint, that URL.

### 3.2 OpenAPI spec contract

The same operation in `docs/api/openapi-v1.yaml` MUST get:

```yaml
get:
  summary: List providers
  deprecated: true
  description: |
    **Deprecated 2026-04-18, sunset 2026-07-17.** Use
    `/api/v2/providers` (`GET`) instead. See the
    public changelog (`/changelog`) for migration guidance.
```

A future contract test (Wave 12 candidate) will assert that any
operation marked `deprecated: true` in the spec also serves the
required headers at runtime.

## 3.3 Standard rate-limit response headers (since spec v1.2.0)

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

## 3.4 Request correlation header (since spec v1.3.0)

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

## 3.5 Pagination Link header (since spec v1.5.0)

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

## 3.6 Conditional GETs — ETag + If-None-Match (since spec v1.6.0)

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

## 4. Major-version overlap window

When `/api/v2` ships:

- We commit to running **both** `/api/v1` and `/api/v2` for
  **at least 12 months** after `v2` is generally available.
- `/api/v1` operations remain in the OpenAPI spec for the full
  overlap window. The spec gains `info.x-version-status: "supported"`
  on v1 and `"current"` on v2 during the overlap.
- All `/api/v1/*` responses gain a `Deprecation: true` header on
  day one of the overlap, even if the specific endpoint hasn't
  changed semantics. Customers MUST take this as the migration
  signal.
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
- "How long until I can delete this endpoint?" → §3 (90 days
  minimum after `Deprecation`-header-on date).
- "What headers do I need on a deprecated endpoint?" → §3.1.
- "What rate-limit headers must I emit?" → §3.3.
- "What request-id headers must I emit?" → §3.4.
- "How do I emit pagination Link headers?" → §3.5.
- "How do I add ETag support to a new endpoint?" → §3.6.
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
