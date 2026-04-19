/**
 * GET /api/v1/me
 *
 * Wave 15 (2026-04-18). Customer-facing API key introspection - the
 * canonical "what can this API key actually do?" check. Pairs with
 * `/api/v1/health`: `/health` says "is my key working?", `/me` says
 * "what's my key allowed to do, and what's it look like server-side?".
 *
 * Behaviour:
 *   - Requires a valid Bearer API key. Like `/health`, no specific
 *     scope is required - any active key returns 200, even one with
 *     zero scopes (so customers can debug "why am I getting 403 from
 *     /providers?" without already having providers:read).
 *   - Returns the keyId, the human-readable key name (so customers
 *     can confirm which key is in use - "Production prod-east" vs
 *     "Staging eng team"), the granted scopes as a stable string
 *     array, the createdAt/expiresAt/lastUsedAt timestamps, and the
 *     current rate-limit budget snapshot.
 *   - Never returns the bearer key, the key hash, or PHI of any kind.
 *
 * Versioning
 * ----------
 * This endpoint ships in v1.4.0 (SemVer minor - additive only).
 * See `docs/api/versioning.md` for the policy.
 *
 * Anti-weakening
 * --------------
 * - Do NOT echo the bearer key or its sha256 hash in the response.
 * - Do NOT add provider/PHI fields to the response - this is a key
 *   introspection endpoint, not a bulk export.
 * - Do NOT widen the scope grant beyond what the key actually has;
 *   the `scopes` array MUST mirror `api_keys.permissions` exactly.
 * - Do NOT remove `lastUsedAt` from the response - it's the lookup
 *   key for "is this key still in use?" key-rotation workflows.
 */

import { NextResponse } from "next/server";
import { authenticateApiKey, API_SCOPES, v1ErrorResponse } from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";
import {
  applyEtagHeader,
  evaluateConditionalGet,
  notModifiedResponse,
} from "@/lib/api/etag";
import { applyDeprecationByRoute } from "@/lib/api/deprecation";
import { db } from "@/server/db";

const ROUTE_PATH = "/api/v1/me";

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

  // Re-fetch the row so we can surface name/createdAt/expiresAt/lastUsedAt.
  // authenticateApiKey already validated the key and the row exists; this
  // second read is the cost of an introspection endpoint and is fine.
  const row = await db.apiKey.findUnique({
    where: { id: auth.keyId! },
    select: {
      id: true,
      name: true,
      permissions: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  });

  if (!row) {
    return applyDeprecationByRoute(
      applyRequestIdHeader(
        v1ErrorResponse(404, "not_found", "API key not found", {}, request),
        requestId,
      ),
      "GET",
      ROUTE_PATH,
    );
  }

  const grantedPermissions = (row.permissions as Record<string, boolean>) ?? {};
  // Filter to the registered scopes so callers can rely on the stable
  // vocabulary - any extra junk in the JSON column is dropped server-side.
  const scopes = API_SCOPES.filter((s) => grantedPermissions[s] === true);

  const rl = auth.rateLimit;

  // ETag is computed over the *cacheable* subset of the body. We
  // exclude `lastUsedAt` (mutates on every authenticated call —
  // including the call that produced *this* response) and the
  // `rateLimit` snapshot (mutates as the budget window decays).
  // The remaining fields - keyId, name, scopes, createdAt,
  // expiresAt - capture the only metadata a caller would actually
  // poll for.
  const cacheable = {
    keyId: row.id,
    name: row.name,
    scopes,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
  };
  const conditional = evaluateConditionalGet(request, cacheable);

  if (conditional.status === "not-modified") {
    void auditApiRequest({
      apiKeyId: auth.keyId!,
      method: "GET",
      path: "/api/v1/me",
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
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
    rateLimit: rl
      ? {
          limit: rl.limit,
          remaining: rl.remaining,
          resetUnixSeconds: rl.resetUnixSeconds,
        }
      : null,
  };

  void auditApiRequest({
    apiKeyId: auth.keyId!,
    method: "GET",
    path: "/api/v1/me",
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
