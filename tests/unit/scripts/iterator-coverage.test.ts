/**
 * Unit tests for `scripts/qa/iterator-coverage.ts` (Wave 6 / ADR 0019).
 *
 * Anti-weakening (`docs/qa/STANDARD.md` §4.2): these tests pin the
 * iterator-detection rule. Loosening either requirement (the import
 * pattern OR the iteration construct) MUST cause one of these tests
 * to fail, surfacing the regression before it lowers the bar of the
 * coverage gate.
 */
import { describe, expect, it } from "vitest";
import { isIteratorSpec } from "../../../scripts/qa/iterator-coverage";

const ROUTE_IMPORT = `import inventory from "../../../docs/qa/inventories/route-inventory.json";`;
const API_IMPORT = `import api from "../../docs/qa/inventories/api-inventory.json";`;
const TRPC_IMPORT = `import trpc from "../../docs/qa/inventories/trpc-inventory.json";`;

describe("isIteratorSpec", () => {
  it("recognises a `for (… of inventory)` loop after a route inventory import", () => {
    const src = `${ROUTE_IMPORT}\nfor (const r of inventory) { test(r.route, () => {}); }`;
    expect(isIteratorSpec(src, "route")).toBe(true);
  });

  it("recognises `.map(` after the import", () => {
    const src = `${API_IMPORT}\napi.map((entry) => describe(entry.route, () => {}));`;
    expect(isIteratorSpec(src, "api")).toBe(true);
  });

  it("recognises `describe.each` after the import", () => {
    const src = `${TRPC_IMPORT}\ndescribe.each(trpc)("$router.$procedure", () => {});`;
    expect(isIteratorSpec(src, "trpc")).toBe(true);
  });

  it("returns false when the import is present but no iteration construct follows", () => {
    const src = `${ROUTE_IMPORT}\nconst count = inventory.length;`;
    expect(isIteratorSpec(src, "route")).toBe(false);
  });

  it("returns false when iteration is present but the import is wrong", () => {
    const src = `import x from "elsewhere";\nfor (const a of x) {}`;
    expect(isIteratorSpec(src, "route")).toBe(false);
  });

  it("does not treat an iteration that appears BEFORE the import as covering it", () => {
    // The iteration construct must follow the import; otherwise the
    // import is unrelated to the iteration.
    const src = `for (const a of [1, 2, 3]) {}\n${ROUTE_IMPORT}`;
    expect(isIteratorSpec(src, "route")).toBe(false);
  });

  it("is inventory-name specific — a route inventory import does NOT credit the api inventory", () => {
    const src = `${ROUTE_IMPORT}\nfor (const r of inventory) {}`;
    expect(isIteratorSpec(src, "api")).toBe(false);
    expect(isIteratorSpec(src, "trpc")).toBe(false);
  });

  it("accepts both single- and double-quoted import specifiers", () => {
    const single = `import inv from '../../docs/qa/inventories/route-inventory.json';\nfor (const r of inv) {}`;
    expect(isIteratorSpec(single, "route")).toBe(true);
  });

  it("returns false on an empty source", () => {
    expect(isIteratorSpec("", "route")).toBe(false);
    expect(isIteratorSpec("", "api")).toBe(false);
    expect(isIteratorSpec("", "trpc")).toBe(false);
  });
});
