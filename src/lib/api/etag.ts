/**
 * ETag + If-None-Match conditional GET helper for the public REST/FHIR API.
 *
 * Wave 17 (2026-04-18). Every read-only `/api/v1/*` endpoint emits an
 * `ETag` response header derived from a stable hash of the response
 * body. Customers can echo it back on the next poll as
 * `If-None-Match: "<etag>"`; if the body would be byte-identical the
 * server replies `304 Not Modified` (zero JSON body, ~80 bytes total)
 * instead of re-serializing the full payload.
 *
 * Why weak ETags (`W/"…"`):
 *
 *   We compute the hash over a *canonicalized* JSON payload (stable
 *   key ordering, no whitespace), so two responses with the same
 *   semantic content but different timestamps in `meta` blocks would
 *   still hash identically. That semantic-equivalence rather than
 *   byte-identity is exactly what RFC 9110 §8.8.1 calls a weak
 *   validator. Strong validators (no `W/` prefix) require byte-for-byte
 *   identity which is a stronger guarantee than this code makes.
 *
 * Why SHA-1 (not SHA-256):
 *
 *   ETags are *integrity tokens*, not security tokens — collisions on
 *   the cache layer cause stale reads, never security violations. SHA-1
 *   is ~3× faster, produces 40-hex output (compact for log lines), and
 *   is what GitHub, Stripe, AWS S3 (for non-multipart objects), and
 *   nginx default to. The 80-bit collision space is far beyond any
 *   realistic per-key cache lifetime.
 *
 * Anti-weakening (do not regress without bumping `info.version`):
 *
 *   1. Header name MUST stay `ETag` (RFC 9110 — case-sensitive in
 *      JSON serialization but the on-the-wire HTTP header field name
 *      is case-insensitive; we emit the canonical capitalisation).
 *   2. The format MUST stay weak quoted (`W/"<hex>"`). Stripping the
 *      `W/` prefix would change the validator strength and break
 *      RFC-compliant caches that distinguish weak vs strong.
 *   3. `If-None-Match: *` MUST be honoured (matches any current ETag
 *      → 304); RFC 9110 §13.1.2 makes this mandatory for
 *      conditional GETs.
 *   4. The 304 response MUST include `ETag`, `X-Request-Id`, and
 *      (where applicable) the rate-limit headers — clients rely on
 *      seeing the validator + correlation id even when the body is
 *      empty.
 *   5. The 304 response body MUST be empty (0 bytes). RFC 9110
 *      §15.4.5 makes this a hard requirement.
 */

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
  applyRateLimitHeaders,
  type RateLimitState,
} from "./rate-limit";
import { applyRequestIdHeader } from "./request-id";

const HEADER = "ETag";
const IF_NONE_MATCH_HEADER = "If-None-Match";

/**
 * Recursively canonicalize a JSON-serializable value:
 *
 *  - Objects: keys sorted lexicographically, values canonicalized.
 *  - Arrays: order preserved (semantic; `[1, 2]` !== `[2, 1]`).
 *  - Primitives: passed through.
 *  - `undefined` values inside objects are dropped (matching
 *    `JSON.stringify` semantics — they wouldn't appear on the wire).
 */
function canonicalize(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(canonicalize);
  const obj = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    const v = obj[key];
    if (v === undefined) continue;
    out[key] = canonicalize(v);
  }
  return out;
}

/**
 * Compute a weak ETag for a JSON-serializable payload.
 *
 * Output format: `W/"<40-hex-chars>"` (RFC 9110 §8.8.3 weak validator).
 *
 * Pure function — same input ALWAYS produces the same output, with
 * no dependency on iteration order, system clock, or process id.
 */
export function computeWeakEtag(payload: unknown): string {
  const canonical = JSON.stringify(canonicalize(payload));
  const hex = createHash("sha1").update(canonical).digest("hex");
  return `W/"${hex}"`;
}

/**
 * Compute a weak ETag from a raw string or Buffer payload (used for
 * spec-delivery routes that ship YAML / pre-rendered JSON / Postman
 * blobs — no canonicalization needed because the wire bytes ARE the
 * canonical representation).
 */
export function computeWeakEtagFromBytes(bytes: string | Buffer): string {
  const hex = createHash("sha1").update(bytes).digest("hex");
  return `W/"${hex}"`;
}

/**
 * Parse an `If-None-Match` header value into the list of ETags it
 * carries. Handles the comma-separated multi-value form per RFC 9110
 * §13.1.2:
 *
 *     If-None-Match: "etag-a", W/"etag-b", "etag-c"
 *     If-None-Match: *
 *
 * Returns:
 *   - `["*"]` for the wildcard form.
 *   - An array of ETag tokens (each still in its quoted weak/strong
 *     form, e.g. `W/"abc"` or `"abc"`) otherwise.
 *   - `[]` for null / empty / malformed input.
 *
 * Whitespace around commas is tolerated.
 */
export function parseIfNoneMatch(header: string | null | undefined): string[] {
  if (!header) return [];
  const trimmed = header.trim();
  if (trimmed === "*") return ["*"];
  // Match either W/"..." (weak) or "..." (strong) tokens; skip junk.
  const matches = trimmed.match(/(?:W\/)?"[^"]*"/g);
  return matches ?? [];
}

/**
 * Strip the `W/` prefix (if present) and the surrounding quotes from
 * an ETag token, returning the raw opaque tag value. Used for "weak
 * comparison" per RFC 9110 §8.8.3.2 — for `If-None-Match` the spec
 * mandates weak comparison, which means `W/"abc"` and `"abc"` are
 * considered equivalent.
 */
function rawTag(token: string): string {
  let t = token;
  if (t.startsWith("W/")) t = t.slice(2);
  if (t.startsWith('"') && t.endsWith('"')) t = t.slice(1, -1);
  return t;
}

/**
 * Decide whether the inbound `If-None-Match` header matches the
 * current ETag using *weak* comparison (RFC 9110 §13.1.2).
 *
 *   - `*` always matches (RFC mandates this for any current resource).
 *   - Otherwise: any token whose raw tag value matches the current
 *     ETag's raw tag value is a hit, regardless of weak/strong prefix.
 *
 * Returns true when the cache is fresh and the server SHOULD reply 304.
 */
export function matchesEtag(
  currentEtag: string,
  ifNoneMatchTokens: readonly string[],
): boolean {
  if (ifNoneMatchTokens.length === 0) return false;
  if (ifNoneMatchTokens.includes("*")) return true;
  const current = rawTag(currentEtag);
  for (const token of ifNoneMatchTokens) {
    if (rawTag(token) === current) return true;
  }
  return false;
}

/**
 * Attach the `ETag` header to any `NextResponse`. No-op when `etag`
 * is empty — defensive against routes that compute the tag lazily.
 */
export function applyEtagHeader<T extends NextResponse>(
  response: T,
  etag: string | undefined,
): T {
  if (!etag) return response;
  response.headers.set(HEADER, etag);
  return response;
}

/**
 * Build a fully-formed `304 Not Modified` response.
 *
 * Per RFC 9110 §15.4.5 the body MUST be empty and the response MUST
 * carry the `ETag` of the current representation. We additionally
 * propagate `X-Request-Id` (always — every v1 response carries it)
 * and the rate-limit snapshot (when supplied) so cached requests
 * still count against the customer's budget visibly.
 */
export function notModifiedResponse(
  etag: string,
  options: { requestId?: string; rateLimit?: RateLimitState } = {},
): NextResponse {
  // NextResponse rejects a body for 304, so we use the explicit null
  // body constructor.
  const response = new NextResponse(null, { status: 304 });
  applyEtagHeader(response, etag);
  if (options.requestId) applyRequestIdHeader(response, options.requestId);
  if (options.rateLimit) applyRateLimitHeaders(response, options.rateLimit);
  return response;
}

/**
 * Convenience wrapper that combines compute + match + reply for the
 * common "JSON body" case. Returns either:
 *
 *   - `{ status: "not-modified", response: NextResponse }` — caller
 *     can return the response directly.
 *   - `{ status: "fresh", etag: string }` — caller must build a 200
 *     response and call `applyEtagHeader(response, etag)`.
 */
export function evaluateConditionalGet(
  request: Request,
  payload: unknown,
): { status: "not-modified"; etag: string } | { status: "fresh"; etag: string } {
  const etag = computeWeakEtag(payload);
  const tokens = parseIfNoneMatch(request.headers.get(IF_NONE_MATCH_HEADER));
  if (matchesEtag(etag, tokens)) return { status: "not-modified", etag };
  return { status: "fresh", etag };
}

/** Header-name constants exported for contract tests + middleware. */
export const ETAG_HEADER = HEADER;
export const IF_NONE_MATCH_HEADER_NAME = IF_NONE_MATCH_HEADER;
