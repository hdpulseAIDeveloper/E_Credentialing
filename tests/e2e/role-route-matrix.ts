/**
 * Role × Route access matrix — encodes the middleware + page-level
 * authorisation rules from `src/middleware.ts` and the per-page guards.
 *
 * This is the source of truth for pillar B (RBAC) and the per-role expected
 * access in pillar A (smoke). Adding a new route REQUIRES updating this map
 * (the coverage gate will fail otherwise).
 *
 * Per `docs/qa/STANDARD.md` §1.B, the matrix is exercised in two directions:
 *   1. allowed cells → page must mount cleanly
 *   2. denied cells  → middleware must redirect to /dashboard or /auth/signin
 *      (NEVER allow a 200 to a denied role — that's the hard-fail)
 */

import type { RoleId } from "./roles";

export type ExpectedAccess = "allow" | "redirect-dashboard" | "redirect-signin";

/**
 * Returns the expected access outcome for a given route + role per the
 * middleware in `src/middleware.ts`.
 *
 *   - Public routes (/, /auth/*, /verify/*, /legal/*) — every role allowed,
 *     even anonymous (anonymous project doesn't run pillar A but pillar B
 *     does — we still encode it here).
 *   - /admin/* — ADMIN, MANAGER only
 *   - /committee/* — ADMIN, MANAGER, COMMITTEE_MEMBER
 *   - everything else (staff routes) — every authenticated staff role.
 *   - PROVIDER role only sees /application/* (handled in pillar D, not A).
 */
export function expectedAccessFor(route: string, role: RoleId): ExpectedAccess {
  // Public routes — everyone allowed.
  if (
    route === "/" ||
    route.startsWith("/auth/") ||
    route.startsWith("/legal/") ||
    route.startsWith("/verify/")
  ) {
    return "allow";
  }

  // Provider role only sees the application portal; everything else is a
  // redirect-to-signin (the middleware kicks them since they have no staff
  // session). For pillar A we filter /application out, so this branch
  // resolves all non-application routes for PROVIDER -> redirect-signin.
  if (role === "provider") {
    if (route.startsWith("/application")) return "allow";
    return "redirect-signin";
  }

  // /admin/* — ADMIN, MANAGER only. Others get redirect to /dashboard.
  if (route === "/admin" || route.startsWith("/admin/")) {
    if (role === "admin" || role === "manager") return "allow";
    return "redirect-dashboard";
  }

  // /committee/* — ADMIN, MANAGER, COMMITTEE_MEMBER only.
  if (route === "/committee" || route.startsWith("/committee/")) {
    if (role === "admin" || role === "manager" || role === "committee_member")
      return "allow";
    return "redirect-dashboard";
  }

  // Everything else — every staff role allowed.
  return "allow";
}
