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
import { authenticateApiKey, API_SCOPES } from "../middleware";
import { applyRateLimitHeaders } from "@/lib/api/rate-limit";
import { applyRequestIdHeader, resolveRequestId } from "@/lib/api/request-id";
import { auditApiRequest } from "@/lib/api/audit-api";
import { db } from "@/server/db";

export async function GET(request: Request): Promise<NextResponse> {
  const requestId = resolveRequestId(request);
  const auth = await authenticateApiKey(request);
  if (!auth.valid) return applyRequestIdHeader(auth.error!, requestId);

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
    return applyRequestIdHeader(
      NextResponse.json(
        { error: { code: "not_found", message: "API key not found" } },
        { status: 404 },
      ),
      requestId,
    );
  }

  const grantedPermissions = (row.permissions as Record<string, boolean>) ?? {};
  // Filter to the registered scopes so callers can rely on the stable
  // vocabulary - any extra junk in the JSON column is dropped server-side.
  const scopes = API_SCOPES.filter((s) => grantedPermissions[s] === true);

  const rl = auth.rateLimit;

  const body = {
    keyId: row.id,
    name: row.name,
    scopes,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
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

  return applyRequestIdHeader(
    applyRateLimitHeaders(
      NextResponse.json(body, {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }),
      auth.rateLimit,
    ),
    requestId,
  );
}
