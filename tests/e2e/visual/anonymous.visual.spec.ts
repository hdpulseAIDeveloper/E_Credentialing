/**
 * Anonymous visual baselines — Wave 4.4.
 *
 * Locks the rendered DOM of every public surface (no auth) across
 * chromium / firefox / webkit. Each route gets ONE full-page screenshot;
 * smaller hero/CTA crops are reserved for tighter pillar-F specs added
 * in W5.2 when the marketing landing lands.
 *
 * Driver: `playwright.visual.config.ts` projects `anonymous-{chromium,
 * firefox, webkit}`.
 *
 * To bootstrap baselines:
 *   npm run qa:visual:update
 *
 * To verify only:
 *   npm run qa:visual
 *
 * Anti-weakening (STANDARD.md §4.2): if a baseline fails legitimately,
 * regenerate it intentionally — do NOT raise `maxDiffPixelRatio` per
 * test.
 */
import { test, expect } from "@playwright/test";

interface Page {
  name: string;
  path: string;
  // Optional: locator that must be present before screenshot — gives
  // the spec a deterministic anchor instead of a sleep.
  waitFor?: string;
}

const PAGES: Page[] = [
  { name: "landing", path: "/" },
  { name: "auth-signin", path: "/auth/signin" },
  { name: "auth-register", path: "/auth/register" },
  { name: "legal-privacy", path: "/legal/privacy" },
  { name: "legal-terms", path: "/legal/terms" },
  { name: "legal-hipaa", path: "/legal/hipaa" },
  { name: "legal-cookies", path: "/legal/cookies" },
];

test.describe("anonymous visual baselines", () => {
  for (const p of PAGES) {
    test(`${p.name} → ${p.path}`, async ({ page }) => {
      const res = await page.goto(p.path, { waitUntil: "networkidle" });
      // Public pages MUST be 200; a 404 visual baseline is meaningless.
      expect(res?.ok(), `expected 2xx for ${p.path}`).toBeTruthy();
      if (p.waitFor) {
        await page.locator(p.waitFor).first().waitFor({ state: "visible" });
      }
      await expect(page).toHaveScreenshot(`${p.name}.png`, {
        fullPage: true,
        animations: "disabled",
        caret: "hide",
      });
    });
  }
});
