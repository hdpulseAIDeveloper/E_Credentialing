#!/usr/bin/env node
/**
 * scripts/qa/e2e-prod-bundle.mjs — DEF-INFRA-0001 closure runner.
 *
 * Runs the Playwright suite against a fully-built Next.js production
 * bundle instead of `next dev`. This eliminates the per-route on-demand
 * compile latency that caused 16/173 spurious timeouts in Pillar A run
 * 4 and 8/42 timeouts in Pillar E run 1 (see DEF-INFRA-0001 captured
 * evidence).
 *
 * Sequence:
 *   1. (skip if SKIP_BUILD=1) `npm run build`
 *   2. `npm start &` on PORT=6015 — capture pid
 *   3. Poll `http://localhost:6015/api/health` until 200 or 60s timeout
 *   4. `npx playwright test --config=playwright.prod.config.ts <args...>`
 *   5. ALWAYS kill the npm-start process tree (defer block)
 *   6. Forward Playwright's exit code as our own
 *
 * Usage:
 *   npm run qa:e2e:prod                          # full suite
 *   npm run qa:e2e:prod -- tests/e2e/smoke       # one folder
 *   SKIP_BUILD=1 npm run qa:e2e:prod             # reuse prior .next
 *
 * Env:
 *   PORT         override the listen port (default 6015)
 *   E2E_BASE_URL override the base URL Playwright sees (default
 *                http://localhost:<PORT>)
 *   SKIP_BUILD   skip npm run build (useful for iterating after a build)
 */
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { argv, env, exit, platform } from "node:process";

const PORT = env.PORT ?? "6015";
const BASE_URL = env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const PLAYWRIGHT_ARGS = argv.slice(2);

const isWindows = platform === "win32";

function log(label, msg) {
  process.stdout.write(`[e2e-prod-bundle] ${label}: ${msg}\n`);
}

async function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: "inherit",
      shell: isWindows,
      ...opts,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
  });
}

function spawnBg(cmd, args, opts = {}) {
  return spawn(cmd, args, {
    stdio: "inherit",
    shell: isWindows,
    detached: !isWindows,
    ...opts,
  });
}

async function waitForHealthy(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${url}/api/health`, { method: "GET" });
      if (r.ok) {
        return;
      }
      lastErr = new Error(`health returned ${r.status}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(1000);
  }
  throw new Error(`server never became healthy at ${url}: ${lastErr?.message ?? "unknown"}`);
}

function killTree(child) {
  if (!child || child.killed) return;
  if (isWindows) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      shell: true,
    });
  } else {
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      try {
        child.kill("SIGTERM");
      } catch {
        // best effort
      }
    }
  }
}

async function main() {
  if (env.SKIP_BUILD === "1") {
    log("step 1/5", "skipping build (SKIP_BUILD=1)");
  } else {
    log("step 1/5", "npm run build");
    await run("npm", ["run", "build"]);
  }

  log("step 2/5", `npm start on PORT=${PORT}`);
  const server = spawnBg("npm", ["start"], {
    env: { ...env, PORT, NODE_ENV: "production" },
  });

  let exitCode = 0;
  try {
    log("step 3/5", `waiting for ${BASE_URL}/api/health (60s budget)`);
    await waitForHealthy(BASE_URL, 60_000);
    log("step 3/5", "server healthy");

    log("step 4/5", `playwright (config: playwright.prod.config.ts) ${PLAYWRIGHT_ARGS.join(" ")}`);
    try {
      await run(
        "npx",
        ["playwright", "test", "--config=playwright.prod.config.ts", ...PLAYWRIGHT_ARGS],
        { env: { ...env, E2E_BASE_URL: BASE_URL } },
      );
    } catch (e) {
      log("step 4/5", `playwright failed: ${e.message}`);
      exitCode = 1;
    }
  } catch (e) {
    log("FATAL", e.message);
    exitCode = 2;
  } finally {
    log("step 5/5", "killing npm start process tree");
    killTree(server);
    await sleep(500);
  }

  exit(exitCode);
}

main().catch((e) => {
  log("UNHANDLED", e.message);
  exit(2);
});
