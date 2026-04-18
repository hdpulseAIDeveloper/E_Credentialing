/**
 * Staff (admin role) visual baselines — Wave 4.4.
 *
 * One full-page screenshot per high-value staff surface, exercised in
 * chromium / firefox / webkit. Driven by `playwright.visual.config.ts`
 * projects `staff-{chromium, firefox, webkit}` which preload the admin
 * storageState produced by tests/e2e/global-setup.ts.
 *
 * Curated rather than exhaustive: the 60-route inventory × 3 engines
 * would mean ~180 PNGs that nobody reviews. We baseline the screens
 * where a regression would be most visible and would most impact the
 * day-to-day staff workflow.
 *
 * Anti-weakening (STANDARD.md §4.2): same rules as anonymous.visual.
 */
import { test, expect } from "@playwright/test";

interface Page {
  name: string;
  path: string;
  waitFor?: string;
}

// Curated set — high-traffic staff routes whose visuals matter for
// compliance reviewers and demo stakeholders.
const PAGES: Page[] = [
  { name: "dashboard", path: "/dashboard" },
  { name: "providers-list", path: "/providers" },
  { name: "applications", path: "/applications" },
  { name: "documents", path: "/documents" },
  { name: "expirables", path: "/expirables" },
  { name: "sanctions", path: "/sanctions" },
  { name: "committee", path: "/committee" },
  { name: "audit-log", path: "/audit-log" },
  { name: "admin-settings", path: "/admin/settings" },
];

test.describe("staff (admin) visual baselines", () => {
  for (const p of PAGES) {
    test(`${p.name} → ${p.path}`, async ({ page }) => {
      const res = await page.goto(p.path, { waitUntil: "networkidle" });
      // Auth must be effective — a 302 to /auth/signin would still
      // produce a stable PNG, so we assert status explicitly.
      expect(
        res?.ok(),
        `expected 2xx for ${p.path} (storageState may be missing)`,
      ).toBeTruthy();
      if (p.waitFor) {
        await page.locator(p.waitFor).first().waitFor({ state: "visible" });
      }
      // Mask the in-page clock / "now" widgets so an unrelated tick
      // doesn't fail every diff.
      const masks = [
        page.locator("[data-testid='session-now']"),
        page.locator("[data-testid='last-refreshed']"),
      ];
      await expect(page).toHaveScreenshot(`${p.name}.png`, {
        fullPage: true,
        mask: masks,
        animations: "disabled",
        caret: "hide",
      });
    });
  }
});
