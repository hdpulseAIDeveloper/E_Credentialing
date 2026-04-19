/**
 * Public v1 error catalog — single source of truth.
 *
 * Wave 21 (2026-04-19). Every code that can appear inside a v1
 * `Problem` body's `error.code` field (and therefore inside the
 * `type` URI's path component as `…/errors/<code-kebab>`) MUST
 * have an entry here. The catalog is consumed by:
 *
 *   - `src/lib/api/problem-details.ts`      (builds the Problem body)
 *   - `src/app/api/v1/errors/route.ts`      (JSON list endpoint)
 *   - `src/app/api/v1/errors/[code]/route.ts` (JSON detail endpoint)
 *   - `src/app/errors/page.tsx`             (HTML index — what the
 *                                            `type` URI points to)
 *   - `src/app/errors/[code]/page.tsx`      (HTML detail page)
 *   - `tests/unit/api/error-catalog.test.ts` (registry contract)
 *
 * Anti-weakening (do not regress):
 *
 *   1. Every code in this catalog MUST have a stable `code` value.
 *      Renaming a code is a SemVer breaking change because the
 *      `type` URI is derived from it (`type = base/errors/<kebab>`)
 *      and clients dispatch on it.
 *   2. Every code that any code path passes to `v1ErrorResponse` /
 *      `buildProblem` MUST appear here. The contract test in
 *      `tests/unit/api/error-catalog.test.ts` enforces this by
 *      grepping the v1 source tree.
 *   3. The `status` field MUST match the HTTP status the platform
 *      actually returns for that code. If a code can be returned
 *      with multiple statuses (it shouldn't), split it into two
 *      codes.
 *   4. `summary` is the one-sentence English explanation that
 *      doubles as the RFC 9457 `title` (so it MUST stay short and
 *      occurrence-invariant — see `problem-details.ts` §3.1.3
 *      anti-weakening note).
 *   5. New codes MAY be added in a minor SemVer bump; codes MAY
 *      be retired (set `retiredInVersion`) but their entries MUST
 *      stay in the catalog forever so old `type` URIs still
 *      resolve. Removing a row entirely is breaking.
 */

/**
 * One catalog row — the public, machine-readable description of a
 * single error code.
 */
export interface ErrorCatalogEntry {
  /**
   * Stable snake_case identifier — the value of `error.code` in
   * the Problem body and the kebab-case suffix of the `type` URI.
   */
  code: string;
  /**
   * RFC 9457 `title` — short, occurrence-invariant English label.
   * Title-Case, no trailing punctuation, ≤ 60 chars.
   */
  title: string;
  /**
   * HTTP status the platform always returns alongside this code.
   * One status per code; if the same condition can produce two
   * statuses, that's two codes.
   */
  status: number;
  /**
   * One-sentence English summary — the body of the `/errors`
   * index row. Plain prose, no markdown.
   */
  summary: string;
  /**
   * Full English explanation of what triggers the error and what
   * the body shape looks like. Markdown is permitted. Used in the
   * `/errors/[code]` detail page and the JSON detail endpoint.
   */
  description: string;
  /**
   * Concrete remediation guidance for the integrator. Markdown
   * permitted. Empty string is allowed for `5xx` codes where the
   * remediation is "retry with backoff" (which is implicit).
   */
  remediation: string;
  /**
   * SemVer of the OpenAPI spec at which this code was introduced.
   * Customers can filter the catalog by `sinceVersion` to discover
   * what's new.
   */
  sinceVersion: string;
  /**
   * If set, the SemVer of the OpenAPI spec at which this code was
   * retired. Retired codes still appear in the catalog (so old
   * `type` URIs keep resolving) but the platform no longer emits
   * them. Mutually exclusive with code being currently emitted.
   */
  retiredInVersion?: string;
  /**
   * Stable HTTP path under the public host where the human-readable
   * docs for this code live. Always `/errors/<kebab-code>`. Pre-
   * computed at module load so consumers don't have to derive it.
   */
  docsPath: string;
}

function kebab(code: string): string {
  return code.replace(/_/g, "-").toLowerCase();
}

function entry(
  partial: Omit<ErrorCatalogEntry, "docsPath">,
): ErrorCatalogEntry {
  return { ...partial, docsPath: `/errors/${kebab(partial.code)}` };
}

/**
 * The catalog. Keep alphabetised by `code` for review-friendliness;
 * order does not affect the wire contract (the JSON endpoint also
 * sorts by `code` ascending).
 */
export const ERROR_CATALOG: readonly ErrorCatalogEntry[] = [
  entry({
    code: "cv_generation_failed",
    title: "CV generation failed",
    status: 500,
    summary:
      "The platform was unable to render the requested provider's CV PDF.",
    description:
      "Returned by `GET /api/v1/providers/{id}/cv.pdf` when the underlying PDF render pipeline (`pdf-lib` + `cv-builder`) throws or times out. The provider record itself is fine; only the on-the-fly render failed. The failure is logged with the request's `X-Request-Id` so support can trace the root cause.",
    remediation:
      "Retry once with the same `X-Request-Id` to take advantage of any short-lived cache. If the second attempt also fails, file a support ticket quoting the `X-Request-Id` from any one of the failed responses; the platform team can replay the exact render server-side.",
    sinceVersion: "1.4.0",
  }),
  entry({
    code: "expired_api_key",
    title: "Expired API key",
    status: 401,
    summary:
      "The bearer API key on the request was issued by the platform but is past its `expiresAt` timestamp.",
    description:
      "Every API key carries an `expiresAt` field set at issuance time (configurable per organisation, default 365 days). Once that timestamp is in the past, the key is rejected with `401 Unauthorized` regardless of whether it's also been revoked. This is a separate `code` from `invalid_api_key` so dashboards can distinguish 'rotate the key' from 'this token is malformed'.",
    remediation:
      "Issue a new key from the admin console (`/admin/api-keys`) and replace the value in your secret store. Keys can be rotated without downtime: provision the new key, deploy it to the consumer, then revoke the old key.",
    sinceVersion: "1.0.0",
  }),
  entry({
    code: "insufficient_scope",
    title: "Insufficient scope",
    status: 403,
    summary:
      "The API key is valid, but it does not carry the scope required for the requested operation.",
    description:
      "Every v1 endpoint declares one required scope (e.g. `providers:read`, `sanctions:read`, `enrollments:read`). When the resolved API key's scope set does not contain the required scope, the request is refused with `403 Forbidden` and the Problem body's extension member `required` carries the missing scope name.",
    remediation:
      "Provision a new key with the required scope (`/admin/api-keys`), or add the scope to an existing key. Scope changes are picked up on the next request — there is no propagation delay.",
    sinceVersion: "1.0.0",
  }),
  entry({
    code: "invalid_api_key",
    title: "Invalid API key",
    status: 401,
    summary:
      "The bearer API key on the request is malformed, unknown, or has been revoked.",
    description:
      "Returned for three distinct conditions, all of which produce the same status and code so attackers cannot distinguish them: (a) the `Authorization: Bearer …` value does not match the platform's API-key format, (b) it matches the format but does not exist in the database, (c) it exists but has been administratively revoked. Treat all three as 'this token will never work'.",
    remediation:
      "Issue a new key from the admin console (`/admin/api-keys`). Do not retry with the same key — the rejection is deterministic.",
    sinceVersion: "1.0.0",
  }),
  entry({
    code: "invalid_request",
    title: "Invalid request",
    status: 400,
    summary:
      "Request validation failed. The Problem body carries an `errors[]` array with one entry per offending parameter.",
    description:
      "Returned by every paginated list endpoint (`/api/v1/providers`, `/api/v1/sanctions`, `/api/v1/enrollments`) when query-parameter validation fails (since spec v1.9.0 — see ADR 0026). The Problem body is a `ValidationProblem`: a strict superset of the standard Problem with a non-empty `errors: ValidationFieldError[]` extension array. Every offending parameter is reported in one response — no need to retry once per fix.",
    remediation:
      "Read every entry in `errors[]`. Each carries `field` (dot-joined parameter path), `code` (stable Zod issue code such as `too_small`, `too_big`, `invalid_type`, `invalid_enum_value`), and `message` (English explanation). Fix all reported fields and retry. The TypeScript SDK exposes the type guard `isValidationProblem(err.problem)` for narrowing.",
    sinceVersion: "1.9.0",
  }),
  entry({
    code: "missing_authorization",
    title: "Missing authorization",
    status: 401,
    summary:
      "The request reached a v1 endpoint without an `Authorization: Bearer …` header.",
    description:
      "Distinct from `invalid_api_key`: the request did not even attempt to authenticate. Most commonly seen when a curl one-liner is missing the `-H \"Authorization: Bearer $ECRED_API_KEY\"` flag, or when an SDK is constructed without the `apiKey` option set.",
    remediation:
      "Add the `Authorization: Bearer <api-key>` header. If you're using the TypeScript SDK, pass `apiKey` to `new V1Client({ baseUrl, apiKey })`.",
    sinceVersion: "1.0.0",
  }),
  entry({
    code: "not_found",
    title: "Resource not found",
    status: 404,
    summary:
      "The resource referenced by the request URL does not exist in the caller's organisation.",
    description:
      "Returned for `GET /api/v1/providers/{id}`, `GET /api/v1/providers/{id}/cv.pdf`, `GET /api/v1/me`, and any other resource-by-id endpoint when the id either (a) does not exist at all, or (b) exists but belongs to a different tenant. Both conditions return the same code so the API does not leak cross-tenant existence information.",
    remediation:
      "Verify the id is correct and that the API key resolving the request belongs to the same organisation that owns the resource. The Problem body's `instance` field carries the request path you asked for.",
    sinceVersion: "1.0.0",
  }),
  entry({
    code: "rate_limited",
    title: "Rate limit exceeded",
    status: 429,
    summary:
      "The caller has consumed all requests in the current rolling window.",
    description:
      "The v1 surface is rate-limited per API key (default 120 requests/minute, configurable per organisation). Once the budget is exhausted, requests return `429 Too Many Requests` with a `RateLimitProblem` body. The Problem extension member `retryAfterSeconds` matches the `Retry-After` response header. Cached `304 Not Modified` responses (since spec v1.6.0) still count against the budget.",
    remediation:
      "Wait `retryAfterSeconds` seconds (or the value of the `Retry-After` header) before retrying. Implement exponential backoff and respect the `X-RateLimit-Remaining` header on every response. The TypeScript SDK exposes `parseRateLimit(response.headers)` and `V1ApiError.rateLimit` for programmatic access.",
    sinceVersion: "1.2.0",
  }),
  entry({
    code: "unauthorized",
    title: "Unauthorized",
    status: 401,
    summary:
      "The request was not authenticated for a reason that does not fit any more specific 401 code.",
    description:
      "Generic fallback `401 Unauthorized`. Reserved for future authentication paths (e.g. session-based endpoints) and as the default for the v1 middleware when more specific causes (`missing_authorization`, `invalid_api_key`, `expired_api_key`) do not apply. Most production callers will not see this code; if you do, file a support ticket — it likely indicates a regression.",
    remediation:
      "Verify the API key is present, correct, and not expired. If all three are true and you still see `unauthorized`, file a support ticket quoting the `X-Request-Id`.",
    sinceVersion: "1.0.0",
  }),
  entry({
    code: "upstream_unavailable",
    title: "Upstream unavailable",
    status: 503,
    summary:
      "A downstream dependency (database, cache, or external integration) is temporarily unreachable.",
    description:
      "Returned when the platform cannot serve the request because a required dependency is down or saturated. The Problem body's `retryAfterSeconds` extension member carries an advisory backoff hint when the platform can estimate one. This is a transient condition; retry with backoff. Reserved for spec-v1.7.0+; not yet emitted by any code path in the current build.",
    remediation:
      "Retry the request with exponential backoff (recommended: 1s, 2s, 4s, 8s, capped at 30s, with jitter). If the failure persists for more than 5 minutes, check the platform status page.",
    sinceVersion: "1.7.0",
  }),
];

/**
 * O(1) lookup by code. Built once at module load. Returns
 * `undefined` for unknown codes — callers SHOULD fall back to
 * the heuristic `problemTitleFor` for those (which Title-Cases
 * the snake_case code).
 */
export const ERROR_CATALOG_BY_CODE: ReadonlyMap<string, ErrorCatalogEntry> =
  new Map(ERROR_CATALOG.map((entryRow) => [entryRow.code, entryRow]));

/**
 * Resolve a single entry by code, returning `undefined` for
 * unknown codes. Use this when you only need the title or status
 * for a code that may or may not be in the catalog yet (for
 * example, in the `problem-details.ts` title fallback path).
 */
export function findCatalogEntry(code: string): ErrorCatalogEntry | undefined {
  return ERROR_CATALOG_BY_CODE.get(code);
}

/**
 * The canonical alphabetised list. Returned by the JSON list
 * endpoint and used by the HTML index page. This is a fresh array
 * (sorted defensively) so callers cannot mutate the underlying
 * registry.
 */
export function listCatalogEntries(): ErrorCatalogEntry[] {
  return [...ERROR_CATALOG].sort((a, b) => a.code.localeCompare(b.code));
}
