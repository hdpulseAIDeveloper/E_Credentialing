/**
 * Next.js middleware — protects all staff routes.
 * Unauthenticated requests are redirected to the sign-in page.
 * Provider routes (/application/*) use a separate token-based auth.
 *
 * Also emits one structured JSON access-log line per request so log
 * aggregators (Datadog, Loki) get parseable HTTP telemetry without us having
 * to swap out Next.js's framework logger. The line is shaped like pino so
 * downstream pipelines treat it identically to app-level logs.
 *
 * Disable per-request access logs by setting LOG_HTTP=false. They are on by
 * default in production and off by default in development to keep dev-server
 * stdout readable.
 */

import { authMiddleware } from "@/server/auth.edge";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const HTTP_LOG_ENABLED = (() => {
  const v = (process.env.LOG_HTTP ?? "").toLowerCase();
  if (v === "false" || v === "0" || v === "off") return false;
  // Default: ON. Operators opt out explicitly with LOG_HTTP=false.
  return true;
})();

function logAccess(
  req: NextRequest,
  status: number,
  startedAtMs: number,
  reqId: string,
): void {
  if (!HTTP_LOG_ENABLED) return;
  // Edge runtime: console.log writes to stdout, which docker captures. We emit
  // a pino-shaped line so it matches everything else from src/lib/logger.ts.
  const line = {
    level: 30, // pino "info"
    time: Date.now(),
    service: "ecred",
    env: process.env.NODE_ENV ?? "development",
    msg: "http",
    method: req.method,
    path: req.nextUrl.pathname,
    status,
    durationMs: Date.now() - startedAtMs,
    reqId,
    ua: req.headers.get("user-agent") ?? undefined,
  };
  // Single JSON object per line — never crash the request on a serialization bug.
  try {
    console.log(JSON.stringify(line));
  } catch {
    /* swallow */
  }
}

function makeReqId(): string {
  // Edge runtime exposes Web Crypto. Fall back to Math.random for tests/jsdom.
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2, 14);
  }
}

export default authMiddleware((req) => {
  const startedAt = Date.now();
  const reqId = req.headers.get("x-request-id") ?? makeReqId();
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public routes
  if (
    pathname === "/" ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/live") ||
    pathname.startsWith("/api/ready") ||
    pathname.startsWith("/api/metrics") ||
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/fhir/") ||
    pathname.startsWith("/api/application/") ||
    pathname.startsWith("/api/attestation") ||
    pathname.startsWith("/verify/")
  ) {
    const res = NextResponse.next();
    res.headers.set("x-request-id", reqId);
    logAccess(req, 200, startedAt, reqId);
    return res;
  }

  // Provider application routes — handled by token validation in the page
  if (pathname.startsWith("/application") || pathname === "/application") {
    const res = NextResponse.next();
    res.headers.set("x-request-id", reqId);
    logAccess(req, 200, startedAt, reqId);
    return res;
  }

  // Staff routes — require Azure AD SSO session
  if (!session?.user) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    const res = NextResponse.redirect(signInUrl);
    res.headers.set("x-request-id", reqId);
    logAccess(req, 307, startedAt, reqId);
    return res;
  }

  // Role check for admin routes (match both /admin and /admin/*)
  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      const res = NextResponse.redirect(new URL("/dashboard", req.url));
      res.headers.set("x-request-id", reqId);
      logAccess(req, 307, startedAt, reqId);
      return res;
    }
  }

  // Committee routes — restrict to ADMIN, MANAGER, COMMITTEE_MEMBER
  if (pathname === "/committee" || pathname.startsWith("/committee/")) {
    if (!["ADMIN", "MANAGER", "COMMITTEE_MEMBER"].includes(session.user.role as string)) {
      const res = NextResponse.redirect(new URL("/dashboard", req.url));
      res.headers.set("x-request-id", reqId);
      logAccess(req, 307, startedAt, reqId);
      return res;
    }
  }

  const res = NextResponse.next();
  res.headers.set("x-request-id", reqId);
  logAccess(req, 200, startedAt, reqId);
  return res;
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
  ],
};
