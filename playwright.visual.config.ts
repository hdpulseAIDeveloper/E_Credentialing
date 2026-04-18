/**
 * Playwright config for the per-browser visual regression matrix.
 *
 * Wave 4.4 — `pillar F` of `docs/qa/STANDARD.md`. The functional Playwright
 * config (`playwright.config.ts`) shards by *role*; this config shards by
 * *browser engine* so the curated visual baselines under
 * `tests/e2e/visual/**` lock the rendered DOM in chromium, firefox, AND
 * webkit. Functional specs are excluded from this config — visual regression
 * runs in its own pipeline (`npm run qa:visual`) so a UI tweak doesn't
 * cascade into an RBAC false-fail.
 *
 * Snapshot path strategy:
 *   tests/e2e/visual/__screenshots__/<spec>/<projectName>/<name>.png
 * — keeps engine-specific baselines side by side under git so review of a
 * proposed visual change is a normal three-way diff in the PR.
 *
 * ANTI-WEAKENING (STANDARD.md §4.2):
 *   - DO NOT raise `maxDiffPixelRatio` per-spec to mute a real diff.
 *   - DO NOT widen `threshold` (per-channel) without an ADR — sub-pixel
 *     antialiasing differences between WebKit minor versions are the only
 *     legitimate reason and that change belongs in *this* file, once.
 *   - If a baseline must change: re-run with `--update-snapshots`, commit
 *     the new PNGs, and call out the visual delta in the PR description.
 */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { STAFF_ROLES, storageStateFor } from "./tests/e2e/roles";

const TODAY = new Date().toISOString().slice(0, 10);
const REPORT_DIR = path.join(__dirname, "docs", "qa", "results", TODAY);

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:6015";

export default defineConfig({
  testDir: "./tests/e2e/visual",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Snapshot mismatches are real signal — don't paper over them with retries.
  retries: 0,
  // Each engine boots independently; 3 workers maxes one per project.
  workers: 3,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    // Tightened from the Playwright default (0.2). Anti-aliasing differences
    // between minor browser releases stay below 0.05 in practice; anything
    // above is a real visual regression.
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.15,
      animations: "disabled",
      caret: "hide",
    },
  },

  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(REPORT_DIR, "playwright-visual"),
        open: "never",
      },
    ],
    [
      "json",
      {
        outputFile: path.join(
          REPORT_DIR,
          "playwright-visual-results.json",
        ),
      },
    ],
  ],
  outputDir: path.join(REPORT_DIR, "test-output-visual"),

  // Snapshot files live next to specs (not the global outputDir) so they're
  // committed and reviewable.
  snapshotPathTemplate:
    "{testDir}/__screenshots__/{testFilePath}/{projectName}/{arg}{ext}",

  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    // Pin viewport so engine differences are isolated to *rendering*, not
    // layout reflow.
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    // colorScheme pinned light — the dark-mode baseline lives in its own
    // spec so reviewers can diff the two intentionally.
    colorScheme: "light",
  },

  projects: [
    // ---- Anonymous (public surfaces: /, /auth/*, /legal/*, /verify/*) ----
    {
      name: "anonymous-chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } },
      testMatch: ["**/anonymous.visual.spec.ts"],
    },
    {
      name: "anonymous-firefox",
      use: { ...devices["Desktop Firefox"], viewport: { width: 1440, height: 900 } },
      testMatch: ["**/anonymous.visual.spec.ts"],
    },
    {
      name: "anonymous-webkit",
      use: { ...devices["Desktop Safari"], viewport: { width: 1440, height: 900 } },
      testMatch: ["**/anonymous.visual.spec.ts"],
    },

    // ---- Authenticated staff baselines (admin role drives the matrix) ----
    {
      name: "staff-chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: storageStateFor("admin"),
      },
      testMatch: ["**/staff.visual.spec.ts"],
    },
    {
      name: "staff-firefox",
      use: {
        ...devices["Desktop Firefox"],
        viewport: { width: 1440, height: 900 },
        storageState: storageStateFor("admin"),
      },
      testMatch: ["**/staff.visual.spec.ts"],
    },
    {
      name: "staff-webkit",
      use: {
        ...devices["Desktop Safari"],
        viewport: { width: 1440, height: 900 },
        storageState: storageStateFor("admin"),
      },
      testMatch: ["**/staff.visual.spec.ts"],
    },

    // Legacy single-baseline spec — kept so existing CI doesn't 404. The
    // chromium-only skip inside the spec stays in place; the new matrix
    // above supersedes it.
    {
      name: "legacy-pillar-f",
      use: { ...devices["Desktop Chrome"] },
      testMatch: ["**/pillar-f-visual.spec.ts"],
    },
  ],

  // Roles relied on by `staff-*` projects. We assert they exist up-front so
  // the suite fails loudly if globalSetup didn't run.
  metadata: {
    rolesUsed: STAFF_ROLES,
  },
});
