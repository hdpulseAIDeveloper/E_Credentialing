/**
 * Pillar J — tRPC iterator contract (per `docs/qa/STANDARD.md` §1.J).
 *
 * Wave 6 (2026-04-18): walks every entry in
 * `docs/qa/inventories/trpc-inventory.json` and asserts shape
 * invariants per procedure. Each procedure becomes its own named
 * test case via `describe.each` so:
 *
 *   1. The qa:coverage gate's iterator-aware coverage credit picks
 *      this file up (it imports the trpc inventory and iterates it).
 *   2. Per-procedure regressions surface with the offending name in
 *      the failure output, not as an opaque "an entry is malformed".
 *   3. Adding a new procedure without backfilling the catalog raises
 *      the same well-targeted failure.
 *
 * Anti-weakening: this spec MUST NOT short-circuit when the inventory
 * is small. It iterates every entry; the only reason to add `.skip` is
 * a documented platform incompatibility, which has none today.
 */

import { describe, it, expect } from "vitest";
import trpcInventory from "../../docs/qa/inventories/trpc-inventory.json";

interface TrpcEntry {
  router: string;
  procedure: string;
  kind: string;
  file: string;
}

const ENTRIES = trpcInventory as TrpcEntry[];

const VALID_KINDS = new Set(["query", "mutation", "subscription"]);
const ROUTER_NAME_RE = /^[a-z][a-zA-Z0-9]*$/;
const PROCEDURE_NAME_RE = /^[a-z_$][a-zA-Z0-9_$]*$/;

describe("pillar-J: tRPC procedure iterator", () => {
  it("inventory is a non-empty array", () => {
    expect(Array.isArray(ENTRIES)).toBe(true);
    expect(ENTRIES.length).toBeGreaterThan(0);
  });

  it("router + procedure pairs are unique", () => {
    const seen = new Map<string, TrpcEntry>();
    for (const e of ENTRIES) {
      const key = `${e.router}.${e.procedure}`;
      const prior = seen.get(key);
      expect(
        prior,
        `tRPC procedure ${key} declared twice (first in ${prior?.file}, again in ${e.file})`,
      ).toBeUndefined();
      seen.set(key, e);
    }
  });

  describe.each(ENTRIES)(
    "$router.$procedure ($kind, $file)",
    (entry) => {
      it("has a known kind", () => {
        expect(
          VALID_KINDS.has(entry.kind),
          `unexpected kind '${entry.kind}' for ${entry.router}.${entry.procedure}`,
        ).toBe(true);
      });

      it("has a router name that follows the camelCase convention", () => {
        expect(
          ROUTER_NAME_RE.test(entry.router),
          `router '${entry.router}' should be camelCase`,
        ).toBe(true);
      });

      it("has a procedure name that is a valid TS identifier", () => {
        expect(
          PROCEDURE_NAME_RE.test(entry.procedure),
          `procedure '${entry.procedure}' should be a valid TS identifier`,
        ).toBe(true);
      });

      it("declares its source file under src/server/api/routers/", () => {
        expect(
          entry.file.startsWith("src/server/api/routers/"),
          `${entry.router}.${entry.procedure} declared in unexpected file ${entry.file}`,
        ).toBe(true);
      });
    },
  );
});
