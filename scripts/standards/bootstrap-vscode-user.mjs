#!/usr/bin/env node
/**
 * scripts/standards/bootstrap-vscode-user.mjs — VSCode global setup
 *
 * One-time setup that wires the HDPulseAI QA Standard into VSCode at
 * the *user* level so every workspace inherits it, even ones that have
 * not yet been bootstrapped with `bootstrap-repo.mjs`.
 *
 * Two changes:
 *
 *   1. Merge four keys into `%APPDATA%/Code/User/settings.json` (Windows)
 *      / `$HOME/Library/Application Support/Code/User/settings.json`
 *      (macOS) / `$HOME/.config/Code/User/settings.json` (Linux):
 *
 *      - `github.copilot.chat.codeGeneration.useInstructionFiles: true`
 *        Tells Copilot to honor `.github/copilot-instructions.md` in every
 *        workspace.
 *      - `github.copilot.chat.codeGeneration.instructions: [...]`
 *        User-level Copilot instructions that always apply, even in a
 *        workspace that has no `.github/copilot-instructions.md`. Points
 *        at the global Cursor rule so Cursor and Copilot share one source
 *        of truth.
 *      - `github.copilot.chat.commitMessageGeneration.instructions: [...]`
 *        Same standard applied to commit message drafts.
 *      - `github.copilot.chat.testGeneration.instructions: [...]`
 *        Same standard applied to test scaffolding suggestions.
 *
 *   2. Create `%APPDATA%/Code/User/prompts/qa-standard.prompt.md` (and the
 *      `prompts/` directory if missing). VSCode 1.95+ exposes user-level
 *      prompt files for slash-commands; this file makes the standard
 *      available as `/qa-standard` in any workspace.
 *
 * Idempotent: re-running the script is safe. Only the four keys above
 * are touched in settings.json; everything else (autoApprove rules,
 * theme, keybindings, etc.) is preserved verbatim.
 *
 * Anti-weakening: this script never deletes user-authored Copilot
 * instructions; if the array is already populated by the user, it
 * de-duplicates and appends the standard pin.
 *
 * Usage:
 *   node scripts/standards/bootstrap-vscode-user.mjs [--dry-run]
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import os from "node:os";

const HOME = os.homedir();
const PLATFORM = process.platform;

function vscodeUserDir() {
  if (PLATFORM === "win32")
    return path.join(process.env.APPDATA ?? path.join(HOME, "AppData/Roaming"), "Code", "User");
  if (PLATFORM === "darwin")
    return path.join(HOME, "Library", "Application Support", "Code", "User");
  return path.join(HOME, ".config", "Code", "User");
}

const STANDARD_INSTRUCTION_TEXT =
  "Follow the HDPulseAI QA Standard binding on every change: 19 testing pillars (A–S, including Pillar S live-stack reality gate), 15 §4 hard-fail conditions, Pillar S Surface 7 dev-loop performance baseline (Turbopack/Vite/etc. as default dev compiler + dynamic-route warming + 2000 ms re-fetch budget), anti-weakening rules (no .skip, no .todo, no @ts-expect-error, no eslint-disable-next-line, no widening selectors, no swallowed errors, no raised timeouts, no lowered coverage thresholds), and the headline reporting block on every QA report (Routes covered: X of Y; Roles exercised: X of N; Live stack: <SHA>; migrations: N pending; sign-in matrix: …; dev-perf: p95=Y ms; Pass/Fail/NotRun; Pillars touched A–S IDs; Hard-fails cleared 1–15). Canonical spec: docs/qa/STANDARD.md in the repo if present, else ~/.cursor/rules/qa-standard-global.mdc.";

const COMMIT_INSTRUCTION_TEXT =
  "Commit messages MUST follow the HDPulseAI Conventional Commit format: '<type>(<scope>): <imperative summary>' on the subject line, then a body explaining (1) the symptom or trigger, (2) the root cause, (3) the fix and why this approach over alternatives, (4) verification (which gates were run, what numbers came back), (5) anti-weakening attestation per STANDARD.md §4.2, and (6) defect-ledger updates if applicable. Type is one of: feat, fix, docs, refactor, test, chore, perf, security. Scope is the affected subsystem.";

const TEST_INSTRUCTION_TEXT =
  "Generated tests MUST live under tests/e2e/<pillar>/ where <pillar> is one of A–S from the HDPulseAI QA Standard. Tests MUST NOT use .skip / .todo / .fixme, MUST NOT softly catch errors with .catch(()=>{}) or expect.soft, MUST NOT use @ts-expect-error or eslint-disable-next-line to dodge failing assertions, and MUST NOT raise timeouts to mask races. Selectors MUST be specific (data-testid, role+name, or accessible label) — never wildcard or substring matchers. Every new test MUST be added to the per-screen and per-flow cards under docs/qa/per-screen/ and docs/qa/per-flow/.";

const STANDARD_REF =
  "Canonical spec: docs/qa/STANDARD.md in this repo (if present), else ~/.cursor/rules/qa-standard-global.mdc.";

const PROMPT_FILE_BODY = `# /qa-standard — HDPulseAI QA Standard pin

${STANDARD_REF}

You are operating inside an HDPulseAI repository. Apply the HDPulseAI
Comprehensive QA Test Layer to the current task.

## Binding rules

- 19 testing pillars (A–S). Pillar S = live-stack reality gate.
- 15 §4 hard-fail conditions including Pillar S Surface 7 dev-loop
  performance baseline.
- Anti-weakening rules in §4.2.
- Headline reporting block on every QA report.

## Cross-tool propagation

- Cursor: \`~/.cursor/rules/qa-standard-global.mdc\` (\`alwaysApply: true\`).
- VSCode + GitHub Copilot: \`.github/copilot-instructions.md\` per repo,
  plus user-level \`github.copilot.chat.codeGeneration.instructions\`.
- Tool-agnostic: \`AGENTS.md\` per repo.
- Claude Code: \`CLAUDE.md\` per repo.

## When in doubt

Read \`docs/qa/STANDARD.md\` (in-repo if present, otherwise the
canonical copy in \`E_Credentialing\`) and re-run the gate that
covers the surface you touched.
`;

async function readJson(p) {
  if (!existsSync(p)) return {};
  const raw = await fs.readFile(p, "utf8");
  // VSCode supports JSON-with-comments. Use a lenient strip.
  const stripped = raw
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");
  try {
    return JSON.parse(stripped);
  } catch (e) {
    throw new Error(`failed to parse ${p}: ${e}`);
  }
}

function dedupeAppend(existing, instructionText) {
  const arr = Array.isArray(existing) ? [...existing] : [];
  const found = arr.some(
    (e) =>
      (typeof e === "string" && e === instructionText) ||
      (e && typeof e === "object" && e.text === instructionText),
  );
  if (!found) arr.push({ text: instructionText });
  return arr;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const userDir = vscodeUserDir();
  const settingsPath = path.join(userDir, "settings.json");
  const promptsDir = path.join(userDir, "prompts");
  const promptPath = path.join(promptsDir, "qa-standard.prompt.md");

  console.log(`VSCode user dir: ${userDir}`);
  console.log(`settings.json:   ${settingsPath}`);
  console.log(`prompt file:     ${promptPath}`);
  console.log("");

  if (!existsSync(userDir)) {
    console.log(
      `VSCode user directory does not exist (${userDir}). VSCode is probably not installed yet — skipping. Re-run after installing VSCode.`,
    );
    return;
  }

  const settings = await readJson(settingsPath);
  const before = JSON.stringify(settings);

  settings["github.copilot.chat.codeGeneration.useInstructionFiles"] = true;
  settings["github.copilot.chat.codeGeneration.instructions"] = dedupeAppend(
    settings["github.copilot.chat.codeGeneration.instructions"],
    STANDARD_INSTRUCTION_TEXT,
  );
  settings["github.copilot.chat.commitMessageGeneration.instructions"] =
    dedupeAppend(
      settings["github.copilot.chat.commitMessageGeneration.instructions"],
      COMMIT_INSTRUCTION_TEXT,
    );
  settings["github.copilot.chat.testGeneration.instructions"] = dedupeAppend(
    settings["github.copilot.chat.testGeneration.instructions"],
    TEST_INSTRUCTION_TEXT,
  );

  const after = JSON.stringify(settings, null, 4) + "\n";
  if (before === JSON.stringify(JSON.parse(after))) {
    console.log("settings.json: no change (already current)");
  } else if (dryRun) {
    console.log("settings.json: WOULD UPDATE (dry-run)");
  } else {
    await fs.writeFile(settingsPath, after, "utf8");
    console.log("settings.json: updated");
  }

  if (!existsSync(promptsDir)) {
    if (dryRun) {
      console.log(`prompts dir:    WOULD CREATE ${promptsDir}`);
    } else {
      await fs.mkdir(promptsDir, { recursive: true });
      console.log(`prompts dir:    created ${promptsDir}`);
    }
  }

  let promptStatus = "unchanged";
  if (!existsSync(promptPath)) {
    if (dryRun) promptStatus = "would-create";
    else {
      await fs.writeFile(promptPath, PROMPT_FILE_BODY, "utf8");
      promptStatus = "created";
    }
  } else {
    const cur = await fs.readFile(promptPath, "utf8");
    if (cur !== PROMPT_FILE_BODY) {
      if (dryRun) promptStatus = "would-update";
      else {
        await fs.writeFile(promptPath, PROMPT_FILE_BODY, "utf8");
        promptStatus = "updated";
      }
    }
  }
  console.log(`prompt file:    ${promptStatus}`);
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
