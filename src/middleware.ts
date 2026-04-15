/**
 * Next.js middleware — protects all staff routes.
 * Unauthenticated requests are redirected to the sign-in page.
 * Provider routes (/application/*) use a separate token-based auth.
 */

import { auth } from "@/server/auth";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow public routes
  if (
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/webhooks/") ||
    pathname.startsWith("/api/health")
  ) {
    return NextResponse.next();
  }

  // Provider application routes — handled by token validation in the page
  if (pathname.startsWith("/application/") || pathname.startsWith("/(provider)/")) {
    return NextResponse.next();
  }

  // Staff routes — require Azure AD SSO session
  if (!session?.user) {
    const signInUrl = new URL("/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }

  // Role check for admin routes
  if (pathname.startsWith("/admin/") || pathname.startsWith("/(staff)/admin/")) {
    if (session.user.role !== "ADMIN" && session.user.role !== "MANAGER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
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
