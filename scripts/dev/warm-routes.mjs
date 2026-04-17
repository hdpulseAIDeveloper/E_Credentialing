#!/usr/bin/env node
/**
 * Pre-warm every static route in the dev server so the user never pays
 * the "first click compiles the whole route" cost interactively.
 *
 * Strategy:
 *   1. Wait until /api/health returns 200.
 *   2. Authenticate as the seeded dev admin via NextAuth's Credentials
 *      callback (CSRF + form POST). We MUST be authenticated, otherwise
 *      the app middleware short-circuits with a 307 to /auth/signin
 *      BEFORE the page module is loaded — meaning unauthenticated GETs
 *      do not actually trigger route compilation.
 *   3. Read the static route list from the inventory built by
 *      `npm run qa:inventory` (or fall back to a hard-coded list).
 *   4. GET each route once with the session cookie so Next.js compiles
 *      the page module on the warmer's request, not on the user's.
 *
 * This script is dev-only. It refuses to run if NODE_ENV === "production"
 * because the seeded admin password is hard-wired here as a default.
 *
 * Env overrides:
 *   BASE_URL              — dev server origin (default http://localhost:6015)
 *   WARM_USER_EMAIL       — login email (default admin@hdpulseai.com)
 *   WARM_USER_PASSWORD    — login password (default seed value)
 *   SKIP_WARMUP=1         — exit immediately (used by dev-with-warmup.mjs)
 */

import { readFile } from "node:fs/promises";
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

const BASE_URL = process.env.BASE_URL ?? "http://localhost:6015";
const HEALTH_PATH = "/api/health";
const HEALTH_TIMEOUT_MS = 120_000;
const ROUTE_TIMEOUT_MS = 90_000;

const WARM_EMAIL = process.env.WARM_USER_EMAIL ?? "admin@hdpulseai.com";
const WARM_PASSWORD = process.env.WARM_USER_PASSWORD ?? "Users1!@#$%^";

const FALLBACK_ROUTES = [
  "/",
  "/auth/signin",
  "/dashboard",
  "/providers",
  "/verifications",
  "/expirables",
  "/committee",
  "/enrollments",
  "/medicaid",
  "/recredentialing",
  "/evaluations",
  "/cme",
  "/monitoring",
  "/peer-review",
  "/scorecards",
  "/analytics",
  "/reports",
  "/training",
  "/compliance",
  "/admin",
  "/admin/users",
  "/admin/roles",
  "/admin/workflows",
  "/admin/settings",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg) {
  process.stdout.write(`[warm] ${msg}\n`);
}

// ─── Cookie jar (good enough for a single origin) ────────────────────────────
const jar = new Map(); // name -> value

function captureSetCookie(res) {
  // Node 18+ exposes .getSetCookie() on Headers. Older Node falls back to
  // splitting the single 'set-cookie' header (less reliable for multi-cookies).
  const headers = res.headers;
  const cookies =
    typeof headers.getSetCookie === "function"
      ? headers.getSetCookie()
      : (headers.get("set-cookie") ?? "")
          .split(/,(?=[^;]+=[^;]+)/)
          .filter(Boolean);
  for (const raw of cookies) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq < 0) continue;
    const name = pair.slice(0, eq).trim();
    const value = pair.slice(eq + 1).trim();
    if (!name) continue;
    if (value === "" || value === "deleted") {
      jar.delete(name);
    } else {
      jar.set(name, value);
    }
  }
}

function cookieHeader() {
  if (jar.size === 0) return undefined;
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function fetchWithJar(url, init = {}) {
  const headers = new Headers(init.headers ?? {});
  const c = cookieHeader();
  if (c) headers.set("cookie", c);
  const res = await fetch(url, { ...init, headers });
  captureSetCookie(res);
  return res;
}

// ─── Steps ───────────────────────────────────────────────────────────────────

async function waitForHealth() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt++;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 5_000);
      const res = await fetch(`${BASE_URL}${HEALTH_PATH}`, {
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (res.ok) {
        log(`dev server healthy after ${attempt} attempt(s)`);
        return;
      }
    } catch {
      // dev server not ready yet — keep polling
    }
    await sleep(2_000);
  }
  throw new Error(
    `dev server did not become healthy at ${BASE_URL}${HEALTH_PATH} within ${HEALTH_TIMEOUT_MS / 1000}s`,
  );
}

async function login() {
  // 1. CSRF — picks up authjs.csrf-token cookie + returns the token.
  const csrfRes = await fetchWithJar(`${BASE_URL}/api/auth/csrf`);
  if (!csrfRes.ok) {
    throw new Error(`/api/auth/csrf -> ${csrfRes.status}`);
  }
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) throw new Error("empty csrfToken");

  // 2. Credentials callback — sets the session cookie on the 302 response.
  //    CRITICAL: redirect MUST be "manual". Node's built-in fetch follows
  //    redirects in its internal context and does NOT replay cookies that
  //    our local jar captures along the way, so following the 302 to
  //    /dashboard ends up at /auth/signin with no session. Stop at the 302,
  //    capture the Set-Cookie, and then call /api/auth/session ourselves.
  const body = new URLSearchParams({
    csrfToken,
    email: WARM_EMAIL,
    password: WARM_PASSWORD,
    callbackUrl: `${BASE_URL}/dashboard`,
    json: "true",
  });
  const cb = await fetchWithJar(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  // NextAuth returns 302 on success (redirect to callbackUrl) or 200 with
  // an `error` field on failure. Either way we just need the Set-Cookie.
  if (cb.status !== 302 && cb.status !== 200) {
    throw new Error(`callback returned ${cb.status}`);
  }

  // 3. Verify session — must contain user.role.
  const sessRes = await fetchWithJar(`${BASE_URL}/api/auth/session`);
  if (!sessRes.ok) {
    throw new Error(`/api/auth/session -> ${sessRes.status}`);
  }
  const sess = await sessRes.json();
  if (!sess?.user?.role) {
    const cookieNames = [...jar.keys()].join(", ") || "(none)";
    throw new Error(
      `session missing user.role — login failed (got ${JSON.stringify(sess)}; cookies in jar: ${cookieNames})`,
    );
  }
  log(`authenticated as ${sess.user.email} (role=${sess.user.role})`);
}

async function loadRoutes() {
  const candidates = [
    path.join(REPO_ROOT, "docs", "qa", "inventories", "route-inventory.json"),
    "/app/docs/qa/inventories/route-inventory.json",
  ];
  for (const p of candidates) {
    try {
      const json = JSON.parse(await readFile(p, "utf8"));
      const routes = json
        .filter((r) => !r.dynamic)
        .map((r) => r.route);
      if (routes.length > 0) {
        log(`loaded ${routes.length} static routes from ${p}`);
        return routes;
      }
    } catch {
      // try next
    }
  }
  log(
    `route inventory not found; using ${FALLBACK_ROUTES.length}-route fallback list (run \`npm run qa:inventory\` to enable full coverage)`,
  );
  return FALLBACK_ROUTES;
}

async function warmOne(route) {
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ROUTE_TIMEOUT_MS);
    const res = await fetchWithJar(`${BASE_URL}${route}`, {
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
  log(`warming routes against ${BASE_URL} (user=${WARM_EMAIL})`);
  await waitForHealth();
  try {
    await login();
  } catch (err) {
    log(
      `WARN login failed (${err.message}); will warm public routes only — protected routes will compile on first user click`,
    );
  }
  const routes = await loadRoutes();
  const t0 = Date.now();

  // Sequential — Next dev compilation is single-threaded per process.
  let slow = 0;
  let fail = 0;
  let auth307 = 0;
  for (const route of routes) {
    const r = await warmOne(route);
    if (!r.ok) {
      fail++;
      log(`  FAIL ${route} (${r.ms}ms): ${r.err}`);
    } else {
      // Status 307 with no session means the warmer never authenticated
      // and the route never actually compiled. Track separately so the
      // user knows.
      if (r.status === 307 && jar.size === 0) auth307++;
      const flag = r.ms > 5000 ? "  SLOW" : "";
      if (r.ms > 5000) slow++;
      log(`  ${String(r.status).padStart(3)} ${route} (${r.ms}ms)${flag}`);
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  log(
    `done: ${routes.length} routes warmed in ${elapsed}s (${slow} slow > 5s, ${fail} failed${auth307 ? `, ${auth307} unauthenticated 307s` : ""}) — clicks should now feel instant`,
  );
}

main().catch((err) => {
  process.stderr.write(`[warm] fatal: ${err.message}\n`);
  // Exit 0 so the dev server keeps running even if warmer hits a transient
  // failure (e.g. seeded admin not yet present after `prisma migrate reset`).
  process.exit(0);
});
