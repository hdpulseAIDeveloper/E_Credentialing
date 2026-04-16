/**
 * Lightweight in-memory rate limiter for the public REST/FHIR API.
 *
 * Strategy: fixed-window (per-process). Acceptable for a single-replica
 * deployment; will be replaced by Redis-backed sliding window in P1
 * (observability/security hardening). Returns null on success, or a
 * ready-to-return NextResponse on rejection.
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

export function rateLimit(
  bucketKey: string,
  opts: RateLimitOptions = {}
): NextResponse | null {
  const limit = opts.limit ?? 60;
  const windowMs = opts.windowMs ?? 60_000;

  const now = Date.now();
  const bucket = buckets.get(bucketKey);

  if (!bucket || now - bucket.windowStartMs >= windowMs) {
    buckets.set(bucketKey, { windowStartMs: now, count: 1 });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.windowStartMs + windowMs - now) / 1000)
    );
    return NextResponse.json(
      {
        error: "Too Many Requests",
        retryAfterSeconds: retryAfterSec,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSec),
          "X-RateLimit-Limit": String(limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  return null;
}
