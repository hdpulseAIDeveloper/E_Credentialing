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
    requiresEnv: true, // prod compose pulls every secret from .env
  },
];

let failures = 0;
let notrun = 0;

for (const { file, services, requiresEnv } of COMPOSE_FILES) {
  const path = resolve(REPO_ROOT, file);
  if (!existsSync(path)) {
    console.warn(`  SKIP  ${file} — not found`);
    continue;
  }

  // Pre-flight: prod compose needs a real .env. We do NOT auto-create one
  // (anti-weakening — the absence of .env is itself a setup signal that
  // belongs in front of the contributor, not silently substituted). Per
  // STANDARD.md §3, this is "Not Run" → fails the gate.
  if (requiresEnv && !existsSync(resolve(REPO_ROOT, ".env"))) {
    console.warn(
      `  NOTRUN ${file} — requires .env (16+ secrets). Create .env from .env.example or run with --skip-prod to defer.\n` +
      `         Per STANDARD.md §3, "Not Run on a covered pillar counts as a fail of the gate."`,
    );
    if (argv.includes("--skip-prod")) {
      console.warn(`         (--skip-prod set; not counting as failure)`);
    } else {
      notrun += 1;
    }
    continue;
  }

  // 1. config lint
  const lint = spawnSync("docker", ["compose", "-f", file, "config", "-q"], {
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
      ["compose", "-f", file, "build", "--no-cache", svc],
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
