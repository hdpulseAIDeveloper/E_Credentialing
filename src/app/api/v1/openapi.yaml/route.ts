/**
 * GET /api/v1/openapi.yaml
 *
 * Wave 8 (2026-04-18). Serves the OpenAPI 3.1 specification for the
 * public REST v1 surface. Source of truth lives at
 * `docs/api/openapi-v1.yaml` and is read at request time (no
 * processing — the file is the contract).
 *
 * Anti-weakening: this route MUST NOT transform the spec. A
 * regenerated or hand-edited contract should ship as-is. The pillar-J
 * iterator + the OpenAPI coverage test (see
 * `tests/contract/pillar-j-openapi.spec.ts`) ensure every inventoried
 * /api/v1 route appears in the spec.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

let cachedSpec: string | null = null;

async function loadSpec(): Promise<string> {
  if (cachedSpec) return cachedSpec;
  const path = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
  cachedSpec = await readFile(path, "utf-8");
  return cachedSpec;
}

export async function GET(): Promise<NextResponse> {
  const yaml = await loadSpec();
  return new NextResponse(yaml, {
    status: 200,
    headers: {
      // RFC 9512 — official OpenAPI YAML media type.
      "Content-Type": "application/yaml; charset=utf-8",
      "Cache-Control": "public, max-age=300, s-maxage=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
