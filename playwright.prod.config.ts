/**
 * Playwright config for the production-bundle E2E mode.
 *
 * Closes DEF-INFRA-0001 (`docs/qa/defects/DEF-INFRA-0001.md`) by running
 * the full pillar suite against `npm start` (a fully pre-compiled Next
 * production bundle) instead of `next dev`. With every route already
 * compiled at build time, the first-hit-compile latency that ate per-spec
 * budgets in dev disappears — and we can crank workers from 2 to 4.
 *
 * Wired into:
 *   - `npm run qa:e2e:prod` (added in package.json) — orchestrates build,
 *     start, wait-for-ready, run, teardown via scripts/qa/e2e-prod-bundle.mjs
 *   - .github/workflows/qa-fix-until-green.yml nightly job (uses this
 *     config so the nightly Pillar A/B/E etc. matches what real users get)
 *
 * Anti-weakening (STANDARD.md §4.2): timeouts and retries are NOT
 * relaxed here. The whole point is that prod-bundle stability lets us
 * keep the same per-test budget that dev-mode breached.
 */
import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { STAFF_ROLES, storageStateFor } from "./tests/e2e/roles";

const TODAY = new Date().toISOString().slice(0, 10);
const REPORT_DIR = path.join(__dirname, "docs", "qa", "results", TODAY);
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:6015";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,

  workers: process.env.CI ? 4 : 4,
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ["list"],
    [
      "html",
      {
        outputFolder: path.join(REPORT_DIR, "playwright-prod"),
        open: "never",
      },
    ],
    [
      "json",
      {
        outputFile: path.join(REPORT_DIR, "playwright-prod-results.json"),
      },
    ],
  ],
  outputDir: path.join(REPORT_DIR, "test-output-prod"),
  globalSetup: require.resolve("./tests/e2e/global-setup.ts"),
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/role-*/**"],
    },
    ...STAFF_ROLES.map((role) => ({
      name: `role-${role}`,
      use: {
        ...devices["Desktop Chrome"],
        storageState: storageStateFor(role),
      },
      testMatch: [
        `**/role-${role}/**/*.spec.ts`,
        "**/all-roles/**/*.spec.ts",
      ],
    })),
  ],
});
