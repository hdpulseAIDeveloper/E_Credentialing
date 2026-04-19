#!/usr/bin/env node
/**
 * scripts/standards/write-site-tier-standard.mjs
 *
 * Writes the **site-tier** docs/qa/STANDARD.md into every marketing-site
 * sibling repo. The site-tier STANDARD.md is a thin v1.3.0 forwarder
 * that defers content to the canonical E_Credentialing spec and the
 * always-on global Cursor rule, but it explicitly declares pillar
 * scope for sites that have no auth surface: pillars B, C, D, P do not
 * apply (no roles, no PHI, no deep authenticated flows, no HIPAA).
 *
 * Why this exists: the propagation audit (PROPAGATION-AUDIT.md) flagged
 * the four EssenWebsites repos as YELLOW because each carried a stale
 * (v1.1.0 / v1.2.0) full-copy STANDARD.md that shadowed the current
 * global v1.3.0 rule. Replacing that 300-line stale duplicate with a
 * 50-line current-version forwarder closes the YELLOW gap without
 * inventing a new spec — the global rule remains the binding source.
 *
 * Idempotent: re-running overwrites the file with the current
 * template (carries the bootstrap pin marker so it stays managed).
 *
 * Anti-weakening (STANDARD.md §4.2):
 *   - Does NOT delete or modify any other doc.
 *   - Does NOT lower coverage thresholds.
 *   - Pillar B/C/D/P scope-out is a *factual scope statement*, not a
 *     downgrade: these surfaces literally do not exist on a marketing
 *     site (no roles, no PHI, no deep auth flows, no HIPAA workload).
 *     If the site ever adds an authenticated portal, this site-tier
 *     forwarder MUST be replaced with a full STANDARD.md — that
 *     promotion is called out as the §6 review trigger below.
 *
 * Usage:
 *   node scripts/standards/write-site-tier-standard.mjs [--dry-run]
 */

import { promises as fs } from "node:fs";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const SITE_REPOS = [
  "C:/Users/admin/development/HDPulseAI/EssenWebsites/BronxTreatmentCenter",
  "C:/Users/admin/development/HDPulseAI/EssenWebsites/EssenHealthcare",
  "C:/Users/admin/development/HDPulseAI/EssenWebsites/IntentionHealthcare",
  "C:/Users/admin/development/HDPulseAI/EssenWebsites/NYReach",
];

const PIN_MARKER =
  "<!-- managed-by: HDPulseAI standards bootstrap (scripts/standards/write-site-tier-standard.mjs) -->";

function siteTierBody(repoName) {
  return `# HDPulseAI QA Standard — site-tier forwarder (this repo)

${PIN_MARKER}

> **Status:** BINDING for this repository.
> **Version:** 1.3.0 (2026-04-19) — site-tier forwarder.
> **Lineage:** This repository is a **public marketing site** (no
> authenticated portal, no PHI, no role hierarchy). It binds the
> HDPulseAI Comprehensive QA Test Layer at the version maintained
> in the canonical repo \`E_Credentialing\` and mirrored to the
> always-on global Cursor rule.
> **Owner:** QA Standard Owner (see canonical \`docs/qa/STANDARD.md\`).

## 1. Canonical spec

The full binding text — pillar definitions, hard-fail conditions,
anti-weakening rules, headline reporting block, and Pillar S surfaces
1–7 (including the dev-loop performance baseline) — lives in:

- **Primary**: \`HDPulseAI/EssenApps/E_Credentialing/docs/qa/STANDARD.md\`
  (version 1.3.0).
- **Mirror (always-on)**: \`~/.cursor/rules/qa-standard-global.mdc\`
  on every developer machine, with \`alwaysApply: true\`.

This site-tier file is a **forwarder**, not a duplicate. Read the
canonical spec for the actual rules. This file only declares scope
for *this* repository.

## 2. Pillar scope for this repo (${repoName})

Because this repository ships a public marketing site with no
authenticated surface, no PHI, and no role hierarchy, the following
pillars from the canonical spec apply or are scoped-out:

| Pillar | Status | Why |
|---|---|---|
| **A** Functional smoke | **APPLIES** | Public pages must load, links must resolve, contact and lead-capture forms must submit. |
| **B** RBAC / authorization | **N/A — scoped-out** | No roles, no authenticated portal. If an authenticated portal is ever added, this row MUST flip to APPLIES and a full RBAC matrix MUST be added. |
| **C** PHI scope leakage | **N/A — scoped-out** | No PHI is collected, stored, or rendered. If a patient-facing portal is ever added, this row MUST flip to APPLIES. |
| **D** Deep E2E flows | **N/A — scoped-out** | No multi-step authenticated flows. Marketing forms (1-step submit) are covered under Pillar A. |
| **E** Accessibility (axe-core, WCAG 2.1 AA) | **APPLIES** | Hard-fail on \`serious\`/\`critical\` axe violations on every public page. |
| **F** Visual regression | **APPLIES** | Snapshots in Chromium / Firefox / WebKit at 375 / 768 / 1440 viewports. |
| **G** Cross-browser & responsive | **APPLIES** | Mobile, tablet, desktop layouts must render without breakage. |
| **H** Performance (Lighthouse / Core Web Vitals) | **APPLIES** | Hard-fail on LCP > 2.5s, CLS > 0.1, INP > 200ms (production budgets). |
| **I** Security DAST | **APPLIES (light scope)** | Public-surface scan only (no auth-protected endpoints exist). |
| **J** API contract | **APPLIES (if APIs exist)** | Any contact-form / lead-capture endpoint MUST be in OpenAPI + return RFC 9457 problem+json on errors. |
| **K** Time / concurrency | **APPLIES (light)** | Date / timezone handling on any time-sensitive content (events, hours). |
| **L** Data integrity | **APPLIES (CMS sync only)** | If the site pulls from a CMS, content sync invariants apply. |
| **M** File handling | **APPLIES (if uploads exist)** | Any contact-form attachment / résumé upload surface. |
| **N** Observability | **APPLIES** | Production logs, error tracking, uptime monitoring. |
| **O** Resilience | **APPLIES** | Graceful degradation if upstream CMS / form-handler is down. |
| **P** HIPAA / NCQA / CMS-0057-F / Joint-Commission compliance | **N/A — scoped-out** | No PHI, no covered-entity workload. |
| **Q** Documentation integrity | **APPLIES** | This file, README, ADRs, per-screen cards stay current with code. |
| **R** Inventory / route discovery | **APPLIES** | Every public route in \`route-inventory.json\` (or framework equivalent). |
| **S** Live-stack reality (surfaces 1–7) | **APPLIES** | Surface 1 (bring-up), Surface 5 (anonymous public surface), Surface 6 (cold Dockerfile build), Surface 7 (dev-loop performance). Surfaces 2 (migrations), 3 (sign-in matrix), 4 (authenticated session) are inert here because there is no auth — but the gate MUST report them as \`NOTRUN-by-scope\`, NOT silently skip them. |

## 3. Hard-fail conditions

All 15 §4 hard-fail conditions from the canonical spec apply, with
two adjustments for this repo's scope:

- **§4 (12) sign-in matrix** — reports \`NOTRUN-by-scope\` because
  there is no sign-in surface; this counts as PASS at the headline
  level only when this row is documented in this file (§2 above).
- **§4 (9) compliance regression** — applies to Pillar Q only on
  this site (documentation accuracy); the HIPAA/NCQA/CMS-0057-F/JC
  controls do not apply.

The other 13 hard-fail conditions apply unmodified, including:

- §4 (15) **lazy-compile dev-loop regression** (Pillar S Surface 7).
- §4 (13) **cold Dockerfile build** failure.
- §4 (5) **axe \`serious\`/\`critical\`** on a touched route.

## 4. Anti-weakening attestation requirement

Every defect closure in this repo MUST carry the §4.2 attestation
from the canonical spec (no \`.skip\`, no \`.todo\`, no
\`@ts-expect-error\`, no \`eslint-disable-next-line\` to dodge a
failing test, no widening of selectors, no swallowed errors, no
raised timeouts to mask races, no lowered coverage thresholds).

## 5. Headline reporting block

Every QA report on this repo MUST end with the canonical headline
block (\`Routes covered:\`, \`Roles exercised: 0 (N/A — public site)\`,
\`Live stack:\`, \`migrations: N/A\`, \`sign-in matrix: N/A\`,
\`dev-perf: p95=Y ms (budget 2000)\`, \`Pass/Fail/NotRun\`,
\`Pillars touched:\`, \`Hard-fails cleared:\`).

## 6. Promotion trigger — when this site-tier forwarder is no longer enough

Replace this file with a full \`docs/qa/STANDARD.md\` (mirrored from
the canonical repo) the moment **any** of the following ships:

1. An authenticated portal of any kind (B, D apply).
2. A patient-facing or PHI-collecting form (C, P apply).
3. A role hierarchy beyond "anonymous visitor" (B applies).
4. Any HIPAA-covered workload (P applies).

When that happens, the per-repo Cursor rule's "L1 wins over L3"
priority will pick up the new full STANDARD.md automatically — no
other change required.

## 7. How to refresh this file

This file is generated by
\`scripts/standards/write-site-tier-standard.mjs\` in the canonical
repo \`E_Credentialing\`. To re-write it (e.g. after a v1.3.0 → v1.4.0
bump in the canonical spec), edit the script and re-run:

\`\`\`bash
node scripts/standards/write-site-tier-standard.mjs
\`\`\`

The script overwrites only files carrying the
\`managed-by: HDPulseAI standards bootstrap\` marker (this file does).
`;
}

async function writeOne(repoPath, dryRun) {
  if (!existsSync(repoPath)) return { repoPath, status: "missing-repo" };
  const target = path.join(repoPath, "docs", "qa", "STANDARD.md");
  const repoName = path.basename(repoPath);
  const body = siteTierBody(repoName);
  let prev = "";
  const exists = existsSync(target);
  if (exists) prev = await fs.readFile(target, "utf8");
  if (prev === body) return { repoPath, status: "unchanged" };
  if (dryRun)
    return { repoPath, status: exists ? "would-update" : "would-create" };
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, body, "utf8");
  return { repoPath, status: exists ? "updated" : "created" };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  console.log(
    `Writing site-tier STANDARD.md to ${SITE_REPOS.length} repos${
      dryRun ? " (DRY RUN)" : ""
    }`,
  );
  for (const r of SITE_REPOS) {
    const res = await writeOne(r, dryRun);
    console.log(`  ${path.basename(r).padEnd(24)} ${res.status}`);
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
