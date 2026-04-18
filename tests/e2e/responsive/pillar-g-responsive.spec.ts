/**
 * Pillar G -- Cross-browser & responsive (per `docs/qa/STANDARD.md` §1.G).
 *
 * Wave 4.4 adds the firefox + webkit projects to playwright.prod.config.ts.
 * This file covers responsive breakpoints across the chromium runs we
 * already have today.
 *
 * Per-viewport assertions exercise the same /dashboard surface at three
 * widths so a CSS regression that only appears on mobile breaks the gate.
 */
import { test, expect } from "../fixtures";

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 667 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
];

for (const vp of VIEWPORTS) {
  test(`pillar-G responsive: /dashboard at ${vp.name} (${vp.width}x${vp.height})`, async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith("role-"), "role projects only");

    await page.setViewportSize({ width: vp.width, height: vp.height });
    const resp = await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    if (!resp || resp.status() >= 400) test.skip(true, "role does not have dashboard access");

    await expect(page.locator("main")).toBeVisible();

    // No element should overflow the viewport horizontally -- a horizontal
    // scrollbar at mobile is a UX regression.
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
    );
    expect(overflow, `${vp.name} viewport: page has horizontal overflow`).toBe(false);
  });
}
