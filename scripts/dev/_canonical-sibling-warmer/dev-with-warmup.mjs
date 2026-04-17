#!/usr/bin/env node
/**
 * Spawn `next dev` and, once it's accepting connections, kick off the
 * route pre-warmer (scripts/dev/warm-routes.mjs) in the background.
 * Forwards all `next dev` output unchanged.
 *
 * This is the CANONICAL sibling-app version — see
 * docs/standards/dev-loop-warmup.md (in E_Credentialing) for the
 * registry of apps using this script and the update protocol.
 *
 * Env:
 *   PORT             — port passed to `next dev -p` (default 3000)
 *   NEXT_DEV_ARGS    — extra args appended to `next dev` (e.g. "--turbopack")
 *   SKIP_WARMUP=1    — run plain `next dev` without the warmer
 *   BASE_URL         — passed through to the warmer (default localhost:${PORT})
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

// ─── PER-APP DEFAULTS ───────────────────────────────────────────────────────
// EDIT THIS BLOCK when copying into a sibling app — it is the only line of
// per-app divergence from this canonical template. The package.json
// `dev:warm` script can then stay generic (`node scripts/dev/dev-with-warmup.mjs`)
// and avoid a cross-env devDep just to set PORT cross-platform.
//
// Override at runtime with PORT=... NEXT_DEV_ARGS=... env vars
// (e.g. via docker-compose `environment:`).
const APP_DEFAULTS = { PORT: "3000", NEXT_DEV_ARGS: "" };
process.env.PORT = process.env.PORT || APP_DEFAULTS.PORT;
if (process.env.NEXT_DEV_ARGS == null) process.env.NEXT_DEV_ARGS = APP_DEFAULTS.NEXT_DEV_ARGS;

const PORT = process.env.PORT;
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;
const SKIP_WARMUP = process.env.SKIP_WARMUP === "1";

function log(msg) {
  process.stdout.write(`[dev:warm] ${msg}\n`);
}

const extraArgs = (process.env.NEXT_DEV_ARGS ?? "")
  .split(/\s+/)
  .filter(Boolean);
const nextArgs = ["next", "dev", "-p", PORT, ...extraArgs];

const next = spawn("npx", nextArgs, {
  cwd: REPO_ROOT,
  stdio: ["inherit", "pipe", "pipe"],
  env: process.env,
  shell: process.platform === "win32",
});

let warmStarted = false;
function maybeStartWarm() {
  if (warmStarted || SKIP_WARMUP) return;
  warmStarted = true;
  log(`dev server is up — starting background route warmer (BASE_URL=${BASE_URL})`);
  const warmer = spawn(
    process.execPath,
    [path.join(REPO_ROOT, "scripts", "dev", "warm-routes.mjs")],
    {
      cwd: REPO_ROOT,
      stdio: ["ignore", "inherit", "inherit"],
      env: { ...process.env, BASE_URL, PORT },
      detached: false,
    },
  );
  warmer.on("exit", (code) => {
    log(`route warmer finished (exit ${code})`);
  });
  next.on("exit", () => {
    if (!warmer.killed) {
      try {
        warmer.kill();
      } catch {
        // ignore
      }
    }
  });
}

const READY_RE = /\bReady\b|started server on|- Local:\s+http/i;
function onChunk(stream) {
  return (data) => {
    const text = data.toString("utf8");
    stream.write(text);
    if (!warmStarted && READY_RE.test(text)) {
      setTimeout(maybeStartWarm, 1_000);
    }
  };
}
next.stdout.on("data", onChunk(process.stdout));
next.stderr.on("data", onChunk(process.stderr));

setTimeout(() => {
  if (!warmStarted) {
    log("no 'Ready' marker seen in 60s — kicking warmer anyway (it polls itself)");
    maybeStartWarm();
  }
}, 60_000);

next.on("exit", (code, signal) => {
  log(`next dev exited (code=${code}, signal=${signal ?? "—"})`);
  process.exit(code ?? 0);
});

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!next.killed) next.kill(sig);
  });
}
