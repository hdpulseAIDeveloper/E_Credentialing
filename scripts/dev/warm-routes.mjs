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
      const staticRoutes = json
        .filter((r) => !r.dynamic)
        .map((r) => r.route);
      const dynamicRoutes = json
        .filter((r) => r.dynamic)
        .map((r) => r.route);
      if (staticRoutes.length > 0) {
        log(
          `loaded ${staticRoutes.length} static + ${dynamicRoutes.length} dynamic routes from ${p}`,
        );
        return { static: staticRoutes, dynamic: dynamicRoutes };
      }
    } catch {
      // try next
    }
  }
  log(
    `route inventory not found; using ${FALLBACK_ROUTES.length}-route fallback list (run \`npm run qa:inventory\` to enable full coverage)`,
  );
  return { static: FALLBACK_ROUTES, dynamic: [] };
}

/**
 * Map every dynamic route template (e.g. `/providers/[id]`) to its
 * "parent list page" (e.g. `/providers`). The list page is the surface
 * the user will most likely click into a detail page from, and its
 * rendered HTML usually contains href="/providers/<real-id>" links we
 * can harvest as sample URLs to warm the dynamic page module.
 *
 * We deliberately keep this self-discovering (parse list HTML) rather
 * than DB-querying so the warmer has zero new schema dependencies and
 * works against any seed state. If a list page yields no harvestable
 * href, we fall back to a synthetic UUID-shaped placeholder — the
 * dynamic page MODULE compiles regardless of whether the loader finds
 * a row, so even a 404 response from `/providers/<bad-uuid>` warms
 * the entire route tree (RootLayout → (staff)Layout →
 * providers/[id]/layout → providers/[id]/page).
 *
 * Synthetic placeholder for unmappable routes (e.g. `/admin/ai-governance/[id]`
 * if the list page hasn't been seeded yet).
 */
const SYNTHETIC_SAMPLE = "00000000-0000-0000-0000-000000000000";

function parentListFor(dynamicRoute) {
  // `/providers/[id]` -> `/providers`
  // `/committee/sessions/[id]` -> `/committee/sessions`
  // `/compliance/[framework]/[id]` -> we want `/compliance` (the topmost
  //   non-dynamic ancestor) so we have a list to harvest from.
  // `/errors/[code]` -> `/errors`
  const segments = dynamicRoute.split("/").filter(Boolean);
  const upToFirstDyn = [];
  for (const seg of segments) {
    if (seg.startsWith("[")) break;
    upToFirstDyn.push(seg);
  }
  if (upToFirstDyn.length === 0) return "/";
  return "/" + upToFirstDyn.join("/");
}

/**
 * Harvest the first href that matches a `/<parent>/<id>` shape from a
 * list page's HTML. Returns null if none found.
 */
function harvestSampleHref(html, parent) {
  // Match href="/providers/<id>" — id can be a uuid, a numeric, or a
  // slug. Stop at any `?`, `#`, `"`, or further `/` to keep just the
  // first id segment.
  const escapedParent = parent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`href=["']${escapedParent}/([^"'#?/]+)`, "g");
  const m = re.exec(html);
  return m ? `${parent}/${m[1]}` : null;
}

async function expandDynamicRoutes(dynamicRoutes) {
  const expanded = [];
  for (const dyn of dynamicRoutes) {
    const parent = parentListFor(dyn);
    let sampleHref = null;
    try {
      const res = await fetchWithJar(`${BASE_URL}${parent}`, {
        redirect: "manual",
      });
      if (res.ok) {
        const html = await res.text();
        sampleHref = harvestSampleHref(html, parent);
      }
    } catch {
      // ignore; fall back to synthetic
    }
    if (!sampleHref) {
      // Build a synthetic URL by replacing each `[xxx]` with the
      // synthetic id placeholder. Safe because Next.js compiles the
      // route module regardless of whether the loader resolves a row.
      sampleHref = dyn.replace(/\[[^\]]+\]/g, SYNTHETIC_SAMPLE);
    }
    expanded.push({ template: dyn, url: sampleHref });
  }
  return expanded;
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
  const { static: staticRoutes, dynamic: dynamicTemplates } = await loadRoutes();

  // Pass 1 — warm every static route.
  const t0 = Date.now();
  let slow = 0;
  let fail = 0;
  let auth307 = 0;
  for (const route of staticRoutes) {
    const r = await warmOne(route);
    if (!r.ok) {
      fail++;
      log(`  FAIL ${route} (${r.ms}ms): ${r.err}`);
    } else {
      if (r.status === 307 && jar.size === 0) auth307++;
      const flag = r.ms > 5000 ? "  SLOW" : "";
      if (r.ms > 5000) slow++;
      log(`  ${String(r.status).padStart(3)} ${route} (${r.ms}ms)${flag}`);
    }
  }

  // Pass 2 — warm every dynamic route via a harvested or synthetic
  // sample id. The dynamic page MODULE compiles regardless of the
  // sample's validity, so even a 404 response warms the route tree.
  // This closes the DEF-0014 hole where the user's first click into
  // any /providers/[id], /committee/sessions/[id], etc. paid the full
  // 5–15 second compile cost interactively.
  let dynSlow = 0;
  let dynFail = 0;
  if (dynamicTemplates.length > 0) {
    log(`expanding ${dynamicTemplates.length} dynamic routes…`);
    const expanded = await expandDynamicRoutes(dynamicTemplates);
    for (const { template, url } of expanded) {
      const r = await warmOne(url);
      if (!r.ok) {
        dynFail++;
        log(`  FAIL ${template} via ${url} (${r.ms}ms): ${r.err}`);
      } else {
        const synthetic = url.includes(SYNTHETIC_SAMPLE) ? " (synthetic id)" : "";
        const flag = r.ms > 5000 ? "  SLOW" : "";
        if (r.ms > 5000) dynSlow++;
        log(
          `  ${String(r.status).padStart(3)} ${template} via ${url}${synthetic} (${r.ms}ms)${flag}`,
        );
      }
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const totalRoutes = staticRoutes.length + dynamicTemplates.length;
  const totalSlow = slow + dynSlow;
  const totalFail = fail + dynFail;
  log(
    `done: ${totalRoutes} routes warmed (${staticRoutes.length} static + ${dynamicTemplates.length} dynamic) in ${elapsed}s — ${totalSlow} slow > 5s, ${totalFail} failed${auth307 ? `, ${auth307} unauthenticated 307s` : ""} — clicks should now feel instant`,
  );
}

main().catch((err) => {
  process.stderr.write(`[warm] fatal: ${err.message}\n`);
  // Exit 0 so the dev server keeps running even if warmer hits a transient
  // failure (e.g. seeded admin not yet present after `prisma migrate reset`).
  process.exit(0);
});
