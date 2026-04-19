/**
 * Single source of truth for which routes are publicly accessible
 * (no Auth.js session, no provider invite token, no API key).
 *
 * BOTH `src/middleware.ts` AND `scripts/qa/build-route-inventory.ts`
 * MUST derive their public-route classification from THIS file.
 *
 * Why this file exists (closes DEF-0008 + DEF-0011):
 *
 *   - DEF-0008 (2026-04-19): the middleware allow-list lagged
 *     `route-inventory.json`'s `group:public` set, so legitimate
 *     public marketing pages (`/cvo`, `/pricing`, `/changelog`,
 *     `/legal/*`, `/sandbox`) returned 307 → `/auth/signin` for
 *     anonymous customers.
 *   - DEF-0011 (2026-04-19): the inventory classifier defaulted any
 *     page outside an explicit `(group)/` segment to `group:public`,
 *     so `/settings/billing` and `/settings/compliance` (which the
 *     middleware correctly redirects to signin) were declared
 *     publicly-accessible in the inventory. Per-screen cards then
 *     inherited the wrong access posture.
 *
 * The two defects are the SAME structural bug seen from opposite
 * sides — middleware and inventory disagreeing about which routes
 * are public, with no shared source of truth. This file is the
 * shared source of truth. Adding/removing any entry below changes
 * BOTH consumers in lock-step at the next commit; drift is no
 * longer possible.
 *
 * Anti-weakening (per ADR 0028 §Anti-weakening; STANDARD.md §4.2):
 *
 *   - Adding a path here makes it accessible WITHOUT auth — review
 *     carefully against the per-screen card and the data-flow doc
 *     before merging.
 *   - Removing a path here breaks customer-facing surfaces — file a
 *     defect card BEFORE the change.
 *   - Hand-maintained duplicates of this list anywhere else
 *     (re-introducing inline `pathname.startsWith("/legal/")` checks
 *     in `src/middleware.ts`, hard-coding "public" in the route
 *     inventory builder, etc.) are §4.2 violations and grounds for
 *     revert.
 *
 * Cross-references:
 *   - `src/middleware.ts` — sole runtime consumer (Edge runtime).
 *   - `scripts/qa/build-route-inventory.ts` — sole inventory consumer.
 *   - `docs/qa/inventories/route-inventory.json` — derived output.
 *   - `docs/qa/STANDARD.md` §2.S — Pillar S enforces that runtime
 *     and inventory agree.
 *   - `docs/qa/defects/DEF-0008.md`, `docs/qa/defects/DEF-0011.md`
 *     — the regressions this file closes.
 */

/**
 * Path PREFIXES that are public. A request whose `pathname` starts
 * with any entry here bypasses the staff-session check.
 *
 * Order does not matter. Entries MUST be ordered alphabetically for
 * easy review.
 */
export const PUBLIC_PATH_PREFIXES: readonly string[] = [
  "/api/application/", // provider portal pre-auth (token-validated in the page)
  "/api/attestation", // provider attestation submit (token-validated)
  "/api/auth/", // Auth.js v5 surface (CSRF, callback, session, signin, signout)
  "/api/fhir/", // CMS-0057-F FHIR R4 public Provider Directory
  "/api/health", // liveness + dependency probe
  "/api/live", // k8s liveness
  "/api/metrics", // Prometheus scrape (token-gated upstream by METRICS_BEARER_TOKEN)
  "/api/ready", // k8s readiness
  "/api/v1/", // public REST v1 (API-key gated upstream, but middleware is open)
  "/api/webhooks/", // SendGrid / Twilio / Stripe inbound (signature-verified per route)
  "/auth/", // /auth/signin, /auth/register, /auth/error, etc.
  "/errors/", // public Error Catalog HTML detail pages (Wave 21, RFC 9457 type URI resolution)
  "/legal/", // /legal/privacy, /legal/terms, /legal/hipaa, /legal/cookies
  "/verify/", // anonymous credentials-verification widget (FHIR-driven)
] as const;

/**
 * EXACT paths that are public. A request whose `pathname` matches
 * any entry here bypasses the staff-session check. Used for paths
 * that are leaf pages, not folders (so a prefix match would be
 * over-broad).
 *
 * Order: alphabetical.
 */
export const PUBLIC_EXACT_PATHS: readonly string[] = [
  "/", // marketing landing
  "/changelog", // public changelog index
  "/changelog.rss", // changelog feed
  "/cvo", // CVO product explainer
  "/errors", // public Error Catalog index (the leaf; detail pages match the prefix above)
  "/pricing", // pricing tiers
  "/sandbox", // public API sandbox (read-only synthetic data)
] as const;

/**
 * The provider portal lives under `/application/*` and is gated by
 * a single-active JWT magic-link token validated INSIDE the page,
 * not by a session cookie. The middleware lets these requests
 * through but does NOT classify them as `public` — they are a
 * separate `provider` group in the inventory.
 *
 * Listed here so the middleware has one place to look for "let
 * through without a session" decisions.
 */
export const PROVIDER_PORTAL_PREFIX = "/application" as const;

/**
 * True when `pathname` corresponds to a publicly-accessible route
 * (no Auth.js session required, no provider token required). Used
 * by `src/middleware.ts` and by the inventory classifier.
 *
 * Notes:
 *   - Comparison is case-sensitive (Next.js routes are case-sensitive
 *     on Linux containers; matching the runtime exactly is the safe
 *     default).
 *   - Trailing slash on `pathname` is rejected; Next.js normalises
 *     trailing slashes upstream.
 */
export function isPublicRoute(pathname: string): boolean {
  if (PUBLIC_EXACT_PATHS.includes(pathname)) return true;
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (pathname.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * True when `pathname` is the provider portal (token-validated in
 * the page; middleware lets it through without a session).
 */
export function isProviderPortalRoute(pathname: string): boolean {
  return (
    pathname === PROVIDER_PORTAL_PREFIX ||
    pathname.startsWith(`${PROVIDER_PORTAL_PREFIX}/`)
  );
}
