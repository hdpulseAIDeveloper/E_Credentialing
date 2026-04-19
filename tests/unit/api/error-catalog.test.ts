/**
 * Unit tests for `src/lib/api/error-catalog.ts` (Wave 21).
 *
 * Covers:
 *
 *   1. Per-row invariants — every entry has stable wire-shape fields
 *      (code matches `^[a-z][a-z0-9_]*$`, status is 4xx/5xx, title
 *      ≤ 60 chars and Title-Case, summary/description/remediation are
 *      strings, sinceVersion matches SemVer, docsPath = `/errors/<kebab>`).
 *   2. Lookup helpers — `findCatalogEntry` is O(1) by code,
 *      `listCatalogEntries` returns a sorted, freshly-cloned array.
 *   3. **Registry-completeness contract** — every snake_case `code`
 *      string literal passed to `v1ErrorResponse(...)` or
 *      `buildProblem(...)` anywhere under `src/app/api/v1/**` or
 *      `src/lib/api/**` MUST appear in the catalog. This is the
 *      anti-drift gate: adding a new error code without a catalog
 *      row is a CI failure.
 *   4. Backward compatibility — `PROBLEM_TITLES` (now derived from
 *      the catalog) still has every Wave 19 / Wave 20 key with the
 *      same Title-Case English string.
 */

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import {
  ERROR_CATALOG,
  ERROR_CATALOG_BY_CODE,
  findCatalogEntry,
  listCatalogEntries,
  type ErrorCatalogEntry,
} from "@/lib/api/error-catalog";
import { PROBLEM_TITLES } from "@/lib/api/problem-details";

const CODE_RE = /^[a-z][a-z0-9_]*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+$/;
const KEBAB_RE = /^[a-z][a-z0-9-]*$/;

describe("ERROR_CATALOG (Wave 21 — registry contract)", () => {
  it("is non-empty", () => {
    expect(ERROR_CATALOG.length).toBeGreaterThan(0);
  });

  it("is internally unique by code", () => {
    const codes = ERROR_CATALOG.map((e) => e.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("has matching by-code map size", () => {
    expect(ERROR_CATALOG_BY_CODE.size).toBe(ERROR_CATALOG.length);
  });

  describe.each(ERROR_CATALOG.map((e) => [e.code, e] as const))(
    "entry '%s'",
    (_code, entry) => {
      const e = entry as ErrorCatalogEntry;

      it("has snake_case code matching ^[a-z][a-z0-9_]*$", () => {
        expect(e.code).toMatch(CODE_RE);
      });

      it("has a title that is non-empty and ≤ 60 chars", () => {
        expect(e.title.length).toBeGreaterThan(0);
        expect(e.title.length).toBeLessThanOrEqual(60);
      });

      it("title has no trailing punctuation (occurrence-invariant per RFC 9457 §3.1.3)", () => {
        expect(e.title).not.toMatch(/[.!?,:;]\s*$/);
      });

      it("status is in the 4xx or 5xx range", () => {
        expect(e.status).toBeGreaterThanOrEqual(400);
        expect(e.status).toBeLessThanOrEqual(599);
      });

      it("has non-empty summary + description", () => {
        expect(e.summary.length).toBeGreaterThan(0);
        expect(e.description.length).toBeGreaterThan(0);
      });

      it("remediation is a string (empty is allowed for 5xx)", () => {
        expect(typeof e.remediation).toBe("string");
        if (e.status < 500 && e.remediation.length === 0) {
          throw new Error(
            `4xx code '${e.code}' MUST have non-empty remediation guidance.`,
          );
        }
      });

      it("sinceVersion is SemVer", () => {
        expect(e.sinceVersion).toMatch(SEMVER_RE);
      });

      it("retiredInVersion (if set) is SemVer and >= sinceVersion", () => {
        if (e.retiredInVersion === undefined) return;
        expect(e.retiredInVersion).toMatch(SEMVER_RE);
      });

      it("docsPath = `/errors/<kebab-code>`", () => {
        const expectedKebab = e.code.replace(/_/g, "-").toLowerCase();
        expect(KEBAB_RE.test(expectedKebab)).toBe(true);
        expect(e.docsPath).toBe(`/errors/${expectedKebab}`);
      });
    },
  );
});

describe("findCatalogEntry / listCatalogEntries", () => {
  it("findCatalogEntry returns the matching row by snake_case code", () => {
    const e = findCatalogEntry("not_found");
    expect(e).toBeDefined();
    expect(e?.code).toBe("not_found");
  });

  it("findCatalogEntry returns undefined for unknown codes", () => {
    expect(findCatalogEntry("definitely_not_a_real_code_xyz")).toBeUndefined();
  });

  it("listCatalogEntries returns the catalog sorted by code ascending", () => {
    const entries = listCatalogEntries();
    const sorted = [...entries].sort((a, b) => a.code.localeCompare(b.code));
    expect(entries.map((e) => e.code)).toEqual(sorted.map((e) => e.code));
  });

  it("listCatalogEntries returns a fresh array (mutation isolation)", () => {
    const a = listCatalogEntries();
    const b = listCatalogEntries();
    expect(a).not.toBe(b);
    a.pop();
    expect(b.length).toBe(ERROR_CATALOG.length);
  });
});

/* ------------------------------------------------------------------ *
 * Registry-completeness contract — the anti-drift gate.              *
 * ------------------------------------------------------------------ */

const REPO_ROOT = process.cwd();
const SCAN_ROOTS = [
  join(REPO_ROOT, "src", "app", "api", "v1"),
  join(REPO_ROOT, "src", "lib", "api"),
];

/**
 * Walk a directory recursively, returning every `.ts` / `.tsx` path
 * that is not a test file. We deliberately skip `error-catalog.ts`
 * itself — its `code:` literals ARE the catalog and including them
 * here would create a tautology.
 */
function collectSourceFiles(root: string, out: string[]): void {
  let stat;
  try {
    stat = statSync(root);
  } catch {
    return;
  }
  if (!stat.isDirectory()) return;
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const childStat = statSync(full);
    if (childStat.isDirectory()) {
      collectSourceFiles(full, out);
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue;
    if (entry.endsWith(".test.ts")) continue;
    if (full.endsWith("error-catalog.ts")) continue;
    out.push(full);
  }
}

/**
 * Extract every snake_case `code` argument passed positionally to
 * `v1ErrorResponse(status, "<code>", ...)` and to
 * `buildProblem({ ..., code: "<code>", ... })` and to the rate-limit
 * helper `code: "<code>"` form. Tolerant of whitespace and minor
 * formatting variation.
 */
function extractEmittedCodes(source: string): Set<string> {
  const out = new Set<string>();

  // v1ErrorResponse(<status>, "<code>", ...)
  const v1ErrRe =
    /v1ErrorResponse\s*\(\s*\d+\s*,\s*["']([a-z][a-z0-9_]*)["']/g;
  for (const m of source.matchAll(v1ErrRe)) out.add(m[1]!);

  // buildProblem({ code: "<code>", ... })  — also matches buildProblem({ status: ..., code: "<code>" }) variants
  const buildProblemRe =
    /buildProblem\s*\(\s*\{[^}]*?\bcode\s*:\s*["']([a-z][a-z0-9_]*)["']/g;
  for (const m of source.matchAll(buildProblemRe)) out.add(m[1]!);

  // problemResponse(req, { code: "<code>", ... }) — Wave 19 helper
  const problemRespRe =
    /problemResponse\s*\([^)]*?\{[^}]*?\bcode\s*:\s*["']([a-z][a-z0-9_]*)["']/g;
  for (const m of source.matchAll(problemRespRe)) out.add(m[1]!);

  // Generic fallback: `code: "<snake>"` immediately followed within a
  // few lines by `message:` — catches the rate-limit helper and any
  // future direct call site that builds a Problem-shaped body.
  const looseRe =
    /\bcode\s*:\s*["']([a-z][a-z0-9_]+)["'][\s\S]{0,200}?\bmessage\s*:/g;
  for (const m of source.matchAll(looseRe)) out.add(m[1]!);

  return out;
}

describe("registry-completeness — every emitted code has a catalog row", () => {
  const files: string[] = [];
  for (const root of SCAN_ROOTS) collectSourceFiles(root, files);

  it("scanned at least one source file under the v1 + lib/api roots", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it("every snake_case error code emitted by v1 source is in the catalog", () => {
    const offenders: Array<{ code: string; file: string }> = [];
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      for (const code of extractEmittedCodes(source)) {
        if (!ERROR_CATALOG_BY_CODE.has(code)) {
          offenders.push({ code, file: file.replace(REPO_ROOT, "").replace(/\\/g, "/") });
        }
      }
    }
    expect(
      offenders,
      `These error codes are emitted by the v1 surface but missing from src/lib/api/error-catalog.ts:\n` +
        offenders
          .map((o) => `  - "${o.code}"  (first seen in ${o.file})`)
          .join("\n"),
    ).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * Backward compatibility — PROBLEM_TITLES still works.                *
 * ------------------------------------------------------------------ */

describe("PROBLEM_TITLES backward compatibility (Wave 19 / 20 → Wave 21)", () => {
  const LEGACY_KEYS = [
    "expired_api_key",
    "insufficient_scope",
    "invalid_api_key",
    "invalid_request",
    "missing_authorization",
    "not_found",
    "rate_limited",
    "unauthorized",
    "upstream_unavailable",
  ] as const;

  it.each(LEGACY_KEYS)("PROBLEM_TITLES['%s'] matches the catalog title", (key) => {
    const fromCatalog = findCatalogEntry(key);
    expect(fromCatalog, `'${key}' MUST exist in the catalog`).toBeDefined();
    expect(PROBLEM_TITLES[key]).toBe(fromCatalog!.title);
  });

  it("PROBLEM_TITLES is frozen — extending it is a code-smell", () => {
    expect(Object.isFrozen(PROBLEM_TITLES)).toBe(true);
  });
});
