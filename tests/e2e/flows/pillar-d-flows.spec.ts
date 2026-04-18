/**
 * Pillar D -- Deep end-to-end flows (per `docs/qa/STANDARD.md` §1.D).
 *
 * One full happy-path flow per critical journey. The seed data is the
 * source of truth; flows reference seeded providers / users so they
 * remain deterministic across runs.
 *
 * Wave 3 adds the OPPE/FPPE flow and the CV-builder flow; this file
 * is the entry point.
 */
import { test, expect } from "../fixtures";
import { ROLES } from "../roles";

test("pillar-D: admin can navigate dashboard -> providers -> first detail", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "role-admin", "admin-only flow");

  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page.locator("h1, h2").first()).toBeVisible();

  await page.goto("/providers", { waitUntil: "domcontentloaded" });
  await expect(page.locator("main")).toBeVisible();

  // Click into the first provider row (every seeded environment has at least
  // one provider). If none exist, the seed is broken and Pillar D should
  // surface that immediately rather than masking it as a skip.
  const firstLink = page
    .locator("a[href^='/providers/']")
    .filter({ hasNot: page.locator("a[href='/providers/new']") })
    .first();
  await expect(firstLink, "no provider rows on /providers -- seed broken").toBeVisible();
  await firstLink.click();
  await expect(page.locator("main")).toBeVisible();
});

test("pillar-D: every staff role sees their dashboard home without errors", async ({ page }, testInfo) => {
  const proj = testInfo.project.name;
  if (!proj.startsWith("role-")) test.skip(true, "role projects only");

  const role = ROLES.find((r) => `role-${r.id}` === proj);
  if (!role || role.id === "provider") test.skip(true, "staff roles only");

  const home = role!.homeRoute;
  const resp = await page.goto(home, { waitUntil: "domcontentloaded" });
  expect(resp?.status(), `${role!.id} cannot reach ${home}`).toBeLessThan(400);
  await expect(page.locator("main, h1, h2").first()).toBeVisible();
});
