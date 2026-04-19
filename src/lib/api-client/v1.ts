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

  constructor(
    status: number,
    message: string,
    code?: string,
    rateLimit?: V1RateLimit,
    requestId?: string,
    deprecation?: V1Deprecation,
  ) {
    super(message);
    this.name = "V1ApiError";
    this.status = status;
    this.code = code;
    this.rateLimit = rateLimit;
    this.requestId = requestId;
    this.deprecation = deprecation;
  }
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
      try {
        const body = (await res.json()) as {
          error?: { code?: string; message?: string };
        };
        if (body?.error?.message) message = body.error.message;
        code = body?.error?.code;
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
    try {
      const body = (await res.json()) as {
        error?: { code?: string; message?: string };
      };
      if (body?.error?.message) message = body.error.message;
      code = body?.error?.code;
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
    );
  }
  const data = (await res.json()) as T;
  return { status: "fresh", etag: parseEtag(res.headers), data, deprecation };
}
