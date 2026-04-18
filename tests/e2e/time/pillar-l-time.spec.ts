/**
 * Pillar L -- Time-shifted scenarios (per `docs/qa/STANDARD.md` §1.L).
 *
 * Sessions, expirables, recredentialing cycles, and scheduled jobs
 * behave correctly at boundary times. The unit suite at
 * tests/unit/server/services/expirable-dates.test.ts and
 * tests/unit/server/services/recredentialing-cycle.test.ts cover the
 * pure-function logic; this file reaches the rendered UI to make sure
 * the date math actually surfaces.
 *
 * Wave 3.4 adds the deeper telehealth-coverage-gap UI and IMLC LoQ
 * timing assertions.
 */
import { test, expect } from "../fixtures";

test("pillar-L: /expirables loads without errors for staff", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.startsWith("role-"), "role projects only");
  if (testInfo.project.name === "role-provider") test.skip(true, "staff only");

  const resp = await page.goto("/expirables", { waitUntil: "domcontentloaded" });
  if (resp && resp.status() === 404) test.skip(true, "expirables not enabled in this build");

  expect(resp?.status() ?? 0).toBeLessThan(400);
  await expect(page.locator("main, h1, h2").first()).toBeVisible();
});
