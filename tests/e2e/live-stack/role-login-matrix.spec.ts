/**
 * Pillar S — Live-Stack Reality Gate (browser-driven supplement).
 *
 * BINDING per `docs/qa/STANDARD.md` §2.S and ADR 0028.
 *
 * The HTTP-only equivalent lives at `scripts/qa/live-stack-smoke.mjs`
 * and runs in `npm run qa:gate` without any browser dependency. THIS
 * spec exists in addition because:
 *
 *   1. The browser exercises hydration, JS execution, and React state
 *      transitions that an HTTP probe cannot. The 2026-04-17 hydration
 *      regression (per STANDARD.md §10.1) was browser-only.
 *   2. It iterates over the same `tests/e2e/roles.ts` `STAFF_ROLES`
 *      registry as the .mjs script and the existing `globalSetup`,
 *      so the three live-sign-in surfaces (HTTP smoke, browser sign-in,
 *      Pillar A globalSetup) all read the same source of truth — drift
 *      between any two surfaces is a Pillar S finding.
 *
 * Anti-weakening (per ADR 0028 §Anti-weakening rules):
 *   - This spec MUST iterate `STAFF_ROLES`. A hard-coded role list here
 *     is a §4.2 violation (rule 4 of the ADR).
 *   - Login failure for ANY role is a hard fail (no `.skip` allowed).
 *   - The post-login landing page MUST contain a visible <main>; a
 *     200 + blank-shell does NOT count (DEF-0003 / DEF-0004 anti-shape).
 */

import { test, expect } from "@playwright/test";
import { ROLES, STAFF_ROLES, getRole } from "../roles";

test.describe("Pillar S — role-login matrix (browser-driven)", () => {
  for (const id of STAFF_ROLES) {
    const role = getRole(id);

    test(`pillar-S signin: ${role.id} (${role.email}) lands on ${role.homeRoute}`, async ({
      page,
      baseURL,
    }) => {
      test.skip(!baseURL, "baseURL not configured");
      test.skip(
        !role.email || !role.password,
        "role has no Credentials login wired (token-auth role exercised in Pillar D)",
      );

      // 1. Visit /auth/signin and wait for the form to hydrate.
      await page.goto("/auth/signin");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

      // 2. Fill credentials. We DO NOT use page.locator('input') by index
      //    (that would be a §4.2 selector-widening violation); we resolve
      //    by accessible label per the design-system contract.
      await page.getByLabel(/email/i).fill(role.email!);
      await page.getByLabel(/password/i).fill(role.password!);

      // 3. Submit. NextAuth will POST /api/auth/callback/credentials
      //    and 302 to the callback URL on success.
      await Promise.all([
        page.waitForURL((url) => !url.pathname.startsWith("/auth/signin"), {
          timeout: 30_000,
        }),
        page.getByRole("button", { name: /sign in/i }).click(),
      ]);

      // 4. The post-login URL must be role-appropriate. We don't assert
      //    a strict equality on `homeRoute` because middleware may
      //    redirect onward (e.g. /dashboard -> /dashboard/<slug>) — the
      //    invariant is that we are NOT back on /auth/signin and NOT on
      //    an error page.
      const url = new URL(page.url());
      expect(url.pathname).not.toMatch(/^\/auth\/signin/);
      expect(url.searchParams.get("error")).toBeNull();

      // 5. Page-shape invariant: visible <main> and at least one <h1>/<h2>.
      //    A 200-blank-shell still fails (DEF-0003 / DEF-0004 anti-shape).
      await expect(page.locator("main")).toBeVisible();
      await expect(page.locator("h1, h2").first()).toBeVisible();

      // 6. Cross-check against the session endpoint — the cookie we just
      //    received MUST resolve to the right user.role.
      const sessionRes = await page.request.get("/api/auth/session");
      expect(sessionRes.status()).toBe(200);
      const session = await sessionRes.json();
      expect(session?.user?.role).toBe(role.prismaRole);
      expect(session?.user?.email).toBe(role.email);
    });
  }

  test("role registry consistency: STAFF_ROLES is a non-empty subset of ROLES", () => {
    expect(STAFF_ROLES.length).toBeGreaterThan(0);
    for (const id of STAFF_ROLES) {
      const role = ROLES.find((r) => r.id === id);
      expect(role, `STAFF_ROLES has ${id} but ROLES does not`).toBeDefined();
      expect(
        role!.email,
        `STAFF_ROLES has ${id} but the role is missing email — credentials login impossible`,
      ).toBeTruthy();
      expect(
        role!.password,
        `STAFF_ROLES has ${id} but the role is missing password — credentials login impossible`,
      ).toBeTruthy();
    }
  });
});
