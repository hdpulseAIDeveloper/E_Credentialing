#!/usr/bin/env node
/**
 * Forbidden-terms lint for user-facing documentation.
 *
 * The Credentialing platform is launched to end users as a new application.
 * Any language that implies a migration, upgrade, or legacy-replacement is
 * an internal engineering concern and must not appear in user-visible
 * documentation, onboarding screens, or training materials.
 *
 * This script fails CI if any forbidden term appears in:
 *   - docs/user/**
 *   - docs/training/**
 *   - src/app/**           (rendered UI copy + static pages)
 *   - src/components/**    (JSX user-facing labels)
 *
 * Internal engineering docs (docs/dev, docs/ops, docs/planning, docs/adr,
 * docs/compliance, docs/api, docs/testing, docs/status) are explicitly
 * exempt — they're allowed to describe the migration context.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_PATTERNS = [
  { term: "uplift", regex: /\buplift\w*/gi },
  { term: "upgrade", regex: /\bupgrade\w*/gi },
  { term: "replaces PARCS", regex: /replaces\s+PARCS/gi },
  { term: "replacing PARCS", regex: /replacing\s+PARCS/gi },
  { term: "PARCS", regex: /\bPARCS\b/g },
  { term: "v2", regex: /\bv2\b/gi },
  { term: "version 2", regex: /\bversion\s*2\b/gi },
  { term: "migration", regex: /\bmigration\w*/gi },
  { term: "legacy", regex: /\blegacy\b/gi },
];

// Restrict scanning to dirs that produce user-facing prose. API routes are
// excluded: a FHIR terminology URL like "v2-0360" is a standards identifier,
// not user-facing copy.
const INCLUDE_DIRS = [
  "docs/user",
  "docs/training",
];

const EXT_WHITELIST = new Set([".md", ".mdx", ".txt", ".html"]);

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      walk(full, out);
    } else {
      const ext = "." + entry.split(".").pop();
      if (EXT_WHITELIST.has(ext)) out.push(full);
    }
  }
  return out;
}

const violations = [];

for (const dir of INCLUDE_DIRS) {
  for (const file of walk(dir)) {
    const content = readFileSync(file, "utf8");
    for (const { term, regex } of FORBIDDEN_PATTERNS) {
      regex.lastIndex = 0;
      const matches = [...content.matchAll(regex)];
      if (matches.length > 0) {
        for (const m of matches) {
          const lineNum = content.slice(0, m.index ?? 0).split("\n").length;
          violations.push({ file, line: lineNum, term, snippet: m[0] });
        }
      }
    }
  }
}

if (violations.length === 0) {
  console.log("[forbidden-terms] OK — no forbidden language in user-facing content.");
  process.exit(0);
}

console.error("[forbidden-terms] FAIL — remove legacy framing from user-facing content:");
for (const v of violations) {
  console.error(`  ${v.file}:${v.line}  [${v.term}]  "${v.snippet}"`);
}
console.error(`\nTotal violations: ${violations.length}`);
console.error("User-visible docs/UI must present this as a new Credentialing application.");
console.error("Internal engineering docs (docs/dev, docs/ops, docs/planning, etc.) are exempt.");
process.exit(1);
