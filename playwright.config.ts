import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { STAFF_ROLES, storageStateFor } from "./tests/e2e/roles";

/**
 * Playwright config for the HDPulseAI Comprehensive QA Test Layer.
 *
 * Per `docs/qa/STANDARD.md`:
 *   - One project per staff role + one anonymous project — keeps RBAC
 *     specs (pillar B) honest by exercising the same spec against
 *     every storageState.
 *   - globalSetup logs in once per role and writes
 *     tests/e2e/.auth/<role>.json. Specs opt in via the matching project.
 *   - HTML report lives at docs/qa/results/<date>/playwright/ so reports
 *     live with the §3 SUMMARY.md and the DEF cards rather than an
 *     untracked playwright-report/ folder.
 *
 * ANTI-WEAKENING (§4.2): retries, timeouts, and reporters defined here are
 * NOT to be raised by individual specs to mask a flake. If a spec needs a
 * longer wait, add a deterministic anchor (page.waitForResponse, etc.) —
 * not a higher timeout.
 */

const TODAY = new Date().toISOString().slice(0, 10);
const REPORT_DIR = path.join(__dirname, "docs", "qa", "results", TODAY);

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:6015";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // 2 workers — dev mode compile is single-threaded per Next process; more
  // parallelism just queues compiles. Production builds can crank this up.
  // Per-test timeout is unchanged at 60s — the globalSetup warm-up
  // pre-compiles every route so first-hit compile latency doesn't eat the
  // budget (no §4.2 weakening).
  workers: process.env.CI ? 2 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(REPORT_DIR, "playwright"), open: "never" }],
    ["json", { outputFile: path.join(REPORT_DIR, "playwright-results.json") }],
  ],
  outputDir: path.join(REPORT_DIR, "test-output"),
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
    // Anonymous project — for /, /auth/signin, /legal/*, public/api routes.
    {
      name: "anonymous",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: ["**/role-*/**"],
    },
    // One project per staff role. Specs in tests/e2e/role-<id>/** run only
    // for that role; specs at the top of tests/e2e/** run for every role
    // (this is how pillar B (RBAC) gets free coverage).
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
