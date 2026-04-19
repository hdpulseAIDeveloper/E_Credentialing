/**
 * Lightweight in-memory rate limiter for the public REST/FHIR API.
 *
 * Strategy: fixed-window (per-process). Acceptable for a single-replica
 * deployment; will be replaced by Redis-backed sliding window when we
 * scale horizontally.
 *
 * Wave 13 — productize the rate-limit contract:
 *   - `evaluateRateLimit(key, opts)` returns a structured
 *     `RateLimitState` so callers can attach `X-RateLimit-*` response
 *     headers on **every** response (success and rejection alike).
 *   - `rateLimit(key, opts)` is kept as a convenience that builds a
 *     ready-to-return 429 NextResponse (with the standard headers and
 *     the v1 `RateLimitProblem` shape: `code: "rate_limited"`,
 *     `message`, `retryAfterSeconds`).
 *   - `applyRateLimitHeaders(response, state)` attaches
 *     `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`
 *     to any NextResponse in a single line.
 *
 * Anti-weakening (do not regress):
 *   1. Header names are part of the public REST API v1 contract — do
 *      not rename or drop them without bumping `info.version` in
 *      `docs/api/openapi-v1.yaml` and following the deprecation policy
 *      in `docs/api/versioning.md`.
 *   2. The `429` response body shape (`code: "rate_limited"`,
 *      `message`, `retryAfterSeconds`) is also part of the contract.
 *   3. `Retry-After` MUST be present on every 429.
 *   4. Header values must be string-typed (`X-RateLimit-Limit: "120"`
 *      not `120`); fetch parsers depend on this.
 */
import { NextResponse } from "next/server";

interface Bucket {
  windowStartMs: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Maximum requests per window (default 60). */
  limit?: number;
  /** Window length in milliseconds (default 60_000 = 1 minute). */
  windowMs?: number;
}

/**
 * Structured rate-limit state. Always present on a successful auth so
 * callers can attach the standard `X-RateLimit-*` headers to their
 * 200/201 responses without recomputing.
 */
export interface RateLimitState {
  /** Maximum requests allowed in the current window. */
  limit: number;
  /** Requests still available in the current window (>= 0). */
  remaining: number;
  /** Unix-seconds timestamp when the current window resets. */
  resetUnixSeconds: number;
  /** True when the request is allowed; false when over budget. */
  allowed: boolean;
  /**
   * Seconds until the next window starts. Always >= 1 even when the
   * window has just elapsed (callers send `Retry-After` as an integer).
   */
  retryAfterSeconds: number;
}

/**
 * Pure evaluation of a fixed-window rate limit. Records the request
 * against the bucket — i.e. side-effecting on success — but never
 * builds a response.
 */
export function evaluateRateLimit(
  bucketKey: string,
  opts: RateLimitOptions = {},
): RateLimitState {
  const limit = opts.limit ?? 60;
  const windowMs = opts.windowMs ?? 60_000;
  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    buckets.set(bucketKey, { windowStartMs: now, count: 1 });
    const resetMs = now + windowMs;
    return {
      limit,
      remaining: Math.max(0, limit - 1),
      resetUnixSeconds: Math.ceil(resetMs / 1000),
      allowed: true,
      retryAfterSeconds: Math.max(1, Math.ceil(windowMs / 1000)),
    };
  }

  bucket.count += 1;
  const resetMs = bucket.windowStartMs + windowMs;
  const retryAfterSeconds = Math.max(1, Math.ceil((resetMs - now) / 1000));
  const remaining = Math.max(0, limit - bucket.count);
  return {
    limit,
    remaining,
    resetUnixSeconds: Math.ceil(resetMs / 1000),
    allowed: bucket.count <= limit,
    retryAfterSeconds,
  };
}

/**
 * Attach the standard `X-RateLimit-*` headers to any NextResponse.
 * Mutates and returns the same response so it composes cleanly:
 *
 *   return applyRateLimitHeaders(NextResponse.json(body), auth.rateLimit);
 */
export function applyRateLimitHeaders<T extends NextResponse>(
  response: T,
  state: RateLimitState | undefined,
): T {
  if (!state) return response;
  response.headers.set("X-RateLimit-Limit", String(state.limit));
  response.headers.set("X-RateLimit-Remaining", String(state.remaining));
  response.headers.set("X-RateLimit-Reset", String(state.resetUnixSeconds));
  return response;
}

/**
 * Backwards-compatible helper: returns `null` when the request is
 * allowed, or a fully-formed 429 NextResponse when it is not. The
 * 429 body is the v1 `RateLimitProblem` shape and includes the
 * standard rate-limit headers plus `Retry-After`.
 */
export function rateLimit(
  bucketKey: string,
  opts: RateLimitOptions = {},
): NextResponse | null {
  const state = evaluateRateLimit(bucketKey, opts);
  if (state.allowed) return null;
  return buildRateLimitResponse(state);
}

/**
 * Build the canonical v1 429 `RateLimitProblem` response from a
 * `RateLimitState`. Exposed so middleware can construct the same
 * response when it wants to attach more headers (e.g. `WWW-Authenticate`).
 */
export function buildRateLimitResponse(state: RateLimitState): NextResponse {
  const response = NextResponse.json(
    {
      error: {
        code: "rate_limited",
        message: `Rate limit of ${state.limit} requests/min exceeded. Retry in ${state.retryAfterSeconds}s.`,
        retryAfterSeconds: state.retryAfterSeconds,
      },
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(state.retryAfterSeconds),
      },
    },
  );
  return applyRateLimitHeaders(response, state);
}
