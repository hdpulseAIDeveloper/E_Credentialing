/**
 * GET /api/v1/health
 *
 * Wave 12 (2026-04-18). Customer-facing health probe — the canonical
 * "is my API key working against this environment?" check.
 *
 * Behaviour:
 *   - Requires a valid Bearer API key (so unauthenticated traffic
 *     can't use this as a free liveness probe — that's what the
 *     internal `/api/health` route is for).
 *   - Does NOT require any specific scope. The contract is "any
 *     active key, even one with zero scopes, returns 200 here".
 *     This makes it the natural first call when a customer is
 *     wiring up the SDK.
 *   - Returns the keyId (so the customer can confirm which key is
 *     active without echoing the secret), the API surface version,
 *     and a server-side timestamp for clock-skew checks.
 *   - Never returns PHI. Never returns customer-specific data
 *     beyond the key fingerprint.
 *
 * Versioning
 * ----------
 * This endpoint ships in v1.1.0 (SemVer minor — additive only).
 * See `docs/api/versioning.md` for the policy.
 *
 * Anti-weakening
 * --------------
 * - Do NOT add scope-bypass logic for any other route. The
 *   "scopeless but authenticated" pattern is unique to /health.
 * - Do NOT echo the bearer key in the response.
 * - Do NOT expand the response beyond { ok, keyId, apiVersion, time }
 *   without bumping `info.version` again.
 */

import { NextResponse } from "next/server";
import { authenticateApiKey } from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";
import {
  applyEtagHeader,
  evaluateConditionalGet,
  notModifiedResponse,
} from "@/lib/api/etag";
import { applyDeprecationByRoute } from "@/lib/api/deprecation";

const API_VERSION = "1.8.0";
const ROUTE_PATH = "/api/v1/health";

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

  // ETag is computed over the *cacheable* subset of the body — the
  // per-request `time` field would otherwise force a cache miss on
  // every poll, defeating the conditional-GET contract. Customers
  // who do get a 200 still see the freshest timestamp; clients
  // relying on the timestamp for clock-skew detection should not
  // use `If-None-Match` on this endpoint.
  const cacheable = {
    ok: true,
    keyId: auth.keyId!,
    apiVersion: API_VERSION,
  };
  const conditional = evaluateConditionalGet(request, cacheable);

  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: "/api/v1/health",
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

  const body = {
    ...cacheable,
    time: new Date().toISOString(),
  };

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/v1/health",
    status: 200,
    resultCount: 1,
    requestId,
  });

  return applyDeprecationByRoute(
    applyRequestIdHeader(
      applyRateLimitHeaders(
        applyEtagHeader(
          NextResponse.json(body, {
            status: 200,
            headers: {
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
