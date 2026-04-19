#!/usr/bin/env node
/**
 * Pillar S — Live-Stack Reality Gate (HTTP-only smoke).
 *
 * BINDING per `docs/qa/STANDARD.md` §2.S and ADR 0028. Validates the
 * DEPLOYED running stack — not the source tree — across six surfaces:
 *
 *   1. Bring-up health: GET /api/health -> 200, services.database === "ok"
 *   2. Migration parity:  delegated to scripts/qa/check-migration-drift.mjs
 *   3. Role sign-in matrix: every STAFF_ROLES entry from tests/e2e/roles.ts
 *      performs the production CSRF + /api/auth/callback/credentials
 *      round-trip; asserts a 302 to a non-/auth/signin URL, the
 *      authjs.session-token cookie set, and /api/auth/session returning
 *      a populated session with the expected user.role.
 *   4. Authenticated session probe: at least one App Router page returns
 *      200 for the admin role with a visible <main>/<h1>/<h2>.
 *   5. Anonymous public-surface invariants: every route-inventory.json
 *      group=="public" non-dynamic entry returns 200 anonymously
 *      (FIRST-response status, no redirect-followed-by-200) AND its
 *      HTML contains a visible <main>/<h1>/<h2>. Spot-checks
 *      /errors/insufficient-scope and /errors/insufficient_scope.
 *   6. Stack-version pin: records the commit SHA of HEAD and the
 *      build manifest mtime in the running container (when --volume-probe
 *      is passed and `docker exec` is reachable).
 *
 * Usage:
 *   node scripts/qa/live-stack-smoke.mjs [--base-url http://localhost:6015]
 *                                        [--volume-probe]
 *                                        [--container ecred-web]
 *                                        [--allow-degraded-db]
 *                                        [--json]
 *
 * Exit codes:
 *   0  — Pillar S green (every required surface passed)
 *   1  — at least one required surface failed
 *   2  — the stack was unreachable (counts as "Pillars not run: S",
 *        which per STANDARD.md §3 is itself a fail of the gate; exit
 *        is non-zero so qa:gate stays red)
 *
 * Anti-weakening (per ADR 0028 §Anti-weakening rules):
 *   - This script MUST NOT swallow ANY failure to a 0 exit code.
 *   - The role list MUST be derived from tests/e2e/roles.ts at runtime.
 *     A hard-coded duplicate in this file is a §4.2 violation.
 *   - Unreachable BASE_URL MUST be reported as "Not Run", not "Skip".
 *   - The first-response status of public routes MUST be checked
 *     (not the final status after following redirects).
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

// ─────────────────────────────────────────────────────────────────────────────
// CLI argument parsing (deliberately tiny — no dep on commander/yargs).
// ─────────────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
function flag(name, fallback = undefined) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

const BASE_URL = (flag("--base-url") ?? process.env.BASE_URL ?? "http://localhost:6015").replace(/\/+$/, "");
const VOLUME_PROBE = flag("--volume-probe") === true;
const CONTAINER = flag("--container") ?? "ecred-web";
const ALLOW_DEGRADED_DB = flag("--allow-degraded-db") === true;
const JSON_OUT = flag("--json") === true;
// Surface 7 — dev-loop perf invariant. Off by default so CI (which
// runs against a prod build where every route is pre-compiled) doesn't
// re-time things that aren't comparable. Pass --dev-perf to enable
// when probing a `next dev` instance — fails the gate if any
// already-warmed route exceeds DEV_PERF_BUDGET_MS on a re-fetch
// (the regression signal for DEF-0014: lazy compile back).
const DEV_PERF = flag("--dev-perf") === true;
const DEV_PERF_BUDGET_MS = Number(flag("--dev-perf-budget") ?? 2000);

// ─────────────────────────────────────────────────────────────────────────────
// Reporting helpers.
// ─────────────────────────────────────────────────────────────────────────────
const findings = [];
function record(surface, name, status, detail) {
  findings.push({ surface, name, status, detail });
  if (!JSON_OUT) {
    const tag =
      status === "pass" ? "  PASS" :
      status === "fail" ? "  FAIL" :
      status === "warn" ? "  WARN" :
      "  NOTRUN";
    // eslint-disable-next-line no-console
    console.log(`${tag} [S.${surface}] ${name}${detail ? "  — " + detail : ""}`);
  }
}

function headline() {
  const counts = findings.reduce((acc, f) => {
    acc[f.status] = (acc[f.status] ?? 0) + 1;
    return acc;
  }, {});
  return {
    pass: counts.pass ?? 0,
    fail: counts.fail ?? 0,
    warn: counts.warn ?? 0,
    notrun: counts.notrun ?? 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Role-registry loader. Anti-weakening rule 4: source of truth is
// `tests/e2e/roles.ts`; we PARSE it at runtime, never duplicate it.
// ─────────────────────────────────────────────────────────────────────────────
function loadStaffRoles() {
  const rolesTs = join(REPO_ROOT, "tests", "e2e", "roles.ts");
  const src = readFileSync(rolesTs, "utf8");

  // Find the ROLES = [ ... ] literal. We deliberately use a permissive
  // multiline match and then walk fields by regex per role-object,
  // because pulling in the TypeScript compiler for one literal would
  // mean every contributor running this script needs typescript installed.
  const arrMatch = src.match(/export const ROLES[^=]*=\s*\[\s*([\s\S]*?)\n\];/);
  if (!arrMatch) {
    throw new Error(
      `live-stack-smoke: could not parse ROLES from ${rolesTs}. ` +
      `Did the export shape change? Anti-weakening rule 4 (ADR 0028) requires ` +
      `this script to read tests/e2e/roles.ts directly; do NOT duplicate the ` +
      `role list inline.`
    );
  }
  const body = arrMatch[1];

  // Each role is a { ... } block at brace-depth 1.
  const roleObjects = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (c === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        roleObjects.push(body.slice(start + 1, i));
        start = -1;
      }
    }
  }

  const fieldRe = (key) =>
    new RegExp(`\\b${key}\\s*:\\s*(?:"([^"]*)"|'([^']*)'|null)`);

  const roles = roleObjects.map((obj) => {
    const id = obj.match(fieldRe("id"));
    const prismaRole = obj.match(fieldRe("prismaRole"));
    const email = obj.match(fieldRe("email"));
    const password = obj.match(fieldRe("password"));
    const homeRoute = obj.match(fieldRe("homeRoute"));
    return {
      id: id ? id[1] ?? id[2] : null,
      prismaRole: prismaRole ? prismaRole[1] ?? prismaRole[2] : null,
      email: email ? email[1] ?? email[2] : null,
      password: password ? password[1] ?? password[2] : null,
      homeRoute: homeRoute ? homeRoute[1] ?? homeRoute[2] : null,
    };
  });

  // STAFF_ROLES = roles with credentials (email + password). Provider is
  // token-auth and is exercised separately by Pillar D.
  const staff = roles.filter((r) => r.email && r.password);
  if (staff.length === 0) {
    throw new Error(
      "live-stack-smoke: parsed 0 staff roles from tests/e2e/roles.ts. Anti-weakening tripwire."
    );
  }
  return staff;
}

// ─────────────────────────────────────────────────────────────────────────────
// Cookie-jar helpers (NextAuth needs the csrf cookie sent with the callback).
// ─────────────────────────────────────────────────────────────────────────────
function jarFromSetCookie(setCookieHeader) {
  // Node's fetch returns Set-Cookie either as a single comma-joined string
  // (older shape) or as multiple headers via Headers.getSetCookie().
  // We only need name=value; we drop attributes (Path, HttpOnly, etc.).
  const lines = Array.isArray(setCookieHeader)
    ? setCookieHeader
    : (setCookieHeader ?? "").split(/,(?=\s*[A-Za-z0-9_.-]+=)/);
  const jar = new Map();
  for (const line of lines) {
    if (!line) continue;
    const head = line.split(";")[0]?.trim();
    if (!head) continue;
    const eq = head.indexOf("=");
    if (eq <= 0) continue;
    const name = head.slice(0, eq);
    const value = head.slice(eq + 1);
    jar.set(name, value);
  }
  return jar;
}

function jarToHeader(jar) {
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function mergeJar(jar, more) {
  for (const [k, v] of more.entries()) jar.set(k, v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 1 — Bring-up health.
// ─────────────────────────────────────────────────────────────────────────────
async function surfaceHealth() {
  const url = `${BASE_URL}/api/health`;
  let res;
  try {
    res = await fetch(url, { redirect: "manual" });
  } catch (e) {
    record("1.health", url, "fail", `unreachable: ${e.message}`);
    return false;
  }
  if (res.status !== 200) {
    record("1.health", url, "fail", `expected 200, got ${res.status}`);
    return false;
  }
  let body;
  try {
    body = await res.json();
  } catch {
    record("1.health", url, "fail", "response was not JSON");
    return false;
  }
  if (body?.services?.database !== "ok") {
    if (ALLOW_DEGRADED_DB) {
      record("1.health", url, "warn",
        `database service reported ${body?.services?.database ?? "unknown"} (allowed by --allow-degraded-db)`);
    } else {
      record("1.health", url, "fail",
        `services.database = ${body?.services?.database ?? "unknown"} (expected "ok")`);
      return false;
    }
  }
  record("1.health", url, "pass", `status=${body.status} env=${body.environment}`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 3 — Role sign-in matrix.
// ─────────────────────────────────────────────────────────────────────────────
async function signInOnce(role) {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`, { redirect: "manual" });
  if (csrfRes.status !== 200) {
    return { ok: false, reason: `csrf endpoint returned ${csrfRes.status}` };
  }
  const csrfCookies = jarFromSetCookie(
    csrfRes.headers.getSetCookie ? csrfRes.headers.getSetCookie() : csrfRes.headers.get("set-cookie")
  );
  const { csrfToken } = await csrfRes.json();
  if (!csrfToken) return { ok: false, reason: "csrf endpoint did not return csrfToken" };

  const form = new URLSearchParams({
    csrfToken,
    email: role.email,
    password: role.password,
    callbackUrl: `${BASE_URL}${role.homeRoute || "/dashboard"}`,
    json: "true",
  });

  const callbackRes = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: jarToHeader(csrfCookies),
    },
    body: form.toString(),
    redirect: "manual",
  });

  // NextAuth v5 returns 302 on success. A 302 to /auth/signin?error=... is a
  // FAIL even though the status code is 302 — we read Location.
  const location = callbackRes.headers.get("location") ?? "";
  if (callbackRes.status !== 302) {
    return { ok: false, reason: `callback returned ${callbackRes.status} (expected 302)` };
  }
  if (location.includes("/auth/signin")) {
    const errMatch = location.match(/[?&]error=([^&]+)/);
    return {
      ok: false,
      reason: `redirected back to signin (error=${errMatch ? decodeURIComponent(errMatch[1]) : "unknown"})`,
    };
  }
  const callbackCookies = jarFromSetCookie(
    callbackRes.headers.getSetCookie ? callbackRes.headers.getSetCookie() : callbackRes.headers.get("set-cookie")
  );
  mergeJar(csrfCookies, callbackCookies);
  if (!csrfCookies.has("authjs.session-token") && !csrfCookies.has("__Secure-authjs.session-token")) {
    return { ok: false, reason: "no authjs.session-token cookie issued" };
  }

  const sessionRes = await fetch(`${BASE_URL}/api/auth/session`, {
    headers: { cookie: jarToHeader(csrfCookies) },
    redirect: "manual",
  });
  if (sessionRes.status !== 200) {
    return { ok: false, reason: `/api/auth/session returned ${sessionRes.status}` };
  }
  const session = await sessionRes.json();
  if (!session?.user?.role) {
    return { ok: false, reason: `/api/auth/session has no user.role: ${JSON.stringify(session)}` };
  }
  if (session.user.role !== role.prismaRole) {
    return {
      ok: false,
      reason: `expected user.role=${role.prismaRole}, got ${session.user.role}`,
    };
  }
  return { ok: true, jar: csrfCookies, session };
}

async function surfaceRoleMatrix(roles) {
  const results = new Map();
  let allGreen = true;
  for (const role of roles) {
    let r;
    try {
      r = await signInOnce(role);
    } catch (e) {
      r = { ok: false, reason: `threw: ${e.message}` };
    }
    results.set(role.id, r);
    if (r.ok) {
      record("3.signin", `${role.id} (${role.email})`, "pass",
        `landed on ${role.homeRoute || "/dashboard"}; user.role=${r.session.user.role}`);
    } else {
      record("3.signin", `${role.id} (${role.email})`, "fail", r.reason);
      allGreen = false;
    }
  }
  return { allGreen, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 4 — Authenticated session probe (admin only — at least one).
// ─────────────────────────────────────────────────────────────────────────────
async function surfaceAuthedProbe(adminJar, route = "/dashboard") {
  if (!adminJar) {
    record("4.authed", route, "notrun", "admin sign-in did not produce a cookie jar");
    return false;
  }
  const res = await fetch(`${BASE_URL}${route}`, {
    headers: { cookie: jarToHeader(adminJar) },
    redirect: "manual",
  });
  if (res.status !== 200) {
    record("4.authed", route, "fail", `expected 200, got ${res.status}`);
    return false;
  }
  const html = await res.text();
  if (!/<main\b/i.test(html) || !/<h[12]\b/i.test(html)) {
    record("4.authed", route, "fail",
      `200 but page shape missing (<main>=${/<main\b/i.test(html)}, <h1|h2>=${/<h[12]\b/i.test(html)})`);
    return false;
  }
  record("4.authed", route, "pass", `200 with <main> and <h1|h2>`);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 5 — Anonymous public-surface invariants.
// ─────────────────────────────────────────────────────────────────────────────
async function surfaceAnonymous() {
  const invPath = join(REPO_ROOT, "docs", "qa", "inventories", "route-inventory.json");
  if (!existsSync(invPath)) {
    record("5.public", "route-inventory.json", "notrun",
      `not found at ${invPath}; run \`npm run qa:inventory\` first`);
    return false;
  }
  const inv = JSON.parse(readFileSync(invPath, "utf8"));
  const publicStatic = inv.filter((r) => r.group === "public" && !r.dynamic);
  if (publicStatic.length === 0) {
    record("5.public", "route-inventory.json", "fail",
      "0 public non-dynamic routes — anti-over-filtering tripwire");
    return false;
  }

  let allGreen = true;
  for (const route of publicStatic) {
    // Skip /auth/signin and /auth/register — they LEGITIMATELY render a
    // form and may not have a separate <h1>; we check status only.
    const url = `${BASE_URL}${route.route}`;
    const res = await fetch(url, { redirect: "manual" });
    if (res.status !== 200) {
      record("5.public", route.route, "fail",
        `expected 200, got ${res.status} (Location: ${res.headers.get("location") ?? "—"})`);
      allGreen = false;
      continue;
    }
    if (!route.route.startsWith("/auth/")) {
      const html = await res.text();
      if (!/<main\b/i.test(html) || !/<h[12]\b/i.test(html)) {
        record("5.public", route.route, "fail",
          `200 but blank-shell shape (<main>=${/<main\b/i.test(html)}, <h1|h2>=${/<h[12]\b/i.test(html)})`);
        allGreen = false;
        continue;
      }
    }
    record("5.public", route.route, "pass", "200 + page shape ok");
  }

  // Spot-checks for the dynamic /errors/[code] route — both casings.
  for (const code of ["insufficient-scope", "insufficient_scope"]) {
    const url = `${BASE_URL}/errors/${code}`;
    const res = await fetch(url, { redirect: "manual" });
    if (res.status !== 200) {
      record("5.public", `/errors/${code}`, "fail",
        `expected 200, got ${res.status} (Location: ${res.headers.get("location") ?? "—"})`);
      allGreen = false;
      continue;
    }
    record("5.public", `/errors/${code}`, "pass", "200 (DEF-0007 invariant)");
  }

  // Public API artifact spot-checks — these aren't App Router pages
  // (they don't have a <main> landmark) but they ARE part of the
  // commercial public surface: the customer journey on /sandbox
  // links to all four. A 500 here breaks the public-API value
  // proposition. Validates content type + non-empty body to catch
  // the DEF-0012 class (silently empty docs/) and the DEF-0013
  // class (Next.js public-vs-route URL collision).
  const apiArtifacts = [
    { url: "/api/v1/openapi.json",  ctype: /^application\/json/, minBytes: 10000 },
    { url: "/api/v1/openapi.yaml",  ctype: /^application\/yaml|^text\/yaml/, minBytes: 10000 },
    { url: "/api/v1/postman.json",  ctype: /^application\/json/, minBytes: 5000 },
    { url: "/changelog.rss",        ctype: /^application\/rss\+xml/, minBytes: 500 },
  ];
  for (const probe of apiArtifacts) {
    const url = `${BASE_URL}${probe.url}`;
    let res;
    try {
      res = await fetch(url, { redirect: "manual" });
    } catch (e) {
      record("5.public", probe.url, "fail", `fetch threw: ${e.message}`);
      allGreen = false;
      continue;
    }
    if (res.status !== 200) {
      record("5.public", probe.url, "fail",
        `expected 200, got ${res.status} (DEF-0012/0013 class: docs/ excluded from image OR public-vs-route URL collision)`);
      allGreen = false;
      continue;
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (!probe.ctype.test(ctype)) {
      record("5.public", probe.url, "fail",
        `wrong Content-Type: got "${ctype}", expected match ${probe.ctype}`);
      allGreen = false;
      continue;
    }
    const body = await res.text();
    if (body.length < probe.minBytes) {
      record("5.public", probe.url, "fail",
        `body suspiciously small (${body.length} bytes < ${probe.minBytes}); empty-artifact tripwire`);
      allGreen = false;
      continue;
    }
    record("5.public", probe.url, "pass",
      `200 ${ctype.split(";")[0]} (${body.length} bytes)`);
  }

  return allGreen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 6 — Stack-version pin (best-effort; --volume-probe to enable).
// ─────────────────────────────────────────────────────────────────────────────
function surfaceVersionPin() {
  let head = "(unknown)";
  try {
    head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: REPO_ROOT, encoding: "utf8" }).trim();
  } catch {
    record("6.version", "git HEAD", "warn", "could not read git HEAD");
  }
  record("6.version", "git HEAD", "pass", head);

  if (!VOLUME_PROBE) {
    record("6.version", "container probe", "notrun",
      "pass --volume-probe to introspect the running container's prisma client + .next manifest");
    return;
  }

  // Compare the host's GENERATED prisma client schema to the
  // container's GENERATED prisma client schema (both at
  // `node_modules/.prisma/client/schema.prisma`, which is the
  // normalized post-`prisma generate` representation). When they
  // diverge the named `ecred_web_node_modules` volume is shadowing
  // a stale prisma client — exactly the DEF-0009 failure mode.
  //
  // Why NOT compare host `prisma/schema.prisma` (source) to
  // container `node_modules/.prisma/client/schema.prisma` (generated):
  // prisma reformats the source on generate (header/footer comments,
  // generator block normalization, whitespace), so source vs
  // generated is APPLES-TO-ORANGES and would always false-positive.
  // The two generated copies, however, are byte-identical when both
  // were produced from the same source by the same prisma version.
  //
  // When the host has no `node_modules/` (clean CI checkout, or
  // someone ran `npm prune` recently), this surface degrades to
  // a NOTRUN with a clear remediation hint instead of a false fail.
  const hostClientPath = join(REPO_ROOT, "node_modules", ".prisma", "client", "schema.prisma");
  let onDiskHash = "";
  if (existsSync(hostClientPath)) {
    try {
      const sch = readFileSync(hostClientPath, "utf8");
      onDiskHash = createHash("sha1").update(sch).digest("hex").slice(0, 12);
    } catch (e) {
      record("6.version", "host prisma client", "warn", e.message);
      return;
    }
  } else {
    record("6.version", "named-volume staleness", "notrun",
      "host has no node_modules/.prisma/client/ — run `npm install` on the host first to enable host↔container drift comparison");
    return;
  }
  let containerHash = "";
  try {
    const out = execFileSync("docker", [
      "exec", CONTAINER,
      "sh", "-c",
      "test -f /app/node_modules/.prisma/client/schema.prisma && sha1sum /app/node_modules/.prisma/client/schema.prisma | awk '{print $1}' || echo MISSING",
    ], { encoding: "utf8" }).trim();
    containerHash = out.length >= 12 ? out.slice(0, 12) : "MISSING";
  } catch (e) {
    record("6.version", "container schema.prisma sha1", "warn",
      `docker exec failed: ${e.message}`);
    return;
  }
  if (containerHash === "MISSING") {
    record("6.version", "container prisma client", "fail",
      "running container has no node_modules/.prisma/client/schema.prisma — fresh build never landed");
    return;
  }
  if (containerHash !== onDiskHash) {
    record("6.version", "named-volume staleness", "fail",
      `container generated client sha1=${containerHash} vs host generated client sha1=${onDiskHash}; ` +
      `the named ecred_web_node_modules volume is shadowing a stale prisma client (DEF-0009 class). ` +
      `Fix: \`docker compose -f docker-compose.dev.yml exec ecred-web npx prisma generate\` to regenerate inside the container, ` +
      `OR \`docker volume rm e_credentialing_ecred_web_node_modules e_credentialing_ecred_web_next_cache && docker compose -f docker-compose.dev.yml up -d ecred-web\` for a fresh install.`);
  } else {
    record("6.version", "named-volume staleness", "pass",
      `host & container prisma client schema.prisma sha1=${containerHash} match — no DEF-0009-class drift`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Surface 7 — Dev-loop performance invariant (DEF-0014 regression detector).
//
// Once the dev warmer has run, every static route in the inventory MUST
// respond in <DEV_PERF_BUDGET_MS on a re-fetch. If any exceeds the budget
// it means either (a) Turbopack is off and webpack is back on, or (b) the
// warmer didn't run (or failed silently), or (c) the .next compile cache
// was invalidated and never re-warmed. All three are DEF-0014 classes
// and should fail Pillar S so the regression is visible immediately.
//
// Off by default (--dev-perf to enable) because:
//   - CI runs against a prod build where every route is pre-compiled at
//     build time — re-timing routes there isn't comparable to dev.
//   - Local dev runs may legitimately invalidate compile cache between
//     gate runs (HMR after editing the warmed-route module). Flagging
//     this only when the user explicitly opts in keeps the gate honest
//     without turning every routine `qa:live-stack` red.
//
// When enabled, picks 5 deterministic routes (first 5 in inventory order)
// + the dashboard, fetches each twice (warm-up then measured), and fails
// on any measured fetch >budget. The first fetch is discarded so we
// measure cache hit, not cold compile.
// ─────────────────────────────────────────────────────────────────────────────
async function surfaceDevPerf(adminJar) {
  if (!DEV_PERF) {
    record("7.devperf", "dev-loop perf invariant", "notrun",
      `pass --dev-perf to enable (regression detector for DEF-0014 — webpack-instead-of-turbopack OR warmer-skipped OR cache-invalidated)`);
    return;
  }

  const invPath = join(REPO_ROOT, "docs", "qa", "inventories", "route-inventory.json");
  if (!existsSync(invPath)) {
    record("7.devperf", "route-inventory.json", "notrun",
      `not found at ${invPath}; run \`npm run qa:inventory\` first`);
    return;
  }
  const inv = JSON.parse(readFileSync(invPath, "utf8"));

  // Pick a deterministic mix: the first 4 static staff routes (the
  // module-tree the user most commonly clicks into) + the homepage +
  // /dashboard. Skip dynamic routes — those need a sample id we can't
  // fabricate inside this script without depending on the warmer's
  // harvest logic.
  const staffRoutes = inv
    .filter((r) => r.group === "staff" && !r.dynamic)
    .slice(0, 4)
    .map((r) => r.route);
  const probeUrls = ["/", "/dashboard", ...staffRoutes];

  if (!adminJar || adminJar.size === 0) {
    record("7.devperf", "admin session", "notrun",
      "no admin session cookie available — Surface 3 sign-in must succeed first");
    return;
  }

  // Use the admin role's session jar so staff routes don't 307 to signin.
  const cookieHeader = [...adminJar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");

  let allGreen = true;
  for (const url of probeUrls) {
    // Discard fetch (warm the cache).
    try {
      await fetch(`${BASE_URL}${url}`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      });
    } catch {
      // ignore — measured fetch will surface the failure
    }
    // Measured fetch.
    const t0 = Date.now();
    let res;
    try {
      res = await fetch(`${BASE_URL}${url}`, {
        headers: { cookie: cookieHeader },
        redirect: "manual",
      });
    } catch (e) {
      record("7.devperf", url, "fail", `fetch threw: ${e.message}`);
      allGreen = false;
      continue;
    }
    const ms = Date.now() - t0;
    // 2xx + 3xx are both acceptable here; we're measuring compile, not
    // semantic correctness (Surface 5 covers that).
    if (res.status >= 500) {
      record("7.devperf", url, "fail", `HTTP ${res.status} (${ms}ms)`);
      allGreen = false;
      continue;
    }
    if (ms > DEV_PERF_BUDGET_MS) {
      record("7.devperf", url, "fail",
        `${ms}ms > ${DEV_PERF_BUDGET_MS}ms budget — DEF-0014 regression. ` +
        `Either Turbopack is off (check \`docker compose logs ecred-web | grep -i turbopack\`), ` +
        `the warmer did not run (check for "[warm] done:" in container logs), ` +
        `or the .next cache was invalidated since last warm. ` +
        `Force a re-warm with \`docker compose -f docker-compose.dev.yml exec ecred-web node scripts/dev/warm-routes.mjs\`.`);
      allGreen = false;
      continue;
    }
    record("7.devperf", url, "pass", `${ms}ms ≤ ${DEV_PERF_BUDGET_MS}ms`);
  }
  return allGreen;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main.
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  if (!JSON_OUT) {
    // eslint-disable-next-line no-console
    console.log(`
=============================================================================
 Pillar S — Live-Stack Reality Gate
 BASE_URL: ${BASE_URL}
 Container probe: ${VOLUME_PROBE ? `enabled (container=${CONTAINER})` : "disabled (pass --volume-probe to enable)"}
 (binding per docs/qa/STANDARD.md §2.S; ADR 0028)
=============================================================================
`);
  }

  // Bring-up health is the gate for everything else. If the stack isn't
  // up, we report "Not Run" per STANDARD.md §3 and exit 2 — qa:gate stays
  // red.
  const healthOk = await surfaceHealth();
  if (!healthOk) {
    record("0.notrun", "Pillar S", "notrun",
      `BASE_URL ${BASE_URL} not reachable. Bring the stack up:\n` +
      `    docker compose -f docker-compose.dev.yml up -d ecred-web\n` +
      `Then rerun: npm run qa:live-stack`);
    if (JSON_OUT) console.log(JSON.stringify({ findings, headline: headline() }, null, 2));
    process.exit(2);
  }

  // Surfaces 3 + 4: role matrix, then admin-authenticated page.
  const roles = loadStaffRoles();
  if (!JSON_OUT) {
    // eslint-disable-next-line no-console
    console.log(`  loaded ${roles.length} staff roles from tests/e2e/roles.ts: ${roles.map((r) => r.id).join(", ")}\n`);
  }
  const matrix = await surfaceRoleMatrix(roles);
  const adminResult = matrix.results.get("admin");
  await surfaceAuthedProbe(adminResult?.jar, "/dashboard");

  // Surface 5: anonymous public surfaces.
  await surfaceAnonymous();

  // Surface 6: stack-version pin.
  surfaceVersionPin();

  // Surface 7: dev-loop performance invariant (DEF-0014). Off by
  // default; enable with --dev-perf when probing a `next dev` instance.
  await surfaceDevPerf(adminResult?.jar);

  const h = headline();
  if (!JSON_OUT) {
    // eslint-disable-next-line no-console
    console.log(`
-----------------------------------------------------------------------------
  pass=${h.pass}  fail=${h.fail}  warn=${h.warn}  notrun=${h.notrun}
-----------------------------------------------------------------------------
`);
  } else {
    console.log(JSON.stringify({ findings, headline: h }, null, 2));
  }

  if (h.fail > 0 || h.notrun > 0) {
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("live-stack-smoke: unhandled error:", e);
  process.exit(1);
});
