/**
 * Pillar F -- Visual regression (per `docs/qa/STANDARD.md` §1.F).
 *
 * Wave 4.4 lands the full per-browser baseline matrix
 * (`docs/qa/inventories/route-inventory.json` x {chromium, firefox,
 * webkit}). This file is the entry point and ships ONE baseline for the
 * sign-in page so the wiring is exercised end-to-end before W4.4 widens
 * the matrix.
 *
 * Anti-weakening (§4.2): NEVER raise `maxDiffPixelRatio` beyond the
 * Playwright default to mask a real regression. A real visual change
 * means re-running with --update-snapshots and reviewing the diff.
 */
import { test, expect } from "@playwright/test";

test.describe("pillar-F visual baseline", () => {
  test.skip(({ browserName }) => browserName !== "chromium", "baselines pinned to chromium until W4.4");

  test("sign-in page baseline", async ({ page }) => {
    await page.goto("/auth/signin", { waitUntil: "networkidle" });
    await expect(page).toHaveScreenshot("auth-signin.png", {
      fullPage: true,
      maxDiffPixelRatio: 0.01,
    });
  });
});
