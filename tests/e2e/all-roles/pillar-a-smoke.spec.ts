/**
 * Pillar A — Smoke (per `docs/qa/STANDARD.md` §1.A)
 *
 * For every static route in the inventory:
 *   1. Navigate using the role's authenticated storageState.
 *   2. Wait for `domcontentloaded` AND for the page's main landmark to be
 *      visible (so we don't pass on a 200-but-blank shell).
 *   3. Listeners in `fixtures/errors.ts` hard-fail on:
 *        - any console.error (catches the DEF-0003 hydration warning)
 *        - any uncaught pageerror (catches DEF-0004 webpack factory error)
 *        - any first-party 5xx
 *
 * The spec auto-derives the per-role expected outcome:
 *   - 200 + main landmark        for routes the role is allowed to see
 *   - 3xx redirect to /dashboard for routes blocked by middleware (RBAC)
 *
 * The matrix lives in `tests/e2e/role-route-matrix.ts` so pillar B can
 * reuse the same source of truth.
 */

import inventory from "../../../docs/qa/inventories/route-inventory.json";
import { test, expect } from "../fixtures";
import { expectedAccessFor, type ExpectedAccess } from "../role-route-matrix";
import { ROLES, type RoleId } from "../roles";

interface RouteEntry {
  route: string;
  file: string;
  dynamic: boolean;
  group: string;
}

const ALL_ROUTES = inventory as RouteEntry[];

// Static routes only for pillar A — dynamic routes are exercised in pillar D
// with real fixture-resolved IDs (a generic [id] placeholder would 404 and
// pollute the smoke gate). Provider-portal routes under (provider) also need
// a token, handled in pillar D.
const STATIC_ROUTES = ALL_ROUTES.filter(
  (r) =>
    !r.dynamic &&
    !r.route.startsWith("/application") &&
    // /api routes aren't in route-inventory but be defensive.
    !r.route.startsWith("/api"),
);

function projectRole(): RoleId | null {
  const proj = test.info().project.name;
  if (!proj.startsWith("role-")) return null;
  return proj.slice(5) as RoleId;
}

for (const route of STATIC_ROUTES) {
  test(`pillar-A smoke: ${route.route}`, async ({ page, baseURL }) => {
    const role = projectRole();
    test.skip(role === null, "pillar-A runs in role projects only");

    const expected: ExpectedAccess = expectedAccessFor(route.route, role!);

    const responses: { status: number; url: string }[] = [];
    page.on("response", (r) => {
      if (r.url() === `${baseURL}${route.route}` || r.url().startsWith(`${baseURL}${route.route}?`)) {
        responses.push({ status: r.status(), url: r.url() });
      }
    });

    const resp = await page.goto(route.route, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    expect(resp, `goto returned no response for ${route.route}`).not.toBeNull();
    const status = resp!.status();

    if (expected === "allow") {
      expect(
        status,
        `expected 200 for ${route.route} as ${role}, got ${status}`,
      ).toBeLessThan(400);

      // Don't pass on a 200-blank-shell. Every staff page renders a <main>
      // and every public page renders an <h1> or <h2>. If neither exists
      // the page didn't actually mount — fail.
      const haveMain = await page.locator("main").first().isVisible().catch(() => false);
      const haveHeading = await page.locator("h1, h2").first().isVisible().catch(() => false);
      expect(
        haveMain || haveHeading,
        `${route.route} returned 200 but rendered no <main>/<h1>/<h2> — likely a hydration/render failure`,
      ).toBe(true);
    } else if (expected === "redirect-dashboard") {
      // After follow-redirects, the URL should be /dashboard or /auth/signin.
      const finalUrl = new URL(page.url());
      expect(
        finalUrl.pathname === "/dashboard" || finalUrl.pathname.startsWith("/auth/signin"),
        `expected ${route.route} as ${role} to redirect to /dashboard or /auth/signin, ended at ${finalUrl.pathname}`,
      ).toBe(true);
    } else if (expected === "redirect-signin") {
      const finalUrl = new URL(page.url());
      expect(
        finalUrl.pathname.startsWith("/auth/signin"),
        `expected ${route.route} as ${role} to redirect to /auth/signin, ended at ${finalUrl.pathname}`,
      ).toBe(true);
    }
  });
}

// Sanity guard so we never silently lose coverage. If the inventory has
// fewer than 30 static routes, something filtered too aggressively.
test("pillar-A smoke inventory sanity", () => {
  expect(
    STATIC_ROUTES.length,
    "static smoke route count dropped — check the inventory + filter",
  ).toBeGreaterThanOrEqual(30);
  expect(ROLES.length).toBe(5);
});
