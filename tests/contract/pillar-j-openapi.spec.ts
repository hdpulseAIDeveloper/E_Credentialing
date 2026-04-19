/**
 * Pillar J — OpenAPI 3.1 contract test (per `docs/qa/STANDARD.md` §1.J).
 *
 * Wave 8 (2026-04-18). Three guarantees:
 *
 *   1. The hand-edited `docs/api/openapi-v1.yaml` parses as valid YAML
 *      and declares OpenAPI 3.1.
 *   2. Every public REST v1 route in `api-inventory.json` (`/api/v1/*`)
 *      appears in the spec's `paths` (templated form, e.g. `{id}`),
 *      and every method declared in the inventory is documented.
 *   3. The spec contains no PHI field names that would silently
 *      contradict the platform's "no PHI in v1" promise — the
 *      ANTI_PHI_FIELDS list MUST NOT appear anywhere in the spec.
 *
 * Anti-weakening: do NOT relax the inventory↔spec match. Adding a new
 * /api/v1/* route without backfilling the spec MUST fail this suite.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import apiInventory from "../../docs/qa/inventories/api-inventory.json";

interface ApiEntry {
  route: string;
  methods: string[];
  file: string;
  dynamic: boolean;
}

const SPEC_PATH = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
const RAW = readFileSync(SPEC_PATH, "utf-8");
const SPEC = yaml.load(RAW) as {
  openapi: string;
  info: { title: string; version: string };
  paths: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, unknown> };
};

/** Templated routes use `{id}` in OpenAPI but `[id]` in the inventory. */
function inventoryRouteToOpenApi(route: string): string {
  return route.replace(/\[([^\]]+)\]/g, "{$1}");
}

// The OpenAPI document does not describe its own delivery channels:
//   - `/api/v1/openapi.yaml` (Wave 8 — RFC 9512 source of truth)
//   - `/api/v1/openapi.json` (Wave 9 — JSON mirror)
//   - `/api/v1/postman.json` (Wave 11 — Postman v2.1 collection)
// Documenting them in the spec would be a circular reference. The
// list below is the SOLE permitted exclusion. Adding any other entry
// here is a code-smell review item.
const SPEC_DELIVERY_ROUTES = new Set([
  "/api/v1/openapi.yaml",
  "/api/v1/openapi.json",
  "/api/v1/postman.json",
]);

const V1_ROUTES = (apiInventory as ApiEntry[]).filter(
  (e) => e.route.startsWith("/api/v1/") && !SPEC_DELIVERY_ROUTES.has(e.route),
);

const ANTI_PHI_FIELDS = [
  "ssn",
  "socialSecurityNumber",
  "dateOfBirth",
  "dob",
  "deaNumber",
  "personalAddress",
  "homeAddress",
  "personalEmail",
  "personalPhone",
];

describe("pillar-J: OpenAPI 3.1 contract", () => {
  it("docs/api/openapi-v1.yaml parses as valid YAML", () => {
    expect(SPEC).toBeTruthy();
    expect(typeof SPEC).toBe("object");
  });

  it("declares OpenAPI 3.1.x", () => {
    expect(SPEC.openapi).toMatch(/^3\.1\./);
  });

  it("declares an info.title and a semver info.version", () => {
    expect(SPEC.info?.title).toBeTruthy();
    expect(SPEC.info?.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("ships at least one /api/v1 route under v1 (not just stubs)", () => {
    expect(V1_ROUTES.length).toBeGreaterThan(0);
  });

  describe.each(V1_ROUTES)("inventory route $route", (entry) => {
    const oaPath = inventoryRouteToOpenApi(entry.route);

    it(`is present in OpenAPI paths as ${oaPath}`, () => {
      expect(
        SPEC.paths[oaPath],
        `OpenAPI spec missing path ${oaPath} for inventory route ${entry.route}`,
      ).toBeTruthy();
    });

    it("declares every method the inventory advertises", () => {
      const operations = SPEC.paths[oaPath] ?? {};
      for (const m of entry.methods) {
        const lower = m.toLowerCase();
        expect(
          operations[lower],
          `OpenAPI spec missing operation ${m} on ${oaPath} (inventory says it exists)`,
        ).toBeTruthy();
      }
    });
  });

  describe("anti-PHI guard", () => {
    /**
     * Walks the spec and collects every property name that appears
     * inside a JSON Schema object (`properties: { foo: ... }`). We
     * deliberately do NOT grep the raw YAML — the spec legitimately
     * describes what it *excludes* (`"never SSN, DOB, DEA"`) and that
     * descriptive prose MUST be allowed.
     */
    function collectPropertyNames(node: unknown, out: Set<string>): void {
      if (!node || typeof node !== "object") return;
      const obj = node as Record<string, unknown>;
      if (obj.properties && typeof obj.properties === "object") {
        for (const k of Object.keys(obj.properties as Record<string, unknown>)) {
          out.add(k);
        }
      }
      for (const v of Object.values(obj)) {
        collectPropertyNames(v, out);
      }
    }

    const propertyNames = (() => {
      const set = new Set<string>();
      collectPropertyNames(SPEC, set);
      return set;
    })();

    it.each(ANTI_PHI_FIELDS)(
      "no schema property is named '%s'",
      (field) => {
        const lowered = new Set([...propertyNames].map((p) => p.toLowerCase()));
        expect(
          lowered.has(field.toLowerCase()),
          `PHI field '${field}' appears as a schema property in the v1 OpenAPI spec — public REST v1 promises no PHI`,
        ).toBe(false);
      },
    );
  });
});
