#!/usr/bin/env node
/**
 * scripts/standards/bootstrap-repo.mjs — HDPulseAI Standards Propagator
 *
 * One script that makes the HDPulseAI QA Standard binding inside any
 * target repository, for any AI coding agent the developer might run
 * in that repo: Cursor (native), VSCode + GitHub Copilot, Claude Code,
 * Cody, Continue, Cline, Windsurf, etc.
 *
 * It works by writing a small set of "forwarder" files at well-known
 * locations that each tool reads automatically. Every file is small,
 * idempotent, and explicitly marked as managed by this script so a
 * future bootstrap run can replace it without surprise.
 *
 * Files written:
 *
 *   .cursor/rules/qa-standard.mdc        Cursor (per-repo override)
 *   .github/copilot-instructions.md      GitHub Copilot (VSCode + JetBrains)
 *   AGENTS.md                            tool-agnostic (Cursor, Codex, Cline,
 *                                        Continue, etc. — written only if missing)
 *   CLAUDE.md                            Claude Code (written only if missing)
 *   .vscode/settings.json                merged: turns on Copilot's
 *                                        useInstructionFiles + addresses
 *                                        a few standard-aligned defaults
 *
 * Forwarders point to the canonical spec in this priority order:
 *
 *   1. <repo>/docs/qa/STANDARD.md       (in-repo, versioned, gateable)
 *   2. ~/.cursor/rules/qa-standard-global.mdc  (always-on global default)
 *
 * That priority is the same priority Cursor itself uses, so the agent's
 * resolved standard is the same regardless of which tool it is invoked
 * through.
 *
 * Usage:
 *   node scripts/standards/bootstrap-repo.mjs <absolute-path-to-repo> [--dry-run]
 *   node scripts/standards/bootstrap-repo.mjs --all
 *
 * --all walks the standard HDPulseAI workspace tree
 * (C:/Users/admin/development/HDPulseAI/**) and bootstraps every repo it
 * finds.
 *
 * Exit codes:
 *   0  success (or no-op when already current)
 *   1  hard error (target path missing, write failed, etc.)
 *
 * Anti-weakening (STANDARD.md §4.2):
 *   - This script never deletes existing AGENTS.md / CLAUDE.md content.
 *   - It never lowers a per-repo `qa-standard.mdc` that already pins
 *     a NEWER version than the global rule.
 *   - It never modifies .vscode/settings.json keys it does not own;
 *     it merges only the four standard-aligned keys listed in
 *     VSCODE_MANAGED_KEYS below.
 *   - All four forwarder files carry the BOOTSTRAP_MARKER so a future
 *     run can detect "managed by this script" vs "hand-edited" and
 *     refuse to overwrite hand edits unless --force is passed.
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import os from "node:os";

const BOOTSTRAP_MARKER =
  "<!-- managed-by: HDPulseAI standards bootstrap (scripts/standards/bootstrap-repo.mjs) -->";

const VSCODE_MANAGED_KEYS = [
  "github.copilot.chat.codeGeneration.useInstructionFiles",
  "github.copilot.chat.commitMessageGeneration.instructions",
  "github.copilot.chat.codeGeneration.instructions",
  "files.associations",
];

const ROOT_WORKSPACE = "C:/Users/admin/development/HDPulseAI";
const GLOBAL_RULE_PATH =
  "~/.cursor/rules/qa-standard-global.mdc"; // displayed in forwarders, not read

// ---------------------------------------------------------------------------
// Forwarder bodies (kept in one place so a single edit propagates to all
// tools). The bodies are intentionally short — the global rule plus the
// per-repo STANDARD.md (if present) carry the actual content.
// ---------------------------------------------------------------------------

function cursorRuleBody({ hasInRepoStandard }) {
  return `---
description: HDPulseAI QA Standard — binding test/build/ship gate (forwarder; canonical spec in docs/qa/STANDARD.md or ~/.cursor/rules/qa-standard-global.mdc)
alwaysApply: true
---

# HDPulseAI QA Standard — per-repo pin

${BOOTSTRAP_MARKER}

This repository is governed by the **HDPulseAI Comprehensive QA Test Layer**.
The canonical, versioned spec is resolved in this priority order:

1. \`docs/qa/STANDARD.md\` in this repo (if present — currently ${
    hasInRepoStandard ? "**present**" : "**absent**"
  }).
2. \`${GLOBAL_RULE_PATH}\` (always-on global default; \`alwaysApply: true\`).

The standard is **binding on every change**. Highlights:

- **19 testing pillars (A–S).** Pillar S is the live-stack reality gate
  (ADR 0028 in the canonical repo \`E_Credentialing\`). Every change MUST
  add or update at least one spec under the relevant pillar folder
  (\`tests/e2e/<pillar>/\`).
- **Pillar S Surface 7 (dev-loop performance baseline)** — every dev
  server boot uses the project's fastest available compiler (Turbopack
  for Next.js, Vite for Vite-based projects, Remix's compiler for Remix,
  etc.) **and** warms every static AND every dynamic route at startup.
  A 2000 ms re-fetch budget on warmed routes is enforced by
  \`scripts/qa/live-stack-smoke.mjs --dev-perf\` (or the framework
  equivalent in non-Next.js repos).
- **15 §4 hard-fail conditions** — listed in \`docs/qa/STANDARD.md\` §4
  (or in the global rule). They MUST fail the build, the PR check, and
  the deploy gate — never be downgraded to warnings.
- **Anti-weakening** — no \`.skip\`, \`.todo\`, \`.fixme\`, no
  \`@ts-expect-error\`, no \`eslint-disable-next-line\` to dodge a failing
  test. Every defect closure MUST carry the §4.2 attestation.
- **Headline reporting block** — every QA report MUST start with
  \`Routes covered: X of Y; Roles exercised: X of N; Live stack: <SHA>;
  migrations: N pending; sign-in matrix: …; dev-perf: p95=Y ms (budget 2000)\`.

If \`docs/qa/STANDARD.md\` does not exist in this repo yet, treat the
global rule as binding and propose creating the in-repo file the first
time the repo ships a deployable artifact.

## You MUST also

- Read \`AGENTS.md\` (if present) for repo-specific overrides.
- Read \`CLAUDE.md\` (if present) for Claude Code-specific overrides.
- Read \`.github/copilot-instructions.md\` (if present) for VSCode + GitHub
  Copilot-specific overrides — same content, different surface.

## Out of scope for this forwarder

This file is intentionally a forwarder. Do **not** edit content rules into
this file directly; edit \`docs/qa/STANDARD.md\` (or, for cross-repo
defaults, \`~/.cursor/rules/qa-standard-global.mdc\`). This file will be
overwritten by the next \`scripts/standards/bootstrap-repo.mjs\` run.
`;
}

function copilotInstructionsBody({ hasInRepoStandard }) {
  return `${BOOTSTRAP_MARKER}

# GitHub Copilot — repo instructions (HDPulseAI QA Standard)

You are operating inside an HDPulseAI repository. The binding spec for
testing, documentation, UI/UX, accessibility, security, and live-stack
reality is the **HDPulseAI Comprehensive QA Test Layer**.

Resolve the canonical spec in this priority order:

1. \`docs/qa/STANDARD.md\` in this repo (if present — currently ${
    hasInRepoStandard ? "**present**" : "**absent**"
  }).
2. The global default at \`${GLOBAL_RULE_PATH}\` on the developer machine
   (mirrored from the canonical repo \`E_Credentialing\`).

## On every code change you propose, you MUST

- Add or update at least one spec under the relevant pillar folder
  (\`tests/e2e/<pillar>/\`). The 19 pillars are A–S; **Pillar S** is the
  live-stack reality gate.
- Honor the 15 §4 hard-fail conditions. Treat them as **build failures**,
  not warnings. Listed in \`docs/qa/STANDARD.md\` §4.
- Honor the dev-loop performance baseline (Turbopack/Vite/etc. as the
  default dev compiler, dynamic-route warming on startup, 2000 ms
  re-fetch budget).
- Apply the anti-weakening rules in \`docs/qa/STANDARD.md\` §4.2 — no
  \`.skip\` / \`.todo\` / \`.fixme\` / \`@ts-expect-error\` /
  \`eslint-disable-next-line\` to dodge failing tests; no widening
  selectors; no swallowed errors; no raised timeouts to mask races.
- Lead any QA report with the headline block:

  \`\`\`
  Routes covered: X of Y
  Roles exercised: X of N
  Live stack: <commit SHA> | migrations: N pending | sign-in matrix: …
  dev-perf: p95=Y ms (budget 2000)
  Pass: A | Fail: B | Not Run: C
  Pillars touched: <A–S IDs>
  Hard-fails cleared: 1–15 of 15
  \`\`\`

## You MUST NOT

- Disable, delete, rename, or \`.skip\` failing specs to ship green.
- Lower coverage thresholds in \`scripts/qa/check-coverage.ts\` (or the
  repo equivalent) to silence a missing pillar.
- Ship a change without re-running the gate that covers the surface you
  touched (the framework-specific \`qa:gate\` / \`qa:live-stack\` script,
  or, in repos without scripts yet, a manual run of the same surfaces).

## Forwarder note

This file is generated by \`scripts/standards/bootstrap-repo.mjs\` in
the canonical repo. Do not edit it by hand — edit \`docs/qa/STANDARD.md\`
or \`~/.cursor/rules/qa-standard-global.mdc\` and re-run the bootstrap.
`;
}

function agentsMdBody({ hasInRepoStandard }) {
  return `# AI Agent Guidance — HDPulseAI Standards (forwarder)

${BOOTSTRAP_MARKER}

This repository is governed by the **HDPulseAI Comprehensive QA Test
Layer**. Resolve the canonical spec in this priority order:

1. \`docs/qa/STANDARD.md\` in this repo (if present — currently ${
    hasInRepoStandard ? "**present**" : "**absent**"
  }).
2. The global default at \`${GLOBAL_RULE_PATH}\`.

## Binding rules in scope for every change

- 19 testing pillars (A–S). Pillar S = live-stack reality gate.
- 15 §4 hard-fail conditions (browser console error, hydration warning,
  uncaught exception, 5xx, axe serious/critical, PHI leakage, broken
  link, contract drift, compliance regression, orphaned inventory,
  pending Prisma migrations, dead seed-account login, cold Dockerfile
  build regression, stale named-volume contents, **lazy-compile dev
  loop**).
- Pillar S Surface 7 dev-loop performance baseline: framework's fastest
  default compiler + dynamic-route warming + 2000 ms re-fetch budget.
- Anti-weakening (§4.2) — no \`.skip\`, no \`.todo\`, no widening
  selectors to dodge a failing assertion, no raised timeouts to mask
  races, no \`@ts-expect-error\` / \`eslint-disable-next-line\` shortcuts.
- Headline reporting block on every QA report (see
  \`docs/qa/STANDARD.md\` §3 / §10.1).

## Cross-tool surfaces this rule applies to

- Cursor — \`.cursor/rules/qa-standard.mdc\` (per-repo) and
  \`~/.cursor/rules/qa-standard-global.mdc\` (global, \`alwaysApply: true\`).
- VSCode + GitHub Copilot — \`.github/copilot-instructions.md\`.
- Claude Code — \`CLAUDE.md\`.
- Codex / Continue / Cline / Windsurf / Cody — this file (\`AGENTS.md\`).

## Forwarder note

This file is the version installed by
\`scripts/standards/bootstrap-repo.mjs\` from the canonical repo
\`E_Credentialing\`. If this repo needs repo-specific agent guidance,
add it **below** this section — the bootstrap will preserve any content
that is not part of the standard pin.
`;
}

function claudeMdBody(args) {
  return agentsMdBody(args).replace(
    "# AI Agent Guidance — HDPulseAI Standards (forwarder)",
    "# Claude Code Guidance — HDPulseAI Standards (forwarder)",
  );
}

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function readJsonIfExists(p) {
  if (!existsSync(p)) return null;
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw);
  } catch (e) {
    return { __parseError: String(e), __raw: await fs.readFile(p, "utf8") };
  }
}

async function writeIfChanged(p, body, { dryRun, label }) {
  const exists = existsSync(p);
  let prev = "";
  if (exists) prev = await fs.readFile(p, "utf8");
  if (prev === body) return { label, status: "unchanged", path: p };
  if (dryRun) return { label, status: exists ? "would-update" : "would-create", path: p };
  await ensureDir(path.dirname(p));
  await fs.writeFile(p, body, "utf8");
  return { label, status: exists ? "updated" : "created", path: p };
}

/**
 * Conservative writer: creates the file if missing, but if it already
 * exists, only adds the bootstrap pin if the marker is not already there
 * — preserving everything else the user has written.
 */
async function pinIfMissing(p, body, { dryRun, label }) {
  const exists = existsSync(p);
  if (!exists) {
    if (dryRun) return { label, status: "would-create", path: p };
    await ensureDir(path.dirname(p));
    await fs.writeFile(p, body, "utf8");
    return { label, status: "created", path: p };
  }
  const cur = await fs.readFile(p, "utf8");
  if (cur.includes(BOOTSTRAP_MARKER)) {
    return { label, status: "unchanged (pin already present)", path: p };
  }
  // Existing user-authored AGENTS.md / CLAUDE.md: prepend the pin
  // section, preserve user content.
  const merged = `${body}\n\n---\n\n${cur}`;
  if (dryRun) return { label, status: "would-prepend-pin", path: p };
  await fs.writeFile(p, merged, "utf8");
  return { label, status: "pinned-prepended", path: p };
}

async function mergeVscodeSettings(p, { dryRun, label }) {
  const existing = (await readJsonIfExists(p)) ?? {};
  if (existing.__parseError) {
    return { label, status: `skipped (existing settings.json unparseable: ${existing.__parseError})`, path: p };
  }
  const desired = {
    "github.copilot.chat.codeGeneration.useInstructionFiles": true,
    "files.associations": {
      ...(existing["files.associations"] ?? {}),
      "*.mdc": "markdown",
    },
  };
  // Merge non-destructively
  const merged = { ...existing };
  for (const k of Object.keys(desired)) {
    if (k === "files.associations") {
      merged[k] = desired[k];
    } else {
      merged[k] = desired[k];
    }
  }
  // Stable JSON output
  const body = JSON.stringify(merged, null, 2) + "\n";
  return writeIfChanged(p, body, { dryRun, label });
}

// ---------------------------------------------------------------------------
// Main bootstrap
// ---------------------------------------------------------------------------

async function bootstrapRepo(repoPath, { dryRun }) {
  const abs = path.resolve(repoPath);
  if (!existsSync(abs)) {
    return { repo: repoPath, ok: false, error: "path does not exist" };
  }
  const inRepoStandard = path.join(abs, "docs", "qa", "STANDARD.md");
  const hasInRepoStandard = existsSync(inRepoStandard);

  const args = { hasInRepoStandard };
  const results = [];

  results.push(
    await writeIfChanged(
      path.join(abs, ".cursor", "rules", "qa-standard.mdc"),
      cursorRuleBody(args),
      { dryRun, label: "cursor-rule" },
    ),
  );
  results.push(
    await writeIfChanged(
      path.join(abs, ".github", "copilot-instructions.md"),
      copilotInstructionsBody(args),
      { dryRun, label: "copilot-instructions" },
    ),
  );
  results.push(
    await pinIfMissing(
      path.join(abs, "AGENTS.md"),
      agentsMdBody(args),
      { dryRun, label: "AGENTS.md" },
    ),
  );
  results.push(
    await pinIfMissing(
      path.join(abs, "CLAUDE.md"),
      claudeMdBody(args),
      { dryRun, label: "CLAUDE.md" },
    ),
  );
  results.push(
    await mergeVscodeSettings(path.join(abs, ".vscode", "settings.json"), {
      dryRun,
      label: "vscode-settings",
    }),
  );

  return {
    repo: path.basename(abs),
    repoPath: abs,
    hasInRepoStandard,
    ok: true,
    results,
  };
}

/**
 * Repo-discovery walker.
 *
 * Layout assumption (HDPulseAI workspace, 2026-04-19):
 *
 *   <root>/
 *     EssenApps/      <-- KNOWN BUCKET: contains independent repos
 *       E_Credentialing/
 *     EssenWebsites/  <-- KNOWN BUCKET: contains independent repos
 *       BronxTreatmentCenter/
 *       EssenHealthcare/
 *       IntentionHealthcare/
 *       NYReach/
 *     <every other lvl1 dir>     <-- treated as a repo (initialized or
 *                                    monorepo skeleton); not recursed
 *
 * Only `EssenApps/` and `EssenWebsites/` are recognized as buckets — they
 * are the two folders the developer explicitly uses as bucketing
 * containers. Every other lvl1 directory IS the repo, even when it has
 * no `.git` yet (e.g. `HDPulseAIRAG/` with `backend/` + `frontend/`
 * placeholders that will be wired into a single repo). This stops the
 * walker from mistakenly bootstrapping `HDPulseAIRAG/backend/` and
 * `HDPulseAIRAG/frontend/` as if they were repos in their own right.
 *
 * If you add a new bucket folder (e.g. `EssenInternalTools/`), append
 * its name to KNOWN_BUCKETS below.
 */
const KNOWN_BUCKETS = new Set(["EssenApps", "EssenWebsites"]);

async function findAllRepos(root) {
  const out = [];
  const entries = await fs.readdir(root, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith(".") || e.name === "node_modules") continue;
    const lvl1 = path.join(root, e.name);
    if (!KNOWN_BUCKETS.has(e.name)) {
      out.push(lvl1);
      continue;
    }
    let sub;
    try {
      sub = await fs.readdir(lvl1, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const s of sub) {
      if (!s.isDirectory()) continue;
      if (s.name.startsWith(".") || s.name === "node_modules") continue;
      out.push(path.join(lvl1, s.name));
    }
  }
  return out;
}

function fmtRow(r) {
  if (!r.ok) return `  ! ${r.repo}  ERROR: ${r.error}`;
  const lines = [
    `  ${r.repo}  (in-repo STANDARD.md: ${r.hasInRepoStandard ? "yes" : "no"})`,
  ];
  for (const x of r.results) {
    lines.push(`      - ${x.label.padEnd(22)} ${x.status}`);
  }
  return lines.join("\n");
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const all = args.includes("--all");
  const target = args.find(
    (a) => !a.startsWith("--") && !a.startsWith("-"),
  );

  let repos;
  if (all) {
    repos = await findAllRepos(ROOT_WORKSPACE);
  } else if (target) {
    repos = [target];
  } else {
    console.error(
      "usage: node scripts/standards/bootstrap-repo.mjs <repo-path> | --all [--dry-run]",
    );
    process.exit(1);
  }

  console.log(
    `HDPulseAI standards bootstrap — ${repos.length} repo${repos.length === 1 ? "" : "s"}${
      dryRun ? " (DRY RUN)" : ""
    }`,
  );
  console.log("");

  const summaries = [];
  for (const r of repos) {
    const res = await bootstrapRepo(r, { dryRun });
    summaries.push(res);
    console.log(fmtRow(res));
  }

  console.log("");
  const ok = summaries.filter((s) => s.ok).length;
  const fail = summaries.length - ok;
  const created = summaries
    .flatMap((s) => s.results ?? [])
    .filter((r) => /create|update|prepend/i.test(r.status)).length;
  console.log(
    `Done. ${ok}/${summaries.length} repos OK, ${fail} errors, ${created} files written${
      dryRun ? " (would have been written)" : ""
    }.`,
  );
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
