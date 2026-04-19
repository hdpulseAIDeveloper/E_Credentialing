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

import {
  applyEtagHeader,
  computeWeakEtagFromBytes,
  matchesEtag,
  notModifiedResponse,
  parseIfNoneMatch,
} from "@/lib/api/etag";

export const runtime = "nodejs";

let cachedSpec: string | null = null;
let cachedEtag: string | null = null;

async function loadSpec(): Promise<{ yaml: string; etag: string }> {
  if (cachedSpec && cachedEtag) return { yaml: cachedSpec, etag: cachedEtag };
  const path = join(process.cwd(), "docs", "api", "openapi-v1.yaml");
  cachedSpec = await readFile(path, "utf-8");
  cachedEtag = computeWeakEtagFromBytes(cachedSpec);
  return { yaml: cachedSpec, etag: cachedEtag };
}

export async function GET(request: Request): Promise<NextResponse> {
  const { yaml, etag } = await loadSpec();
  const tokens = parseIfNoneMatch(request.headers.get("If-None-Match"));
  if (matchesEtag(etag, tokens)) {
    return notModifiedResponse(etag);
  }
  return applyEtagHeader(
    new NextResponse(yaml, {
      status: 200,
      headers: {
        // RFC 9512 — official OpenAPI YAML media type.
        "Content-Type": "application/yaml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=3600",
        "X-Content-Type-Options": "nosniff",
      },
    }),
    etag,
  );
}
