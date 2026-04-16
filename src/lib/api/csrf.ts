/**
 * CSRF protection for session-authenticated state-changing requests.
 *
 * tRPC over fetch uses a custom content-type and POST body, so it is not
 * automatically vulnerable the way HTML form endpoints are. However, any
 * non-tRPC mutation endpoints reached by browsers (e.g., /api/upload,
 * /api/application/save-section, /api/attestation) need CSRF defenses.
 *
 * This module implements the double-submit cookie pattern:
 *
 *   1. On any authenticated request, the server sets `csrf-token` as a
 *      non-httpOnly, SameSite=Strict cookie.
 *   2. State-changing requests MUST include an `x-csrf-token` header
 *      whose value equals the cookie. The server rejects the request if
 *      they differ.
 *
 * Public API (Bearer-token) requests are exempt — they are not sent by
 * browsers with cookies and are already protected by the key + scope.
 * Provider-invite-token requests are also exempt because the token is
 * sent explicitly, not via cookie.
 */

import { randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const CSRF_COOKIE = "csrf-token";
const CSRF_HEADER = "x-csrf-token";
const CSRF_LENGTH = 32; // 256-bit random token

export function generateCsrfToken(): string {
  return randomBytes(CSRF_LENGTH).toString("hex");
}

/**
 * Attach a CSRF cookie to the response if the caller does not already
 * have one. Safe to call on every request.
 */
export function ensureCsrfCookie(request: NextRequest, response: NextResponse): void {
  const existing = request.cookies.get(CSRF_COOKIE)?.value;
  if (existing && existing.length === CSRF_LENGTH * 2) return;
  const token = generateCsrfToken();
  response.cookies.set({
    name: CSRF_COOKIE,
    value: token,
    httpOnly: false,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
}

/**
 * Verify the double-submit CSRF token. Returns a 403 response if the
 * token is missing or mismatched; returns null when valid.
 *
 * Use on any non-tRPC, session-authenticated POST/PATCH/DELETE endpoint.
 */
export function verifyCsrf(request: Request): NextResponse | null {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const cookieMatch = cookieHeader.match(new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]+)`));
  const cookieToken = cookieMatch?.[1];
  const headerToken = request.headers.get(CSRF_HEADER);

  if (!cookieToken || !headerToken) {
    return NextResponse.json(
      { error: "csrf_missing", message: "CSRF token missing" },
      { status: 403 },
    );
  }

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json(
      { error: "csrf_mismatch", message: "CSRF token mismatch" },
      { status: 403 },
    );
  }

  return null;
}

export const CSRF_COOKIE_NAME = CSRF_COOKIE;
export const CSRF_HEADER_NAME = CSRF_HEADER;
