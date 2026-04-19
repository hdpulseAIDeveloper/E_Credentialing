/**
 * Public REST v1 API client (TypeScript SDK shim).
 *
 * Wave 10 (2026-04-18). A thin, dependency-free wrapper over `fetch`
 * that consumes the auto-generated `v1-types.ts` shapes. Designed
 * for two consumers:
 *
 *   1. Internal use (E2E tests, internal scripts) where the
 *      "client" is just a strongly-typed call site.
 *   2. Documentation: copy/paste this file into any TypeScript
 *      project, point it at your host + bearer key, and you have a
 *      working client without pulling our entire repository.
 *
 * Anti-weakening
 * --------------
 * - This file MUST stay dependency-free (no `axios`, no `ky`, no
 *   `superagent`). The CVO promise is "drop into any v18+ Node or
 *   any modern browser, no transitive deps".
 * - The shape types come from `v1-types.ts` (auto-generated). Do NOT
 *   hand-edit the response interfaces here — regenerate via
 *   `npm run sdk:gen`.
 * - Errors thrown by `request` MUST surface the response status and
 *   any structured `{ error: { code, message } }` body — they are
 *   the contract for retries and circuit breakers.
 */

import type { paths, components } from "./v1-types";

/** Subset of `fetch` we depend on — keeps this file Node-runtime-agnostic. */
type FetchLike = typeof fetch;

export interface V1ClientOptions {
  /** Base URL with no trailing slash, e.g. `https://api.example.com`. */
  baseUrl: string;
  /** Bearer API key. Issued via `/admin/api-keys`. */
  apiKey: string;
  /** Optional `fetch` implementation; defaults to global `fetch`. */
  fetch?: FetchLike;
  /**
   * Optional factory invoked once per request. Returns the value to
   * send as the `X-Request-Id` header. Use this to thread your own
   * client-side correlation id through to our audit log + Pino
   * logs. The string MUST match `^[A-Za-z0-9_\-]{8,128}$`; anything
   * else is silently dropped server-side. Available since v1.3.0.
   */
  requestIdFactory?: () => string | undefined;
  /**
   * Optional callback invoked the FIRST time the SDK observes a
   * `Deprecation` header for a given operation in the lifetime of
   * this client instance. Subsequent observations of the same
   * operation are suppressed (the SDK keeps an internal set of
   * already-warned operations). The default callback emits one
   * `console.warn` per operation; pass `() => undefined` to silence
   * entirely. Available since v1.7.0.
   */
  onDeprecated?: (info: V1Deprecation, context: V1DeprecationContext) => void;
}

/** Context passed to `onDeprecated` so callbacks can build per-op cache keys. */
export interface V1DeprecationContext {
  /** Uppercase HTTP method, e.g. `"GET"`. */
  method: string;
  /** Request path, e.g. `"/api/v1/legacy-thing"`. */
  path: string;
  /** Response status; `undefined` when invoked from a non-fetch context. */
  status?: number;
}

/**
 * Decoded RFC 9745 + RFC 8594 + RFC 5829 deprecation advisory.
 * `undefined` when the operation is not on the deprecation path.
 * Available on every v1 response since spec v1.7.0.
 */
export interface V1Deprecation {
  /** Wall-clock when deprecation took effect, parsed from the `Deprecation` header. */
  deprecatedAt: Date;
  /** Wall-clock when the operation will return 410, parsed from the `Sunset` header. */
  sunsetAt: Date | undefined;
  /** Stable upgrade-guide URL, parsed from `Link; rel="deprecation"`. */
  infoUrl: string | undefined;
  /** Replacement endpoint URL, parsed from `Link; rel="successor-version"`. */
  successorUrl: string | undefined;
}

export class V1ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  /**
   * Parsed rate-limit snapshot from the response headers, if present.
   * Available on every v1 error since spec v1.2.0 - including the 429
   * RateLimitProblem response, where remaining === 0 and
   * retryAfterSeconds mirrors the body.
   */
  readonly rateLimit: V1RateLimit | undefined;
  /**
   * Server-assigned correlation id pulled from the X-Request-Id
   * response header. Available on every v1 error since spec v1.3.0;
   * safe to surface verbatim to your support team - it is the lookup
   * key in our audit log + Pino structured logs. undefined only when
   * the deployment is older than 1.3.0 or the response was
   * network-aborted before headers arrived.
   */
  readonly requestId: string | undefined;
  /**
   * Parsed deprecation advisory from the response headers (since
   * spec v1.7.0). `undefined` for operations on the supported path —
   * its presence is the signal that the operation is being retired.
   * The SDK surfaces a one-time `console.warn` per process when it
   * sees a non-undefined value (suppress with
   * `V1ClientOptions.onDeprecated = () => undefined`).
   */
  readonly deprecation: V1Deprecation | undefined;
  /**
   * Parsed RFC 9457 Problem Details object (since spec v1.8.0). Present
   * whenever the response body is JSON-shaped — which is the entire
   * v1 contract. Mirrors the response status, the canonical `type`
   * URI for the error code, the human-readable `title`, the
   * occurrence-specific `detail`, and (when the server set it) the
   * `instance` request path. The legacy `code` / `message` fields on
   * `V1ApiError` continue to work and are sourced from
   * `problem.error.code` / `problem.error.message` for backward
   * compatibility.
   */
  readonly problem: V1Problem | undefined;

  constructor(
    status: number,
    message: string,
    code?: string,
    rateLimit?: V1RateLimit,
    requestId?: string,
    deprecation?: V1Deprecation,
    problem?: V1Problem,
  ) {
    super(message);
    this.name = "V1ApiError";
    this.status = status;
    this.code = code;
    this.rateLimit = rateLimit;
    this.requestId = requestId;
    this.deprecation = deprecation;
    this.problem = problem;
  }
}

/**
 * RFC 9457 Problem Details object as emitted by `/api/v1/*` since
 * spec v1.8.0. The body is a strict superset of the legacy
 * `{ error: { code, message, ...extras } }` envelope, so older code
 * that reads `problem.error.code` continues to work; new code SHOULD
 * read the top-level `type` / `title` / `status` / `detail` fields.
 */
export interface V1Problem {
  /** Stable URI per error code (RFC 9457 §3.1.1). */
  type: string;
  /** Short human-readable summary (RFC 9457 §3.1.3). */
  title: string;
  /** HTTP status, mirrored into the body (RFC 9457 §3.1.2). */
  status: number;
  /** Occurrence-specific human-readable detail (RFC 9457 §3.1.4). */
  detail: string;
  /** URI reference (typically request path) for the specific occurrence. */
  instance?: string;
  /** Legacy envelope, preserved verbatim. */
  error: { code: string; message: string; [extra: string]: unknown };
  /** RFC 9457 §3.2 extension members (e.g. `retryAfterSeconds` on 429). */
  [extension: string]: unknown;
}

/**
 * Parse a JSON body into the canonical `V1Problem` shape. Returns
 * `undefined` when the body is not a Problem (e.g. older deployments
 * on spec < 1.8.0 that returned only the legacy `{ error }` envelope —
 * those are accepted too as a degraded form). The function is
 * tolerant: missing top-level RFC 9457 fields are filled in from the
 * legacy `error` envelope where possible so callers can rely on
 * `problem.title` / `problem.detail` always being present.
 */
export function parseProblem(
  body: unknown,
  fallbackStatus?: number,
): V1Problem | undefined {
  if (body === null || typeof body !== "object") return undefined;
  const record = body as Record<string, unknown>;
  const errorField = record.error;
  const errorObj =
    errorField !== null && typeof errorField === "object"
      ? (errorField as { code?: unknown; message?: unknown; [k: string]: unknown })
      : undefined;
  const code = typeof errorObj?.code === "string" ? errorObj.code : undefined;
  const message = typeof errorObj?.message === "string" ? errorObj.message : undefined;
  if (!errorObj || code === undefined || message === undefined) {
    return undefined;
  }
  const status = typeof record.status === "number" ? record.status : fallbackStatus ?? 0;
  const type =
    typeof record.type === "string"
      ? record.type
      : `urn:e-credentialing:errors:${code}`;
  const title = typeof record.title === "string" ? record.title : code;
  const detail = typeof record.detail === "string" ? record.detail : message;
  const instance = typeof record.instance === "string" ? record.instance : undefined;
  const errorExtras: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(errorObj)) {
    if (k === "code" || k === "message") continue;
    errorExtras[k] = v;
  }
  const out: V1Problem = {
    type,
    title,
    status,
    detail,
    error: { code, message, ...errorExtras },
  };
  if (instance !== undefined) out.instance = instance;
  for (const [k, v] of Object.entries(record)) {
    if (k === "type" || k === "title" || k === "status" || k === "detail" || k === "instance" || k === "error") continue;
    out[k] = v;
  }
  return out;
}

/**
 * One field-level validation failure as emitted on `400 Bad Request`
 * responses since spec v1.9.0. The `code` value is the underlying
 * Zod issue code and is part of the wire contract — common values
 * include `too_small`, `too_big`, `invalid_enum_value`,
 * `invalid_type`, `invalid_string`. Renaming any code here is a
 * SemVer breaking change.
 */
export interface V1ValidationFieldError {
  /**
   * Dot-joined path inside the parsed query parameters
   * (e.g. `"limit"`, `"page"`, `"filters.status"`). Empty string
   * when the failure is on the root.
   */
  field: string;
  /** Stable Zod issue code; see interface docstring. */
  code: string;
  /** Human-readable English explanation of the failure. */
  message: string;
}

/**
 * Specialisation of `V1Problem` for `400 Bad Request` validation
 * failures (spec v1.9.0+). The `errors` extension array is non-empty;
 * multiple invalid query parameters in one request surface as
 * multiple entries so clients no longer need to retry once per fix.
 */
export interface V1ValidationProblem extends V1Problem {
  status: 400;
  errors: V1ValidationFieldError[];
}

/**
 * Stable URI used by every validation Problem (spec v1.9.0+). Matches
 * `…/errors/invalid-request` regardless of host. Use this constant
 * instead of substring-matching `problem.type`.
 */
export const VALIDATION_PROBLEM_TYPE_SUFFIX = "/errors/invalid-request";

/**
 * Type guard: does this `V1Problem` carry a non-empty `errors[]`
 * array, i.e. is it a 400 validation failure? Checks both the
 * stable `type` URI suffix AND the `errors` array shape, so a
 * future server that emits `errors[]` on a non-validation Problem
 * won't accidentally match.
 */
export function isValidationProblem(
  problem: V1Problem | undefined | null,
): problem is V1ValidationProblem {
  if (!problem) return false;
  if (problem.status !== 400) return false;
  if (!problem.type.endsWith(VALIDATION_PROBLEM_TYPE_SUFFIX)) return false;
  const errors = (problem as { errors?: unknown }).errors;
  if (!Array.isArray(errors) || errors.length === 0) return false;
  for (const entry of errors) {
    if (entry === null || typeof entry !== "object") return false;
    const e = entry as Record<string, unknown>;
    if (typeof e.field !== "string") return false;
    if (typeof e.code !== "string") return false;
    if (typeof e.message !== "string") return false;
  }
  return true;
}

/**
 * Decoded `X-RateLimit-*` (and `Retry-After`, on 429) headers.
 * Available on every successful and failed v1 response since spec
 * v1.2.0. Use `parseRateLimit(response.headers)` from a raw
 * `Response`, or read `V1ApiError.rateLimit` after a thrown error.
 */
export interface V1RateLimit {
  /** Maximum requests allowed in the current fixed window. */
  limit: number;
  /** Requests still available in the current window. */
  remaining: number;
  /** Unix-seconds when the window resets. */
  resetUnixSeconds: number;
  /** Seconds until next request allowed (only on 429s; else 0). */
  retryAfterSeconds: number;
}

/**
 * Parse the `X-RateLimit-*` (and `Retry-After`) headers off any
 * response from the v1 API. Returns `undefined` when none are
 * present — useful for older deployments still on spec < 1.2.0.
 */
export function parseRateLimit(headers: Headers): V1RateLimit | undefined {
  const limit = headers.get("x-ratelimit-limit");
  const remaining = headers.get("x-ratelimit-remaining");
  const reset = headers.get("x-ratelimit-reset");
  if (limit === null || remaining === null || reset === null) return undefined;
  const retryAfter = headers.get("retry-after");
  return {
    limit: Number(limit),
    remaining: Number(remaining),
    resetUnixSeconds: Number(reset),
    retryAfterSeconds: retryAfter !== null ? Number(retryAfter) : 0,
  };
}

/** Regex for X-Request-Id - mirrors `src/lib/api/request-id.ts` server-side. */
const REQUEST_ID_RE = /^[A-Za-z0-9_\-]{8,128}$/;

/**
 * Default `onDeprecated` callback. One concise `console.warn` per
 * operation per process — enough to make a developer notice during
 * QA but not noisy in production polling loops.
 */
function defaultDeprecationWarn(
  info: V1Deprecation,
  context: V1DeprecationContext,
): void {
  const sunset = info.sunsetAt ? info.sunsetAt.toISOString() : "unspecified";
  const guide = info.infoUrl ?? "(no upgrade guide URL)";
  // eslint-disable-next-line no-console
  console.warn(
    `[V1Client] DEPRECATED: ${context.method} ${context.path} — ` +
      `deprecated since ${info.deprecatedAt.toISOString()}, ` +
      `sunset ${sunset}. Upgrade guide: ${guide}`,
  );
}

export class V1Client {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly requestIdFactory: (() => string | undefined) | undefined;
  private readonly onDeprecated: (
    info: V1Deprecation,
    context: V1DeprecationContext,
  ) => void;
  /** Per-instance dedupe set: `${METHOD} ${path}` keys we've already warned on. */
  private readonly warnedOperations = new Set<string>();

  constructor(opts: V1ClientOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.fetchImpl =
      opts.fetch ?? (typeof fetch === "function" ? fetch : (undefined as never));
    if (!this.fetchImpl) {
      throw new Error(
        "V1Client: no fetch implementation available. Pass `opts.fetch`.",
      );
    }
    if (!this.apiKey) {
      throw new Error("V1Client: apiKey is required.");
    }
    this.requestIdFactory = opts.requestIdFactory;
    this.onDeprecated = opts.onDeprecated ?? defaultDeprecationWarn;
  }

  /** Internal helper: dispatch the deprecation callback at most once per op. */
  private maybeWarnDeprecation(
    headers: Headers,
    method: string,
    path: string,
    status: number | undefined,
  ): V1Deprecation | undefined {
    const info = parseDeprecation(headers);
    if (!info) return undefined;
    const key = `${method.toUpperCase()} ${path}`;
    if (this.warnedOperations.has(key)) return info;
    this.warnedOperations.add(key);
    try {
      this.onDeprecated(info, { method: method.toUpperCase(), path, status });
    } catch {
      // Callbacks must never break the request path.
    }
    return info;
  }

  private async request<T>(
    method: string,
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${this.apiKey}`);
    headers.set("Accept", "application/json");
    if (this.requestIdFactory && !headers.has("X-Request-Id")) {
      const candidate = this.requestIdFactory();
      if (candidate && REQUEST_ID_RE.test(candidate)) {
        headers.set("X-Request-Id", candidate);
      }
    }
    const res = await this.fetchImpl(url, { ...init, method, headers });
    const deprecation = this.maybeWarnDeprecation(res.headers, method, path, res.status);
    if (!res.ok) {
      let code: string | undefined;
      let message = `HTTP ${res.status} on ${method} ${path}`;
      let problem: V1Problem | undefined;
      try {
        const body = (await res.json()) as unknown;
        problem = parseProblem(body, res.status);
        if (problem) {
          message = problem.detail || problem.error.message || message;
          code = problem.error.code;
        } else if (body && typeof body === "object" && "error" in (body as object)) {
          const err = (body as { error?: { code?: string; message?: string } }).error;
          if (err?.message) message = err.message;
          code = err?.code;
        }
      } catch {
        // Non-JSON error body is fine - the HTTP message is enough.
      }
      throw new V1ApiError(
        res.status,
        message,
        code,
        parseRateLimit(res.headers),
        res.headers.get("x-request-id") ?? undefined,
        deprecation,
        problem,
      );
    }
    return (await res.json()) as T;
  }

  // ---- health ----

  /**
   * `GET /api/v1/health` — verifies the API key is active and the
   * environment is reachable. The natural first call when wiring
   * up a new client. Available since v1.1.0; `apiVersion` returns
   * `"1.4.0"` and above on a current deployment.
   */
  health(): Promise<components["schemas"]["Health"]> {
    return this.request("GET", "/api/v1/health");
  }

  // ---- me ----

  /**
   * `GET /api/v1/me` — API key introspection. Returns the current
   * key's name, granted scopes, lifecycle timestamps, and current
   * rate-limit budget. Pairs with `health()` to make "is my key
   * configured correctly?" a one-call answer.
   *
   * Available since spec v1.4.0. Like `health()`, requires only a
   * valid bearer key — no specific scope needed.
   */
  me(): Promise<components["schemas"]["Me"]> {
    return this.request("GET", "/api/v1/me");
  }

  // ---- providers ----

  listProviders(
    query: paths["/api/v1/providers"]["get"]["parameters"]["query"] = {},
  ): Promise<
    paths["/api/v1/providers"]["get"]["responses"]["200"]["content"]["application/json"]
  > {
    const qs = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/api/v1/providers${suffix}`);
  }

  getProvider(
    id: string,
  ): Promise<components["schemas"]["ProviderDetail"]> {
    return this.request("GET", `/api/v1/providers/${encodeURIComponent(id)}`);
  }

  /**
   * CV PDF: returns the raw response so the caller can stream it.
   * Forwards X-Request-Id (if requestIdFactory is configured) and
   * surfaces the server-assigned correlation id on the thrown error.
   */
  async getProviderCv(id: string): Promise<Response> {
    const url = `${this.baseUrl}/api/v1/providers/${encodeURIComponent(id)}/cv.pdf`;
    const headers = new Headers({
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/pdf",
    });
    if (this.requestIdFactory) {
      const candidate = this.requestIdFactory();
      if (candidate && REQUEST_ID_RE.test(candidate)) {
        headers.set("X-Request-Id", candidate);
      }
    }
    const res = await this.fetchImpl(url, { headers });
    const deprecation = this.maybeWarnDeprecation(
      res.headers,
      "GET",
      `/api/v1/providers/${id}/cv.pdf`,
      res.status,
    );
    if (!res.ok) {
      throw new V1ApiError(
        res.status,
        `HTTP ${res.status} on GET ${url}`,
        undefined,
        parseRateLimit(res.headers),
        res.headers.get("x-request-id") ?? undefined,
        deprecation,
      );
    }
    return res;
  }

  // ---- sanctions ----

  listSanctions(
    query: paths["/api/v1/sanctions"]["get"]["parameters"]["query"] = {},
  ): Promise<
    paths["/api/v1/sanctions"]["get"]["responses"]["200"]["content"]["application/json"]
  > {
    const qs = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/api/v1/sanctions${suffix}`);
  }

  // ---- enrollments ----

  listEnrollments(
    query: paths["/api/v1/enrollments"]["get"]["parameters"]["query"] = {},
  ): Promise<
    paths["/api/v1/enrollments"]["get"]["responses"]["200"]["content"]["application/json"]
  > {
    const qs = new URLSearchParams();
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) qs.set(k, String(v));
      }
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return this.request("GET", `/api/v1/enrollments${suffix}`);
  }
}

export type { paths, components, operations } from "./v1-types";

/**
 * Decoded RFC 8288 `Link` header from any paginated v1 list
 * response. Maps each `rel` token (`first | prev | next | last`)
 * to the absolute URL the server emitted. Available since spec
 * v1.5.0.
 */
export type V1PaginationLinks = {
  first?: string;
  prev?: string;
  next?: string;
  last?: string;
  /** Tolerant of forward-compat additions; unknown rels appear here. */
  [rel: string]: string | undefined;
};

/**
 * Parse an inbound RFC 8288 `Link` header value back into a
 * `{ rel: url }` map. Tolerant of whitespace, mixed case `rel`
 * tokens, and unknown `rel` values. Returns an empty object for
 * `null`/empty input. Mirrors the server-side helper at
 * `src/lib/api/pagination-links.ts` byte-for-byte so client-side
 * navigation never disagrees with what the server emitted.
 */
export function parseLinkHeader(value: string | null | undefined): V1PaginationLinks {
  const out: V1PaginationLinks = {};
  if (!value) return out;
  for (const segment of value.split(",")) {
    const m = segment.match(/^\s*<([^>]+)>\s*;\s*rel=("([^"]+)"|([^;\s]+))\s*$/);
    if (!m) continue;
    const url = m[1]!;
    const rel = (m[3] ?? m[4] ?? "").toLowerCase();
    if (rel) out[rel] = url;
  }
  return out;
}

/**
 * Read the `ETag` response header off any v1 response (since spec
 * v1.6.0). Returns the raw token value (e.g. `W/"deadbeef"` or
 * `"deadbeef"`) so callers can echo it back as `If-None-Match`
 * on the next poll. Returns `undefined` for `null`/empty/missing
 * headers (e.g. on older deployments).
 */
export function parseEtag(headers: Headers): string | undefined {
  const v = headers.get("etag");
  return v && v.length > 0 ? v : undefined;
}

/**
 * Parse the RFC 9745 `Deprecation`, RFC 8594 `Sunset`, and RFC 8288
 * `Link` headers off any v1 response into a single
 * `V1Deprecation` record. Returns `undefined` when the operation
 * is NOT on the deprecation path — its presence is the contract
 * signal. Available since spec v1.7.0.
 *
 * Inputs the SDK is tolerant of:
 *
 *   - `Deprecation: @1796083200` (RFC 9745 structured-fields integer)
 *   - `Sunset: Sun, 11 Nov 2030 23:59:59 GMT` (RFC 9110 IMF-fixdate)
 *   - `Link: <https://app/x>; rel="deprecation"` (rel string)
 *   - `Link: <https://app/x>; rel="successor-version"` (replacement)
 *
 * The `infoUrl` and `successorUrl` fields are populated independently
 * of the rest — older deployments that emit `Deprecation` without a
 * `Link` rel="deprecation" entry still produce a valid record with
 * `infoUrl: undefined`.
 */
export function parseDeprecation(headers: Headers): V1Deprecation | undefined {
  const dep = headers.get("deprecation");
  if (!dep) return undefined;
  const trimmed = dep.trim();
  if (!trimmed.startsWith("@")) return undefined;
  const seconds = Number(trimmed.slice(1));
  if (!Number.isFinite(seconds) || seconds <= 0) return undefined;
  const sunsetRaw = headers.get("sunset");
  const sunsetTs = sunsetRaw ? Date.parse(sunsetRaw) : NaN;
  const links = parseLinkHeader(headers.get("link"));
  return {
    deprecatedAt: new Date(seconds * 1000),
    sunsetAt: Number.isFinite(sunsetTs) ? new Date(sunsetTs) : undefined,
    infoUrl: links.deprecation,
    successorUrl: links["successor-version"],
  };
}

/**
 * Convenience wrapper to perform a conditional GET against any v1
 * endpoint (since spec v1.6.0). Returns either:
 *
 *   - `{ status: "fresh", etag, data }`        - the resource was
 *                                                  re-sent with a
 *                                                  new ETag.
 *   - `{ status: "not-modified", etag }`       - the cached copy
 *                                                  is still valid;
 *                                                  no body returned.
 *
 * Throws `V1ApiError` for any non-200/304 response (auth failures,
 * rate limiting, etc) so callers don't need to special-case errors.
 *
 * Use it like:
 *
 *   const result = await client.conditionalGet<HealthShape>(
 *     "/api/v1/health",
 *     previousEtag,
 *   );
 *   if (result.status === "fresh") cache.put(result.etag, result.data);
 */
export async function conditionalGetWith<T>(
  client: V1Client,
  path: string,
  ifNoneMatch: string | undefined,
): Promise<
  | { status: "fresh"; etag: string | undefined; data: T; deprecation: V1Deprecation | undefined }
  | { status: "not-modified"; etag: string | undefined; deprecation: V1Deprecation | undefined }
> {
  // We have to reach into the client; expose enough internals
  // through a bound helper.
  const internals = client as unknown as {
    baseUrl: string;
    apiKey: string;
    fetchImpl: FetchLike;
    requestIdFactory?: () => string | undefined;
    maybeWarnDeprecation?: (
      headers: Headers,
      method: string,
      path: string,
      status: number | undefined,
    ) => V1Deprecation | undefined;
  };
  const headers = new Headers({
    Authorization: `Bearer ${internals.apiKey}`,
    Accept: "application/json",
  });
  if (ifNoneMatch) headers.set("If-None-Match", ifNoneMatch);
  if (internals.requestIdFactory) {
    const candidate = internals.requestIdFactory();
    if (candidate && REQUEST_ID_RE.test(candidate)) {
      headers.set("X-Request-Id", candidate);
    }
  }
  const res = await internals.fetchImpl(`${internals.baseUrl}${path}`, {
    headers,
  });
  const deprecation = internals.maybeWarnDeprecation
    ? internals.maybeWarnDeprecation(res.headers, "GET", path, res.status)
    : parseDeprecation(res.headers);
  if (res.status === 304) {
    return { status: "not-modified", etag: parseEtag(res.headers), deprecation };
  }
  if (!res.ok) {
    let code: string | undefined;
    let message = `HTTP ${res.status} on GET ${path}`;
    let problem: V1Problem | undefined;
    try {
      const body = (await res.json()) as unknown;
      problem = parseProblem(body, res.status);
      if (problem) {
        message = problem.detail || problem.error.message || message;
        code = problem.error.code;
      } else if (body && typeof body === "object" && "error" in (body as object)) {
        const err = (body as { error?: { code?: string; message?: string } }).error;
        if (err?.message) message = err.message;
        code = err?.code;
      }
    } catch {
      // Non-JSON error body is fine.
    }
    throw new V1ApiError(
      res.status,
      message,
      code,
      parseRateLimit(res.headers),
      res.headers.get("x-request-id") ?? undefined,
      deprecation,
      problem,
    );
  }
  const data = (await res.json()) as T;
  return { status: "fresh", etag: parseEtag(res.headers), data, deprecation };
}
