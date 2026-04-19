/**
 * Pillar J — OpenAPI JSON mirror parity test.
 *
 * Wave 9 (2026-04-18). The platform exposes the OpenAPI 3.1 spec at
 * BOTH `/api/v1/openapi.yaml` (RFC 9512 source of truth) AND
 * `/api/v1/openapi.json` (mechanical YAML→JSON conversion for tools
 * that don't speak YAML). This test:
 *
 *   1. Imports the JSON-mirror route handler directly.
 *   2. Invokes its `GET` and confirms the body parses as JSON.
 *   3. Loads the YAML source the same way the YAML route does.
 *   4. Confirms the two representations are deep-equal.
 *
 * Anti-weakening: the mirror MUST be a 1:1 conversion. Any divergence
 * (key reordering that changes meaning, dropped fields, added
 * decorations) MUST fail this suite. Updating only one of the two
 * routes is a defect.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as yaml from "js-yaml";
import { GET as getJson } from "../../src/app/api/v1/openapi.json/route";

describe("pillar-J: /api/v1/openapi.json mirrors /api/v1/openapi.yaml", () => {
  it("the JSON mirror responds 200 with application/json", async () => {
    const res = await getJson();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type") ?? "").toMatch(/application\/json/);
  });

  it("body parses as a valid JSON document", async () => {
    const res = await getJson();
    const text = await res.text();
    expect(() => JSON.parse(text)).not.toThrow();
  });

  it("is deep-equal to the parsed YAML source of truth", async () => {
    const res = await getJson();
    const fromMirror = JSON.parse(await res.text());

    const yamlPath = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
    const fromSource = yaml.load(readFileSync(yamlPath, "utf-8"));

    expect(fromMirror).toEqual(fromSource);
  });

  it("declares the same OpenAPI version + info as the YAML source", async () => {
    const res = await getJson();
    const doc = JSON.parse(await res.text()) as {
      openapi?: string;
      info?: { title?: string; version?: string };
    };
    expect(doc.openapi).toMatch(/^3\.1\./);
    expect(doc.info?.title).toBeTruthy();
    expect(doc.info?.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("emits sensible cache headers (5min browser, 1h CDN)", async () => {
    const res = await getJson();
    const cc = res.headers.get("cache-control") ?? "";
    expect(cc).toMatch(/max-age=300/);
    expect(cc).toMatch(/s-maxage=3600/);
  });
});
