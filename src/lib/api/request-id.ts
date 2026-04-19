/**
 * X-Request-Id correlation helper for the public REST/FHIR API.
 *
 * Wave 14 (2026-04-18). Every `/api/v1/*` and `/api/fhir/*` request
 * carries a request id, surfaced as the `X-Request-Id` response
 * header. The id is the customer's anchor when contacting support
 * — they paste it into a ticket, we look it up in the audit log
 * and Pino structured logs, done.
 *
 * Behaviour:
 *
 *   1. If the inbound request supplies a valid `X-Request-Id`
 *      header, we honour it (lets customers join their client-side
 *      log lines to ours).
 *   2. Otherwise we generate one server-side. Format: `req_<hex>`
 *      (16 hex characters of cryptographic randomness — 64 bits;
 *      Birthday-paradox-safe up to ~5 billion ids).
 *   3. Inbound ids are validated against `^[A-Za-z0-9_\-]{8,128}$`
 *      to keep them safe to log, embed in URLs, and reflect into
 *      response headers without escaping. Anything that doesn't
 *      match is silently replaced with a fresh server-generated
 *      id (we do NOT 400 on a malformed inbound id — that would
 *      be customer-hostile).
 *   4. The same id is attached to:
 *        - the `X-Request-Id` response header
 *        - the audit log row (`afterState.requestId`)
 *        - the Pino log line for the request (`requestId` field)
 *
 * Anti-weakening (do not regress without bumping `info.version`):
 *
 *   1. Header name MUST stay `X-Request-Id` (industry convention;
 *      Stripe, Twilio, GitHub all use this exact spelling).
 *   2. Server-generated ids MUST stay opaque-looking — never embed
 *      a tenant id, customer id, or PHI fragment.
 *   3. The validation regex MUST stay strict; relaxing it allows
 *      log-injection attacks.
 *   4. The id MUST be present on every successful response and
 *      every error response, including 401 / 403 / 404 / 429 / 500.
 */

import { randomBytes } from "node:crypto";
import type { NextResponse } from "next/server";

const HEADER = "X-Request-Id";

/**
 * Strict format gate for inbound `X-Request-Id` values.
 *
 * - Hex / dashes / underscores / mixed case only — covers ULID
 *   (`01F8MECHZX3TBDSZ7XR8H8JHAF`), UUIDv4
 *   (`550e8400-e29b-41d4-a716-446655440000`), Stripe-style
 *   (`req_abcdef`), and free-form opaque tokens.
 * - 8–128 chars: long enough to mean something, short enough to
 *   keep log lines tidy.
 */
const VALID_INBOUND = /^[A-Za-z0-9_\-]{8,128}$/;

/** Generate a fresh `req_<hex>` id (default 16 hex chars = 64 bits). */
export function generateRequestId(): string {
  return `req_${randomBytes(8).toString("hex")}`;
}

/**
 * Resolve the request id for an incoming request.
 *
 * - Honours a valid inbound `X-Request-Id` header.
 * - Falls back to a freshly-generated id otherwise.
 *
 * Returns the id as an opaque string; callers stamp it onto the
 * response, the audit log, and any Pino log line they emit.
 */
export function resolveRequestId(request: Request): string {
  const inbound = request.headers.get(HEADER);
  if (inbound && VALID_INBOUND.test(inbound)) return inbound;
  return generateRequestId();
}

/**
 * Attach the `X-Request-Id` header to any NextResponse. Mutates and
 * returns the same response so it composes cleanly:
 *
 *   return applyRequestIdHeader(NextResponse.json(body), requestId);
 *
 * No-op when `requestId` is falsy — defensive against early
 * code paths that haven't computed an id yet.
 */
export function applyRequestIdHeader<T extends NextResponse>(
  response: T,
  requestId: string | undefined,
): T {
  if (!requestId) return response;
  response.headers.set(HEADER, requestId);
  return response;
}

/**
 * Header name constant — exposed so contract tests + middleware
 * can refer to it without re-typing the literal.
 */
export const REQUEST_ID_HEADER = HEADER;

/** Predicate exposed so unit tests can assert generated id shape. */
export function isValidRequestId(id: string): boolean {
  return VALID_INBOUND.test(id);
}
