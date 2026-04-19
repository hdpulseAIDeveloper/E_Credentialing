/**
 * Pillar A (anonymous public surfaces) — runtime gate for DEF-0007 and
 * DEF-0008.
 *
 * Until 2026-04-19 no Playwright project exercised anonymous reachability
 * of static public routes. The smoke / RBAC / a11y matrices all skip the
 * anonymous project (`test.skip(role === null, ...)`), and the anonymous
 * visual baselines follow redirects (so a public page that 307s to
 * `/auth/signin` quietly screenshots the wrong page). This is exactly how
 * Wave 21's `/errors` regression (DEF-0007) and the pre-existing
 * `/legal/*` / `/cvo` / `/sandbox` / `/pricing` / `/changelog` /
 * `/settings/*` drift (DEF-0008) made it past `npm run qa:gate`.
 *
 * What this spec does
 * -------------------
 *
 *   1. Imports `route-inventory.json` (the canonical source of truth for
 *      every Next.js route, including its `group`).
 *   2. Iterates over every entry where `group === "public"` AND
 *      `dynamic === false` AND the path doesn't live under
 *      `/api` or `/application` (those are token / Bearer surfaces, not
 *      browser-anonymous surfaces).
 *   3. Navigates to each route as an UNAUTHENTICATED browser and asserts
 *      the FINAL response is 200 — i.e. the route was not redirected to
 *      `/auth/signin`.
 *   4. Asserts the page rendered SOMETHING (visible `<main>` / `<h1>` /
 *      `<h2>`) so a 200-blank-shell still fails.
 *   5. Spot-checks one `/errors/<code>` URL in BOTH casings (kebab + snake)
 *      because the dynamic-filter excludes `/errors/[code]` from the
 *      iterator but the contract (Wave 21 ADR 0027) requires both forms
 *      resolve.
 *   6. Plus a sanity guard so the public-route count never silently drops
 *      below 8 (current count is 16 in the inventory; 8 is a safe floor
 *      that catches accidental filter-tightening).
 *
 * What this spec is NOT
 * ---------------------
 *
 *   - It does NOT cover authenticated public-route reachability — that's
 *     pillar A's role projects. The two coexist; this spec is the
 *     anonymous companion.
 *   - It does NOT screenshot. Visual baselines for these pages are pillar
 *     F's job (currently un-baselined — see `tests/e2e/visual/`).
 *
 * Anti-weakening (STANDARD.md §4.2)
 * ---------------------------------
 *
 *   - The 200-status assertion is a strict equality (`expect(status).toBe
 *     (200)`) — DO NOT relax to `< 400` (a 307 would silently pass).
 *   - The `<main>/<h1>/<h2>` rendered-content check MUST stay; it is the
 *     hedge against a 200 that returned an empty document (see DEF-0003 /
 *     DEF-0004 from `STANDARD.md` §10).
 *   - The route-list iterator MUST stay backed by `route-inventory.json`
 *     (not a hard-coded literal) so that adding a public route in the
 *     App Router automatically extends coverage on the next
 *     `npm run qa:inventory` regen.
 */
import inventory from "../../../docs/qa/inventories/route-inventory.json";
import { test, expect } from "../fixtures";

interface RouteEntry {
  route: string;
  group: string;
  dynamic: boolean;
  file: string;
}

const ALL_ROUTES = inventory as RouteEntry[];

// `group: public` AND not dynamic AND not an API/token surface.
//   - `/api/*`        — Bearer-key auth required by design
//   - `/application*` — provider token in URL, not browser-anonymous
//   - `/verify/*`     — token in URL (handled by pillar D, not relevant
//                       to the public-allow-list contract this spec exists
//                       to enforce)
const PUBLIC_BROWSER_ROUTES: RouteEntry[] = ALL_ROUTES.filter(
  (r) =>
    r.group === "public" &&
    !r.dynamic &&
    !r.route.startsWith("/api") &&
    !r.route.startsWith("/application") &&
    !r.route.startsWith("/verify/"),
);

test.describe("pillar-A anonymous public-surface smoke (DEF-0007 / DEF-0008 gate)", () => {
  // anonymous-only spec — skipped under role-* projects (those have their
  // own authenticated session). The Playwright project is queryable via
  // `test.info().project.name` so the skip is per-test rather than per
  // describe (test.skip in describe scope only takes a boolean / title).
  test.beforeEach(() => {
    const projectName = test.info().project.name;
    test.skip(
      projectName !== "anonymous",
      `anonymous-only spec — current project is "${projectName}"`,
    );
  });

  for (const route of PUBLIC_BROWSER_ROUTES) {
    test(`anonymous GET ${route.route} renders 200 + visible content (group=public)`, async ({
      page,
      baseURL,
    }) => {
      const responses: { url: string; status: number }[] = [];
      page.on("response", (r) => {
        const u = r.url();
        if (
          u === `${baseURL}${route.route}` ||
          u.startsWith(`${baseURL}${route.route}?`)
        ) {
          responses.push({ url: u, status: r.status() });
        }
      });

      const resp = await page.goto(route.route, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(resp, `goto returned no response for ${route.route}`).not.toBeNull();

      // The KEY assertion that DEF-0007 was missing: the response Playwright
      // hands back is the FIRST response for the URL (before any redirect).
      // We don't allow a 307 here even if it eventually lands on a 200 —
      // that's the failure shape DEF-0007 captured: 307 → /auth/signin.
      const firstStatus = responses[0]?.status ?? resp!.status();
      expect(
        firstStatus,
        `expected 200 from anonymous GET ${route.route} (group=public per route-inventory.json), got ${firstStatus}. Status chain: ${responses.map((r) => r.status).join(" → ")}. This is the DEF-0007 / DEF-0008 failure shape: middleware silently redirected a route the route-inventory marks as public. Add the route to the public allow-list in src/middleware.ts (see DEF-0007 for the exact diff shape) — DO NOT relax this assertion.`,
      ).toBe(200);

      // Confirm the URL actually rendered (no 200-blank-shell). We accept
      // any of <main>, [role="main"], <h1>, <h2> — the universal "this
      // page mounted" anchors used by every public template.
      const haveMain = await page
        .locator("main, [role='main']")
        .first()
        .isVisible()
        .catch(() => false);
      const haveHeading = await page
        .locator("h1, h2")
        .first()
        .isVisible()
        .catch(() => false);
      expect(
        haveMain || haveHeading,
        `${route.route} returned 200 but rendered no <main>/<h1>/<h2> — likely a hydration/render failure (DEF-0003 / DEF-0004 shape)`,
      ).toBe(true);
    });
  }

  // Wave 21 dynamic detail page — both URL casings MUST resolve anonymously.
  // Excluded from the iterator above because route-inventory.json marks
  // /errors/[code] as `dynamic: true`. The contract (per-screen card +
  // ADR 0027) requires BOTH forms work, so spot-check both explicitly.
  for (const code of ["insufficient-scope", "insufficient_scope"]) {
    test(`anonymous GET /errors/${code} renders 200 (DEF-0007 dynamic detail)`, async ({
      page,
      baseURL,
    }) => {
      const responses: { url: string; status: number }[] = [];
      page.on("response", (r) => {
        const u = r.url();
        if (u === `${baseURL}/errors/${code}`) {
          responses.push({ url: u, status: r.status() });
        }
      });

      const resp = await page.goto(`/errors/${code}`, {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });
      expect(resp, `goto returned no response for /errors/${code}`).not.toBeNull();

      const firstStatus = responses[0]?.status ?? resp!.status();
      expect(
        firstStatus,
        `expected 200 from anonymous GET /errors/${code} (every Problem body's type URI MUST resolve in a browser per RFC 9457 §3.1.1 — see DEF-0007). Got ${firstStatus}.`,
      ).toBe(200);

      // The detail page renders the catalog row's title in an <h1>, so
      // confirm it actually mounted. "Insufficient Scope" is the title for
      // both casings (catalog row is the same).
      await expect(page.locator("h1").first()).toBeVisible({ timeout: 10_000 });
    });
  }

  // Floor sanity guard — if the inventory's public-route count drops below
  // a known floor, something filtered too aggressively. Today (2026-04-19)
  // there are 16 public-browser entries; 8 is a safe floor that catches
  // accidental over-filtering without being so strict it fails on every
  // intentional retirement.
  test("public-browser route count never silently drops (sanity)", () => {
    expect(
      PUBLIC_BROWSER_ROUTES.length,
      `Public-browser route count fell below the 8-route floor — check the filter in this spec OR the route-inventory regen. Current routes: ${PUBLIC_BROWSER_ROUTES.map((r) => r.route).join(", ")}`,
    ).toBeGreaterThanOrEqual(8);

    // Wave 21 specifically: /errors MUST be in the public-browser set.
    // If this fails, someone removed /errors from route-inventory.json or
    // demoted its `group` — either way that's a §4.10 hard-fail (orphaned
    // contract).
    const hasErrors = PUBLIC_BROWSER_ROUTES.some((r) => r.route === "/errors");
    expect(
      hasErrors,
      "/errors must be present in the public-browser route set (Wave 21 ADR 0027 contract)",
    ).toBe(true);
  });
});
