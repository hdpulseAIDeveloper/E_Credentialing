#!/usr/bin/env node
/**
 * Pillar S — Dockerfile cold-build sanity gate.
 *
 * BINDING per `docs/qa/STANDARD.md` §4 hard-fail (13) and ADR 0028.
 *
 * Two modes:
 *   default (fast)     — runs `docker compose ... config -q` for every
 *                        compose file. Catches yaml errors, undefined
 *                        env, image:/build: drift. ~1 s.
 *   --cold (thorough)  — additionally runs `docker compose ... build
 *                        --no-cache <service>` for every service in
 *                        every compose file. Catches Dockerfile
 *                        ordering bugs (the prisma-postinstall finding
 *                        a schema that has not been copied yet, missing
 *                        runtime deps, etc.) that named-volume-shadowed
 *                        dev rebuilds can hide for weeks. ~5–10 min.
 *
 * Usage:
 *   node scripts/qa/check-dockerfile-build.mjs           # fast lint
 *   node scripts/qa/check-dockerfile-build.mjs --cold    # full rebuild
 *
 * Exit codes:
 *   0 — every compose file lints (and, in --cold mode, every service builds)
 *   1 — at least one failure
 *   2 — docker / docker-compose not on PATH (counts as Not Run)
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const argv = process.argv.slice(2);
const COLD = argv.includes("--cold");

console.log("=============================================================================");
console.log(" Pillar S — Dockerfile cold-build sanity gate");
console.log(` Mode: ${COLD ? "--cold (full rebuild)" : "config-lint only (pass --cold for full rebuild)"}`);
console.log(" (binding per docs/qa/STANDARD.md §4 (13); ADR 0028)");
console.log("=============================================================================\n");

// Pre-flight: docker on PATH?
const probe = spawnSync("docker", ["version", "--format", "{{.Client.Version}}"], { encoding: "utf8" });
if (probe.status !== 0) {
  console.error("NOTRUN — docker not on PATH or daemon unreachable.");
  console.error("         Per STANDARD.md §3, Not Run on a covered pillar fails the gate.");
  process.exit(2);
}

const COMPOSE_FILES = [
  {
    file: "docker-compose.dev.yml",
    services: ["ecred-web", "ecred-worker"],
    requiresEnv: false, // dev compose has inlined defaults
  },
  {
    file: "docker-compose.prod.yml",
    services: ["ecred-web-prod", "ecred-worker-prod"],
    requiresEnv: true, // prod compose pulls every secret from .env (or .env.prod.fake)
  },
];

// Pillar S Surface 6 hardening (post-DEF-0015 / DEF-0016):
//   When the developer doesn't have a real .env locally — which is the
//   default for everybody who isn't a deploy operator — the gate used
//   to degrade to NOTRUN and silently skip the prod cold build. That's
//   exactly how DEF-0015 (worker tsconfig pulled @t3-oss/env-nextjs)
//   and DEF-0016 (next build rejected literal "placeholder" strings)
//   shipped to the deploy step. We now fall back to .env.prod.fake
//   (committed; obviously fake values; passes Zod validation but
//   never authenticates anything) so the cold build runs end-to-end
//   on every machine. The fake env is loud-by-design: the gate prints
//   "USING FAKE ENV" so nobody mistakes the run for a real-secret build.
const REAL_ENV = resolve(REPO_ROOT, ".env");
const FAKE_ENV = resolve(REPO_ROOT, ".env.prod.fake");
const FAKE_ENV_OVERRIDE = "docker-compose.prod.fake-env.yml";

let failures = 0;
// Surface 6 hardening: NOTRUN is no longer reachable for prod compose
// because we now always have either .env or .env.prod.fake. The variable
// is kept at 0 as a defensive guard against future regressions.
const notrun = 0;

for (const { file, services, requiresEnv } of COMPOSE_FILES) {
  const path = resolve(REPO_ROOT, file);
  if (!existsSync(path)) {
    console.warn(`  SKIP  ${file} — not found`);
    continue;
  }

  // Resolve which env file to pass to docker compose for this run.
  let envFile = null;
  let envSource = "(inlined defaults in compose)";
  let useFakeEnvOverride = false;
  if (requiresEnv) {
    if (existsSync(REAL_ENV)) {
      envFile = REAL_ENV;
      envSource = ".env (real)";
    } else if (existsSync(FAKE_ENV)) {
      envFile = FAKE_ENV;
      envSource = ".env.prod.fake (USING FAKE ENV — Pillar S Surface 6 hardening)";
      useFakeEnvOverride = true;
    } else {
      console.error(
        `  FAIL  ${file} — neither .env nor .env.prod.fake present.\n` +
          `         Per STANDARD.md §4 hard-fail (13), the prod cold-build gate cannot\n` +
          `         silently NOTRUN. Restore .env.prod.fake (committed to the repo) or\n` +
          `         provide a real .env, then re-run.`,
      );
      failures += 1;
      continue;
    }
    console.log(`  ENV   ${file} — using ${envSource}`);
  }

  // docker compose CLI: --env-file controls ${VAR} interpolation; the
  // override compose file (docker-compose.prod.fake-env.yml) is the
  // mechanism that swaps the runtime `env_file:` directive itself
  // (which --env-file alone cannot do).
  const composePrefix = envFile
    ? [
        "compose",
        "--env-file",
        envFile,
        "-f",
        file,
        ...(useFakeEnvOverride ? ["-f", FAKE_ENV_OVERRIDE] : []),
      ]
    : ["compose", "-f", file];

  // 1. config lint
  const lint = spawnSync("docker", [...composePrefix, "config", "-q"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  });
  if (lint.status !== 0) {
    console.error(`  FAIL  ${file} — config lint:\n${lint.stderr || lint.stdout}`);
    failures += 1;
    continue;
  }
  console.log(`  PASS  ${file} — config lint clean`);

  if (!COLD) continue;

  // 2. cold rebuild
  for (const svc of services) {
    const t0 = Date.now();
    process.stdout.write(`  RUN   ${file} :: ${svc} — docker compose build --no-cache ... `);
    const build = spawnSync(
      "docker",
      [...composePrefix, "build", "--no-cache", svc],
      { cwd: REPO_ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 * 50 },
    );
    const elapsed = Math.round((Date.now() - t0) / 1000);
    if (build.status !== 0) {
      console.error(`FAIL (${elapsed}s)\n`);
      // Print only the last 40 lines of stderr/stdout to stay readable.
      const tail = (build.stderr || build.stdout || "").split("\n").slice(-40).join("\n");
      console.error(tail);
      failures += 1;
    } else {
      console.log(`PASS (${elapsed}s)`);
    }
  }
}

console.log();
if (failures > 0 || notrun > 0) {
  console.error(`FAIL — ${failures} compose / build failure(s); ${notrun} not-run.`);
  process.exit(1);
}
console.log("PASS — all compose files lint" + (COLD ? " AND all app services rebuild from scratch." : "."));
console.log(COLD ? "" : "(Pass --cold to run a full rebuild — slower but catches Dockerfile ordering bugs.)");
process.exit(0);
