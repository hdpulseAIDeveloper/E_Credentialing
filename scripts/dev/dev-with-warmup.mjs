#!/usr/bin/env node
/**
 * Spawn `next dev` and, once it's accepting connections, kick off the
 * route pre-warmer in the background. Forwards all `next dev` output
 * to stdout/stderr unchanged (HMR logs, error overlays, etc.).
 *
 * This wrapper exists because Next.js dev mode lazily compiles each
 * route on first request, which produces the "every link feels slow
 * the first time" experience documented in DEF-INFRA-0001.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..", "..");

const PORT = process.env.PORT ?? "6015";
const BASE_URL = process.env.BASE_URL ?? `http://localhost:${PORT}`;

// Skip-warmup escape hatch for "I just want plain next dev".
const SKIP_WARMUP = process.env.SKIP_WARMUP === "1";

function log(msg) {
  process.stdout.write(`[dev:warm] ${msg}\n`);
}

const next = spawn("npx", ["next", "dev", "-p", PORT], {
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
      env: { ...process.env, BASE_URL },
      detached: false,
    },
  );
  warmer.on("exit", (code) => {
    log(`route warmer finished (exit ${code})`);
  });
  // Don't keep the parent alive for the warmer — if next exits, kill warmer
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

// Watch for Next's "Ready" log line and trigger the warmer once.
const READY_RE = /\bReady\b|started server on|- Local:\s+http/i;
function onChunk(stream) {
  return (data) => {
    const text = data.toString("utf8");
    stream.write(text);
    if (!warmStarted && READY_RE.test(text)) {
      // Slight delay so the HTTP listener is fully accepting connections.
      setTimeout(maybeStartWarm, 1_000);
    }
  };
}
next.stdout.on("data", onChunk(process.stdout));
next.stderr.on("data", onChunk(process.stderr));

// Safety net — if Next never prints a recognised ready line within 60s,
// start warming anyway. The warmer has its own /api/health poll loop.
setTimeout(() => {
  if (!warmStarted) {
    log("no 'Ready' marker seen in 60s — kicking warmer anyway (it polls health)");
    maybeStartWarm();
  }
}, 60_000);

next.on("exit", (code, signal) => {
  log(`next dev exited (code=${code}, signal=${signal ?? "—"})`);
  process.exit(code ?? 0);
});

// Forward Ctrl-C / SIGTERM cleanly so docker-compose restarts work.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    if (!next.killed) next.kill(sig);
  });
}
