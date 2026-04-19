/**
 * Pillar J — Postman collection parity contract.
 *
 * Wave 11 (2026-04-18). The auto-generated Postman v2.1.0 collection
 * at `public/api/v1/postman.json` MUST cover every operation in
 * `docs/api/openapi-v1.yaml`. This test:
 *
 *   1. Asserts the generator produces a Postman v2.1.0 schema URI.
 *   2. Iterates every (path, method) pair in the spec and confirms
 *      a matching item exists in the collection.
 *   3. Asserts the bearer auth + base_url variables are wired so
 *      customers point one field at their environment.
 *   4. Asserts the served route handler at `/api/v1/postman.json`
 *      streams the same content with the right Content-Disposition.
 *
 * Anti-weakening
 * --------------
 * - Adding a new endpoint to the OpenAPI spec without regenerating
 *   the collection MUST fail this suite.
 * - The variable names `base_url` and `api_key` are the customer
 *   contract — renaming them is a breaking change.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { GET as getPostman } from "../../src/app/api/v1/postman.json/route";

const SPEC_PATH = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
const COLLECTION_PATH = join(process.cwd(), "public", "api", "v1", "postman.json");

const SPEC = yaml.load(readFileSync(SPEC_PATH, "utf-8")) as {
  paths: Record<string, Record<string, unknown>>;
};
const COLLECTION = JSON.parse(readFileSync(COLLECTION_PATH, "utf-8")) as {
  info: { name: string; schema: string; version?: string };
  auth: { type: string; bearer: Array<{ key: string; value: string }> };
  variable: Array<{ key: string; value: string }>;
  item: Array<{
    name: string;
    item: Array<{ name: string; request: { method: string; url: { raw: string } } }>;
  }>;
};

const HTTP_METHODS = new Set([
  "get",
  "post",
  "put",
  "patch",
  "delete",
  "head",
  "options",
]);

function flattenItems(): Array<{ method: string; raw: string }> {
  const out: Array<{ method: string; raw: string }> = [];
  for (const folder of COLLECTION.item) {
    for (const item of folder.item) {
      out.push({
        method: item.request.method.toUpperCase(),
        raw: item.request.url.raw,
      });
    }
  }
  return out;
}

const COLLECTION_OPS = flattenItems();

const SPEC_OPS: Array<{ path: string; method: string }> = [];
for (const [p, ops] of Object.entries(SPEC.paths)) {
  for (const m of Object.keys(ops)) {
    if (HTTP_METHODS.has(m)) {
      SPEC_OPS.push({ path: p, method: m.toUpperCase() });
    }
  }
}

describe("pillar-J: Postman collection parity", () => {
  it("declares Postman Collection v2.1.0 schema", () => {
    expect(COLLECTION.info.schema).toBe(
      "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    );
  });

  it("declares bearer auth wired to {{api_key}}", () => {
    expect(COLLECTION.auth.type).toBe("bearer");
    expect(COLLECTION.auth.bearer[0]?.value).toBe("{{api_key}}");
  });

  it("ships the {{base_url}} and {{api_key}} variables (customer contract)", () => {
    const keys = new Set(COLLECTION.variable.map((v) => v.key));
    expect(keys.has("base_url")).toBe(true);
    expect(keys.has("api_key")).toBe(true);
  });

  it("the {{api_key}} variable ships empty (no baked credentials)", () => {
    const k = COLLECTION.variable.find((v) => v.key === "api_key");
    expect(k?.value).toBe("");
  });

  it("ships at least one operation", () => {
    expect(COLLECTION_OPS.length).toBeGreaterThan(0);
  });

  describe.each(SPEC_OPS)("$method $path", ({ path, method }) => {
    it("appears in the Postman collection", () => {
      const oaToPostman = path.replace(/\{(.+?)\}/g, ":$1");
      const match = COLLECTION_OPS.find(
        (op) => op.method === method && op.raw.endsWith(oaToPostman),
      );
      expect(
        match,
        `Postman collection missing ${method} ${path} — run \`npm run postman:gen\` and commit.`,
      ).toBeTruthy();
    });
  });

  describe("/api/v1/postman.json route handler", () => {
    function freshRequest(): Request {
      return new Request("https://x/api/v1/postman.json");
    }

    it("responds 200 with application/json + attachment disposition", async () => {
      const res = await getPostman(freshRequest());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
      expect(res.headers.get("content-disposition") ?? "").toMatch(
        /attachment.*postman_collection\.json/,
      );
    });

    it("body parses as the same Postman collection", async () => {
      const res = await getPostman(freshRequest());
      const body = JSON.parse(await res.text()) as {
        info: { schema: string };
      };
      expect(body.info.schema).toBe(COLLECTION.info.schema);
    });
  });
});
