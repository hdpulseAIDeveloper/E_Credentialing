#!/usr/bin/env node
/**
 * Pillar S — Schema / migration parity gate.
 *
 * BINDING per `docs/qa/STANDARD.md` §4 hard-fail (11) and ADR 0028.
 *
 * Wraps `prisma migrate status` against the live database. Fails on:
 *   - any pending migration ("following migrations have not yet been applied")
 *   - any drift detected ("drift detected", "database schema is not in sync")
 *   - any failure to connect (timeout, ECONNREFUSED, P1001, P1003)
 *
 * Anti-weakening (per ADR 0028 §Anti-weakening 3): a connection failure
 * is NOT "no pending migrations". It is "Not Run" — and per
 * STANDARD.md §3 that fails the gate. We exit non-zero in BOTH cases.
 *
 * Usage:
 *   node scripts/qa/check-migration-drift.mjs
 *   node scripts/qa/check-migration-drift.mjs --container ecred-web   # exec inside running container
 *
 * Exit codes:
 *   0 — zero pending, zero drift
 *   1 — pending migrations, drift, or connection failure
 */

import { execFileSync, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
function flag(name, fallback = undefined) {
  const i = argv.indexOf(name);
  if (i === -1) return fallback;
  const next = argv[i + 1];
  return next && !next.startsWith("--") ? next : true;
}

let CONTAINER = flag("--container") ?? null;
const NO_AUTO_CONTAINER = argv.includes("--no-auto-container");

// Auto-delegate to the dev container when the host has no DATABASE_URL.
// In this codebase the dev DB only exists inside the docker-compose stack
// (Postgres is a service, not a local install). Per ADR 0028 §Anti-weakening
// rule 3, "no connection ≠ no pending"; the right behavior is to actually
// probe the live DB rather than silently no-op. This auto-delegation does
// NOT widen the contract — it just routes the same `prisma migrate status`
// call through the place where the env vars actually live. Pass
// `--no-auto-container` to disable the fallback in CI shapes where the host
// owns DATABASE_URL.
if (!CONTAINER && !process.env.DATABASE_URL && !NO_AUTO_CONTAINER) {
  CONTAINER = "ecred-web";
  console.log(`(auto) DATABASE_URL not set on host; delegating to docker exec inside '${CONTAINER}'`);
  console.log(`(auto) pass --no-auto-container to disable this fallback\n`);
}

console.log("=============================================================================");
console.log(" Pillar S — Schema / migration parity gate");
console.log(` Mode: ${CONTAINER ? `docker exec inside ${CONTAINER}` : "host npx prisma"}`);
console.log(" (binding per docs/qa/STANDARD.md §4 (11); ADR 0028)");
console.log("=============================================================================\n");

let stdout = "";
let stderr = "";
let code = 1;
try {
  if (CONTAINER) {
    const r = spawnSync(
      "docker",
      ["compose", "-f", "docker-compose.dev.yml", "exec", "-T", CONTAINER, "npx", "prisma", "migrate", "status"],
      { cwd: REPO_ROOT, encoding: "utf8" },
    );
    stdout = r.stdout ?? "";
    stderr = r.stderr ?? "";
    code = r.status ?? 1;
  } else {
    const r = spawnSync("npx", ["prisma", "migrate", "status"], {
      cwd: REPO_ROOT,
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    stdout = r.stdout ?? "";
    stderr = r.stderr ?? "";
    code = r.status ?? 1;
  }
} catch (e) {
  console.error("FAIL — could not invoke prisma migrate status:", e.message);
  console.error('       (anti-weakening rule 3: "no connection ≠ no pending"; gate stays red.)');
  process.exit(1);
}

const combined = stdout + "\n" + stderr;

const PENDING_RE = /following migrations? have not yet been applied|prisma migrate deploy\b/i;
const DRIFT_RE = /drift detected|database schema is not in sync/i;
const NOCONN_RE = /can'?t reach database server|P1001|P1003|ECONNREFUSED|timeout/i;

if (NOCONN_RE.test(combined)) {
  console.error(combined);
  console.error("\nFAIL — could not reach the database (P1001/P1003/ECONNREFUSED/timeout).");
  console.error("       Per ADR 0028 §Anti-weakening 3, no-connection counts as Not Run,");
  console.error("       which per STANDARD.md §3 is a fail of the gate.");
  console.error("       Bring the database container up and rerun.");
  process.exit(1);
}

if (DRIFT_RE.test(combined)) {
  console.error(combined);
  console.error("\nFAIL — schema drift detected between prisma/schema.prisma and the live database.");
  console.error("       Resolve with: npx prisma migrate diff / dev / resolve, then rerun.");
  process.exit(1);
}

if (PENDING_RE.test(combined)) {
  console.error(combined);
  console.error("\nFAIL — pending migrations against the live database.");
  console.error("       Apply with:");
  console.error("         npx prisma migrate deploy            (production)");
  console.error("         npm run db:migrate                   (dev — interactive)");
  console.error("       In docker:");
  console.error(`         docker compose -f docker-compose.dev.yml exec ${CONTAINER ?? "ecred-web"} npx prisma migrate deploy`);
  process.exit(1);
}

if (code !== 0) {
  console.error(combined);
  console.error(`\nFAIL — prisma migrate status exited ${code} without a recognized failure pattern.`);
  console.error("       Treat as drift; investigate the output above.");
  process.exit(1);
}

console.log(stdout);
console.log("\nPASS — zero pending migrations; zero drift detected.");
process.exit(0);
