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

  constructor(
    status: number,
    message: string,
    code?: string,
    rateLimit?: V1RateLimit,
    requestId?: string,
  ) {
    super(message);
    this.name = "V1ApiError";
    this.status = status;
    this.code = code;
    this.rateLimit = rateLimit;
    this.requestId = requestId;
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

export class V1Client {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly fetchImpl: FetchLike;
  private readonly requestIdFactory: (() => string | undefined) | undefined;

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
      );
    }
    return (await res.json()) as T;
  }

  // ---- health ----

  /**
   * `GET /api/v1/health` — verifies the API key is active and the
   * environment is reachable. The natural first call when wiring
   * up a new client. Available since v1.1.0; `apiVersion` returns
   * `"1.2.0"` and above on a current deployment.
   */
  health(): Promise<components["schemas"]["Health"]> {
    return this.request("GET", "/api/v1/health");
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
    if (!res.ok) {
      throw new V1ApiError(
        res.status,
        `HTTP ${res.status} on GET ${url}`,
        undefined,
        parseRateLimit(res.headers),
        res.headers.get("x-request-id") ?? undefined,
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
