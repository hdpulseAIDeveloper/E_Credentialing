#!/usr/bin/env node
/**
 * scripts/standards/audit-propagation.mjs — confirm every HDPulseAI
 * repository resolves the QA Standard, either via an in-repo
 * `docs/qa/STANDARD.md` (L1) or via the per-repo forwarders (L2)
 * pointing at the global rule (L3/L4).
 *
 * For each repo, prints a row with:
 *   - L1: in-repo `docs/qa/STANDARD.md` version
 *   - L2 forwarders present:
 *       cursor-rule           .cursor/rules/qa-standard.mdc
 *       copilot-instructions  .github/copilot-instructions.md
 *       agents-md             AGENTS.md (with HDPulseAI pin marker)
 *       claude-md             CLAUDE.md (with HDPulseAI pin marker)
 *       vscode-settings       .vscode/settings.json (with Copilot keys)
 *   - Resolution: GREEN (L1 current OR L2 complete), YELLOW (L2 partial),
 *     RED (no L1, no L2, no fallback).
 *
 * The script is read-only; it never modifies any file.
 *
 * Usage:
 *   node scripts/standards/audit-propagation.mjs            # table to stdout
 *   node scripts/standards/audit-propagation.mjs --markdown # also writes
 *                                                            docs/standards/PROPAGATION-AUDIT.md
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT_WORKSPACE = "C:/Users/admin/development/HDPulseAI";
const KNOWN_BUCKETS = new Set(["EssenApps", "EssenWebsites"]);
const PIN_MARKER = "managed-by: HDPulseAI standards bootstrap";
const COPILOT_USE_FILES_KEY =
  "github.copilot.chat.codeGeneration.useInstructionFiles";

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

async function readTextIfExists(p) {
  if (!existsSync(p)) return null;
  return fs.readFile(p, "utf8");
}

function detectVersion(text) {
  if (!text) return null;
  const m =
    text.match(/(?:^|\n)\s*-?\s*\*\*Version:?\*\*\s*([0-9]+\.[0-9]+\.[0-9]+)/i) ||
    text.match(/version[:\s\*]+([0-9]+\.[0-9]+\.[0-9]+)/i);
  return m ? m[1] : null;
}

async function auditRepo(repoPath) {
  const name = path.basename(repoPath);
  const standardText = await readTextIfExists(
    path.join(repoPath, "docs", "qa", "STANDARD.md"),
  );
  const standardVersion = detectVersion(standardText);
  const hasPillarS =
    !!standardText &&
    /Pillar\s+S\b/i.test(standardText) &&
    /Live[-\s]Stack\s+Reality/i.test(standardText);
  const hasSurface7 =
    !!standardText && /Surface\s+7/i.test(standardText);

  const cursorRule = await readTextIfExists(
    path.join(repoPath, ".cursor", "rules", "qa-standard.mdc"),
  );
  const copilotInstr = await readTextIfExists(
    path.join(repoPath, ".github", "copilot-instructions.md"),
  );
  const agentsMd = await readTextIfExists(path.join(repoPath, "AGENTS.md"));
  const claudeMd = await readTextIfExists(path.join(repoPath, "CLAUDE.md"));
  const vscodeSettings = await readTextIfExists(
    path.join(repoPath, ".vscode", "settings.json"),
  );

  const has = (txt) => !!txt && txt.includes(PIN_MARKER);
  const vscodeOk =
    !!vscodeSettings && vscodeSettings.includes(COPILOT_USE_FILES_KEY);

  const l2 = {
    cursorRule: has(cursorRule),
    copilotInstructions: has(copilotInstr),
    agentsMd: has(agentsMd),
    claudeMd: has(claudeMd),
    vscodeSettings: vscodeOk,
  };
  const l2Complete = Object.values(l2).every(Boolean);
  const l2Some = Object.values(l2).some(Boolean);

  let status;
  if (standardText && standardVersion === "1.3.0" && hasPillarS && hasSurface7 && l2Complete) {
    status = "GREEN (L1 current + L2 complete)";
  } else if (l2Complete) {
    status = standardText
      ? `YELLOW (L2 complete; L1 stale at ${standardVersion ?? "?"})`
      : "GREEN (L2 complete; resolves to L3/L4 global)";
  } else if (l2Some) {
    const missing = Object.entries(l2)
      .filter(([, v]) => !v)
      .map(([k]) => k);
    status = `YELLOW (L2 partial; missing: ${missing.join(", ")})`;
  } else {
    status = "RED (no L2; relies on global only — won't survive clone)";
  }

  return {
    repo: name,
    repoPath,
    standardVersion,
    hasPillarS,
    hasSurface7,
    l2,
    status,
  };
}

function fmtCell(v) {
  return v ? "y" : "-";
}

function renderTable(rows) {
  const headers = [
    "Repo",
    "L1 ver",
    "PillarS",
    "Surf7",
    "Cursor",
    "Copilot",
    "AGENTS",
    "CLAUDE",
    "VSCode",
    "Status",
  ];
  const data = rows.map((r) => [
    r.repo,
    r.standardVersion ?? "-",
    fmtCell(r.hasPillarS),
    fmtCell(r.hasSurface7),
    fmtCell(r.l2.cursorRule),
    fmtCell(r.l2.copilotInstructions),
    fmtCell(r.l2.agentsMd),
    fmtCell(r.l2.claudeMd),
    fmtCell(r.l2.vscodeSettings),
    r.status,
  ]);
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...data.map((row) => String(row[i]).length)),
  );
  const pad = (s, w) => String(s).padEnd(w);
  const sep = widths.map((w) => "-".repeat(w)).join("  ");
  const line = (row) => row.map((c, i) => pad(c, widths[i])).join("  ");
  return [line(headers), sep, ...data.map(line)].join("\n");
}

function renderMarkdown(rows, generatedAt) {
  const headers = [
    "Repo",
    "L1 STANDARD.md version",
    "Pillar S",
    "Surface 7",
    "Cursor rule (L2)",
    "Copilot instr (L2)",
    "AGENTS.md (L2)",
    "CLAUDE.md (L2)",
    "VSCode settings (L2)",
    "Resolution",
  ];
  const lines = [
    "# HDPulseAI Standards — Propagation Audit",
    "",
    `> Auto-generated by \`scripts/standards/audit-propagation.mjs\`.`,
    `> Last refresh: ${generatedAt}.`,
    "",
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const r of rows) {
    lines.push(
      `| ${r.repo} | ${r.standardVersion ?? "—"} | ${
        r.hasPillarS ? "y" : "—"
      } | ${r.hasSurface7 ? "y" : "—"} | ${fmtCell(r.l2.cursorRule)} | ${fmtCell(r.l2.copilotInstructions)} | ${fmtCell(r.l2.agentsMd)} | ${fmtCell(r.l2.claudeMd)} | ${fmtCell(r.l2.vscodeSettings)} | ${r.status} |`,
    );
  }
  lines.push(
    "",
    "## Legend",
    "",
    "- **L1 STANDARD.md version** — version of the in-repo canonical spec, if present.",
    "- **Pillar S / Surface 7** — whether the in-repo spec mentions the live-stack reality gate and the dev-loop performance invariant explicitly.",
    "- **L2 forwarders** — `y` if the file is present AND carries the HDPulseAI pin marker.",
    "- **Resolution**:",
    "  - **GREEN** — standard is fully resolved and survives a fresh clone.",
    "  - **YELLOW** — partial coverage; agent will work but a fresh clone might miss part of the surface.",
    "  - **RED** — no L2 forwarders; the repo only inherits via the machine-local global rule and will not survive a clone.",
  );
  return lines.join("\n");
}

async function main() {
  const wantMarkdown = process.argv.includes("--markdown");

  const repos = await findAllRepos(ROOT_WORKSPACE);
  const rows = [];
  for (const r of repos) rows.push(await auditRepo(r));

  console.log(renderTable(rows));
  console.log("");
  const green = rows.filter((r) => /^GREEN/.test(r.status)).length;
  const yellow = rows.filter((r) => /^YELLOW/.test(r.status)).length;
  const red = rows.filter((r) => /^RED/.test(r.status)).length;
  console.log(`${rows.length} repos audited — GREEN: ${green}, YELLOW: ${yellow}, RED: ${red}`);

  if (wantMarkdown) {
    const out = path.resolve(
      process.cwd(),
      "docs",
      "standards",
      "PROPAGATION-AUDIT.md",
    );
    const generatedAt = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
    await fs.mkdir(path.dirname(out), { recursive: true });
    await fs.writeFile(out, renderMarkdown(rows, generatedAt) + "\n", "utf8");
    console.log(`\nWrote ${out}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
