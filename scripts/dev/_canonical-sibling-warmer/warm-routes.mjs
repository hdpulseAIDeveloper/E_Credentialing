#!/usr/bin/env node
/**
 * Pre-warm every static App Router route in the dev server so the user
 * never pays the "first click compiles the whole route" cost interactively.
 *
 * This is the CANONICAL sibling-app version (no auth, no inventory file,
 * pure filesystem discovery). The HDPulseAI suite uses identical copies
 * of this file in every Next.js app — see
 * docs/standards/dev-loop-warmup.md for the registry and update protocol.
 *
 * What it does:
 *   1. Wait for BASE_URL (default http://localhost:${PORT}) to respond.
 *   2. Walk src/app/ (or app/) to discover every static route. Dynamic
 *      segments other than [locale] are skipped (we can't invent valid
 *      slugs); [locale] is expanded against WARM_LOCALES (default "en").
 *   3. GET each route once so Next compiles the page module on the
 *      warmer's request, not on the user's first click.
 *
 * Refuses to run if NODE_ENV=production. Bypass with SKIP_WARMUP=1.
 *
 * Env:
 *   PORT          — dev server port (default 3000)
 *   BASE_URL      — full origin (overrides PORT)
 *   WARM_LOCALES  — comma-separated locale codes for [locale] expansion
 *                   (default "en"; e.g. "en,es")
 *   WARM_EXTRA    — comma-separated extra paths to also warm
 *                   (e.g. "/sitemap.xml,/robots.txt")
 *   SKIP_WARMUP=1 — exit immediately
 */

import { readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

if (process.env.SKIP_WARMUP === "1") {
  process.stdout.write("[warm] SKIP_WARMUP=1 — exiting\n");
  process.exit(0);
}
if (process.env.NODE_ENV === "production") {
  process.stderr.write(
    "[warm] refusing to run in production (NODE_ENV=production)\n",
  );
  process.exit(0);
}

// ─── PER-APP DEFAULTS ───────────────────────────────────────────────────────
// EDIT THIS BLOCK when copying into a sibling app — it is the only line of
// per-app divergence from this canonical template. Override at runtime with
// PORT=... WARM_LOCALES=... env vars.
const APP_DEFAULTS = { PORT: "3000", WARM_LOCALES: "en" };
process.env.PORT = process.env.PORT || APP_DEFAULTS.PORT;
if (process.env.WARM_LOCALES == null) process.env.WARM_LOCALES = APP_DEFAULTS.WARM_LOCALES;

const PORT = process.env.PORT;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const HEALTH_TIMEOUT_MS = 120_000;
const ROUTE_TIMEOUT_MS = 90_000;

const WARM_LOCALES = (process.env.WARM_LOCALES ?? "en")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const WARM_EXTRA = (process.env.WARM_EXTRA ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  process.stdout.write(`[warm] ${msg}\n`);
}

async function waitForReady() {
  // Marketing apps usually don't have /api/health; a GET / that returns
  // anything other than ECONNREFUSED is good enough.
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5_000);
      const res = await fetch(`${BASE_URL}/`, {
        signal: ctrl.signal,
        redirect: "manual",
      });
      clearTimeout(timer);
      if (res.status > 0) {
        log(`dev server reachable after ${attempt} attempt(s) (status ${res.status})`);
        return;
      }
    } catch {
      // not ready
    }
    await sleep(2_000);
  }
  throw new Error(
    `dev server did not respond at ${BASE_URL}/ within ${HEALTH_TIMEOUT_MS / 1000}s`,
  );
}

async function findAppDir() {
  for (const c of ["src/app", "app"]) {
    const p = path.join(REPO_ROOT, c);
    if (existsSync(p)) return p;
  }
  return null;
}

const PAGE_RE = /^page\.(tsx|ts|jsx|js|mdx)$/;

async function walkAppRoutes(appDir) {
  const found = new Set();
  async function walk(dir, segs) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some((e) => e.isFile() && PAGE_RE.test(e.name))) {
      const url = "/" + segs.join("/");
      found.add(url === "//" ? "/" : url.replace(/\/$/, "") || "/");
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const name = e.name;
      // Private folders, parallel routes, intercepted routes -> ignore
      if (name.startsWith("_") || name.startsWith("@") || name.startsWith(".")) continue;
      // Route groups -> recurse but don't add a URL segment
      if (name.startsWith("(") && name.endsWith(")")) {
        await walk(path.join(dir, name), segs);
        continue;
      }
      // Catch-all dynamic segments [...slug] / [[...slug]] -> can't warm
      if (/^\[\[?\.\.\..+\]\]?$/.test(name)) continue;
      // Single dynamic segments [slug] -> skip unless it's [locale]
      if (name.startsWith("[") && name.endsWith("]")) {
        if (name === "[locale]") {
          await walk(path.join(dir, name), [...segs, "__LOCALE__"]);
        }
        continue;
      }
      await walk(path.join(dir, name), [...segs, name]);
    }
  }
  await walk(appDir, []);
  return [...found].sort();
}

function expandLocales(routes) {
  const out = new Set();
  for (const r of routes) {
    if (!r.includes("__LOCALE__")) {
      out.add(r);
      continue;
    }
    for (const loc of WARM_LOCALES) {
      out.add(r.replaceAll("__LOCALE__", loc));
    }
  }
  return [...out];
}

async function warmOne(route) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ROUTE_TIMEOUT_MS);
    const res = await fetch(`${BASE_URL}${route}`, {
      method: "GET",
      redirect: "manual",
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return { route, ok: true, status: res.status, ms: Date.now() - t0 };
  } catch (err) {
    return {
      route,
      ok: false,
      status: 0,
      ms: Date.now() - t0,
      err: err instanceof Error ? err.message : String(err),
    };
  }
}

async function main() {
  log(`warming routes against ${BASE_URL}`);
  await waitForReady();

  const appDir = await findAppDir();
  let routes;
  if (!appDir) {
    log("no src/app or app directory found — warming only / and any WARM_EXTRA paths");
    routes = ["/"];
  } else {
    const raw = await walkAppRoutes(appDir);
    routes = expandLocales(raw);
    log(
      `discovered ${raw.length} static route templates from ${path.relative(REPO_ROOT, appDir)}; expanded to ${routes.length} URL(s) using locales [${WARM_LOCALES.join(", ")}]`,
    );
  }

  for (const extra of WARM_EXTRA) {
    if (extra) routes.push(extra);
  }

  const t0 = Date.now();
  let slow = 0;
  let fail = 0;
  for (const route of routes) {
    const r = await warmOne(route);
    if (!r.ok) {
      fail++;
      log(`  FAIL ${route} (${r.ms}ms): ${r.err}`);
    } else {
      const flag = r.ms > 5000 ? "  SLOW" : "";
      if (r.ms > 5000) slow++;
      log(`  ${String(r.status).padStart(3)} ${route} (${r.ms}ms)${flag}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(
    `done: ${routes.length} routes warmed in ${elapsed}s (${slow} slow > 5s, ${fail} failed) — clicks should now feel instant`,
  );
}

main().catch((err) => {
  process.stderr.write(`[warm] fatal: ${err.message}\n`);
  // Exit 0 so the dev server keeps running even on transient failures.
  process.exit(0);
});
