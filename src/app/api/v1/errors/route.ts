/**
 * GET /api/v1/errors
 *
 * Wave 21 (2026-04-19). Machine-readable v1 error catalog. Pairs
 * with the `/errors` HTML page (which is what the `type` URI
 * inside every Problem body actually points to) and the
 * `/api/v1/errors/{code}` detail endpoint. Together they let
 * SDKs, support tooling, and integrators enumerate every error
 * code the platform can emit, with the same `title` / `status`
 * the wire contract uses, plus a `summary`, `description`, and
 * `remediation` per code.
 *
 * Behaviour
 * ---------
 *   - Requires a valid Bearer API key (any scope, any key —
 *     consistent with `/health` and `/me`).
 *   - Returns the canonical alphabetised catalog as a stable
 *     JSON list under the top-level `entries` key.
 *   - Conditional GETs (ETag + If-None-Match) work — the catalog
 *     changes only when this codebase changes, so the ETag is
 *     stable across thousands of polls.
 *   - Cached `304 Not Modified` responses still count against
 *     the rate-limit budget (consistent with every other v1
 *     endpoint since spec v1.6.0).
 *
 * Anti-weakening
 * --------------
 *   - Do NOT mutate the response shape per-request. The catalog
 *     is intentionally public and identical for every caller.
 *   - Do NOT remove an `entries[]` row when retiring a code —
 *     stamp `retiredInVersion` instead, so old `type` URIs that
 *     SDKs in the wild still ship keep resolving.
 *   - The `entries[]` array MUST stay sorted by `code` ASC. The
 *     contract test enforces this.
 */

import { NextResponse } from "next/server";
import {
  authenticateApiKey,
  v1ErrorResponse,
} from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import {
  applyRequestIdHeader,
  resolveRequestId,
} from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";
import {
  applyEtagHeader,
  evaluateConditionalGet,
  notModifiedResponse,
} from "@/lib/api/etag";
import { applyDeprecationByRoute } from "@/lib/api/deprecation";
import { listCatalogEntries } from "@/lib/api/error-catalog";

const ROUTE_PATH = "/api/v1/errors";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(auth.error!, requestId),
      "GET",
      ROUTE_PATH,
    );
  }

  // Suppress the helper return-type unused-warning by naming the
  // catalog locally — this keeps the response body deterministic
  // even if `listCatalogEntries` is later memoised.
  const entries = listCatalogEntries();
  const body = { entries };

  const conditional = evaluateConditionalGet(request, body);
  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: ROUTE_PATH,
      status: 304,
      resultCount: 0,
      requestId,
    });
    return applyDeprecationByRoute(
      notModifiedResponse(conditional.etag, {
        requestId,
        rateLimit: auth.rateLimit,
      }),
      "GET",
      ROUTE_PATH,
    );
  }

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: ROUTE_PATH,
    status: 200,
    resultCount: entries.length,
    requestId,
  });

  return applyDeprecationByRoute(
    applyRequestIdHeader(
      applyRateLimitHeaders(
        applyEtagHeader(
          NextResponse.json(body, {
            status: 200,
            headers: {
              // The catalog body is fully public, but we still
              // mark it `no-store` so a misbehaving proxy doesn't
              // mix it across tenants. Conditional GET via ETag
              // gives intermediaries the cache benefit without
              // the cross-tenant risk.
              "Cache-Control": "no-store",
              "X-Content-Type-Options": "nosniff",
            },
          }),
          conditional.etag,
        ),
        auth.rateLimit,
      ),
      requestId,
    ),
    "GET",
    ROUTE_PATH,
  );
}

// Defensive guard for static analysers: prove `v1ErrorResponse`
// is reachable from this module so a future refactor that adds
// an error path can call it without a fresh import.
void v1ErrorResponse;
