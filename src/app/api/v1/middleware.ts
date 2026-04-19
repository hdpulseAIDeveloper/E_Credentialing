import { db } from "@/server/db";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  buildRateLimitResponse,
  evaluateRateLimit,
  type RateLimitState,
} from "@/lib/api/rate-limit";

export interface ApiKeyAuthResult {
  valid: boolean;
  keyId?: string;
  permissions?: Record<string, boolean>;
  /**
   * Rate-limit snapshot for this request. Always populated when
   * `valid === true` so route handlers can attach `X-RateLimit-*`
   * headers to their successful responses via
   * `applyRateLimitHeaders(response, auth.rateLimit)`.
   */
  rateLimit?: RateLimitState;
  error?: NextResponse;
}

const RATE_LIMIT_PER_MINUTE = parseInt(process.env.API_RATE_LIMIT_PER_MINUTE ?? "120", 10);

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: v1ErrorResponse(401, "missing_authorization", "Missing or invalid Authorization header. Use Bearer <api-key>"),
    };
  }

  const rawKey = authHeader.slice(7);
  if (rawKey.length < 16) {
    return {
      valid: false,
      error: v1ErrorResponse(401, "invalid_api_key", "Invalid API key format"),
    };
  }
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || !apiKey.isActive) {
    return {
      valid: false,
      error: v1ErrorResponse(401, "invalid_api_key", "Invalid or revoked API key"),
    };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      valid: false,
      error: v1ErrorResponse(401, "expired_api_key", "API key has expired"),
    };
  }

  // Per-key fixed-window rate limit. State is computed unconditionally
  // so we can surface X-RateLimit-* headers on every response.
  const rl = evaluateRateLimit(`apikey:${apiKey.id}`, { limit: RATE_LIMIT_PER_MINUTE });
  if (!rl.allowed) {
    return { valid: false, error: buildRateLimitResponse(rl) };
  }

  // Best-effort lastUsedAt update (do not block the request on failure).
  void db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    valid: true,
    keyId: apiKey.id,
    permissions: (apiKey.permissions as Record<string, boolean>) || {},
    rateLimit: rl,
  };
}

/**
 * Scope check helper. Returns a 403 response if the key lacks the required
 * scope; returns null when authorized.
 *
 * Scopes are boolean flags stored in `api_keys.permissions`. Example:
 *   { "providers:read": true, "sanctions:read": true }
 *
 * Scope names are colon-delimited and read-only by convention in v1.
 */
export function requireScope(
  auth: ApiKeyAuthResult,
  scope: string,
): NextResponse | null {
  if (!auth.valid || !auth.permissions) {
    return v1ErrorResponse(401, "unauthorized", "Unauthorized");
  }
  if (auth.permissions[scope] !== true) {
    return v1ErrorResponse(
      403,
      "insufficient_scope",
      `This API key is missing the '${scope}' scope`,
      { required: scope },
    );
  }
  return null;
}

/**
 * Build a v1-shaped JSON error response.
 *
 * Standard envelope across the entire `/api/v1/*` surface:
 *
 *   { "error": { "code": "...", "message": "...", ...extras } }
 *
 * This is the contract the OpenAPI `Error` schema describes and the
 * one the TypeScript SDK (`V1ApiError`) parses to surface
 * `error.code` and `error.message`. **Never** flatten or rename
 * these fields without bumping `info.version` and following the
 * deprecation policy in `docs/api/versioning.md`.
 */
export function v1ErrorResponse(
  status: number,
  code: string,
  message: string,
  extras: Record<string, unknown> = {},
): NextResponse {
  return NextResponse.json(
    { error: { code, message, ...extras } },
    { status },
  );
}

/**
 * Scope registry — single source of truth so docs, UI, and runtime agree.
 */
export const API_SCOPES = [
  "providers:read",
  "providers:cv",
  "sanctions:read",
  "enrollments:read",
  "fhir:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];
