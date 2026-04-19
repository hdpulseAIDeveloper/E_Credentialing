/**
 * GET /api/v1/openapi.json
 *
 * Wave 9 (2026-04-18). JSON mirror of the OpenAPI 3.1 specification
 * served at `/api/v1/openapi.yaml`. Many code generators, fuzzers,
 * and explorer UIs (Postman import, openapi-typescript, openapi-python-client,
 * Schemathesis with --base-url, Stoplight Elements) prefer JSON. The
 * source of truth is still `docs/api/openapi-v1.yaml`. The conversion
 * is mechanical and deterministic — `js-yaml.load` followed by
 * `JSON.stringify` with no key ordering changes.
 *
 * Anti-weakening: this route MUST NOT add, remove, or rename any field.
 * The pillar-J OpenAPI coverage test asserts both the YAML and JSON
 * surfaces describe the same set of paths and operations.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { load as loadYaml } from "js-yaml";

export const runtime = "nodejs";

let cachedJson: string | null = null;

async function loadSpecAsJson(): Promise<string> {
  if (cachedJson) return cachedJson;
  const path = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
  const yaml = await readFile(path, "utf-8");
  const parsed = loadYaml(yaml);
  cachedJson = JSON.stringify(parsed, null, 2);
  return cachedJson;
}

export async function GET(): Promise<NextResponse> {
  const json = await loadSpecAsJson();
  return new NextResponse(json, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
