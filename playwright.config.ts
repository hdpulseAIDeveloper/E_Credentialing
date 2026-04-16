import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for ESSEN Credentialing E2E tests.
 *
 * Run locally:  npm run test:e2e
 * UI mode:      npm run test:e2e:ui
 *
 * CI runs headless on chromium + firefox. Visual and a11y tests share this
 * config but live under tests/e2e/**.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["html"], ["github"]] : "html",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:6015",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  ],
});
