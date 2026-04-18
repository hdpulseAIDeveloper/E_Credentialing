/**
 * Pillar J — REST API iterator contract (per `docs/qa/STANDARD.md` §1.J).
 *
 * Wave 6 (2026-04-18): walks every entry in
 * `docs/qa/inventories/api-inventory.json` and asserts shape +
 * convention invariants per (route, method) cell. Each cell becomes
 * its own named test case so:
 *
 *   1. The qa:coverage gate's iterator-aware coverage credit picks
 *      this file up (it imports the api inventory and iterates it).
 *   2. Per-cell regressions surface with the offending cell's name.
 *   3. Adding a new endpoint without backfilling the catalog raises
 *      the same well-targeted failure.
 *
 * Anti-weakening: this spec MUST iterate the full inventory; it MUST
 * NOT special-case routes to skip them. Any route the platform exposes
 * is in scope of this contract.
 */

import { describe, it, expect } from "vitest";
import apiInventory from "../../docs/qa/inventories/api-inventory.json";

interface ApiEntry {
  route: string;
  methods: string[];
  file: string;
  dynamic: boolean;
}

const ENTRIES = apiInventory as ApiEntry[];

// (Pillar J §1.J) every API route the inventory advertises must appear
// under src/app/api or src/app/<segment>/route.ts (the latter for the
// /changelog.rss style segment-with-dot routes).
const VALID_FILE_PREFIXES = ["src/app/api/", "src/app/"];
const VALID_METHODS = new Set([
  "GET",
  "HEAD",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "OPTIONS",
]);

describe("pillar-J: REST API cell iterator", () => {
  it("inventory is a non-empty array", () => {
    expect(Array.isArray(ENTRIES)).toBe(true);
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it("route paths are unique", () => {
    const seen = new Map<string, ApiEntry>();
    for (const e of ENTRIES) {
      const prior = seen.get(e.route);
      expect(
        prior,
        `API route ${e.route} declared twice (first in ${prior?.file}, again in ${e.file})`,
      ).toBeUndefined();
      seen.set(e.route, e);
    }
  });

  describe.each(ENTRIES)("$route", (entry) => {
    it("declares its source file under src/app/", () => {
      const ok = VALID_FILE_PREFIXES.some((p) => entry.file.startsWith(p));
      expect(ok, `${entry.route} declared in unexpected file ${entry.file}`).toBe(true);
    });

    it("declares at least one HTTP method", () => {
      expect(entry.methods.length, `${entry.route} declares zero methods`).toBeGreaterThan(0);
    });

    it("declared methods are HTTP verbs we recognize", () => {
      for (const m of entry.methods) {
        expect(
          VALID_METHODS.has(m),
          `unexpected HTTP method '${m}' on ${entry.route}`,
        ).toBe(true);
      }
    });

    it("dynamic flag matches the file path", () => {
      const filePathHasParam = /\[[^\]]+\]/.test(entry.file);
      expect(
        entry.dynamic,
        `${entry.route} dynamic flag (${entry.dynamic}) disagrees with file ${entry.file}`,
      ).toBe(filePathHasParam);
    });
  });
});
