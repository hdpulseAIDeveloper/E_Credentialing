import { db } from "@/server/db";
import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rate-limit";

export interface ApiKeyAuthResult {
  valid: boolean;
  keyId?: string;
  permissions?: Record<string, boolean>;
  error?: NextResponse;
}

const RATE_LIMIT_PER_MINUTE = parseInt(process.env.API_RATE_LIMIT_PER_MINUTE ?? "120", 10);

export async function authenticateApiKey(request: Request): Promise<ApiKeyAuthResult> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: "Missing or invalid Authorization header. Use Bearer <api-key>" },
        { status: 401 }
      ),
    };
  }

  const rawKey = authHeader.slice(7);
  if (rawKey.length < 16) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Invalid API key format" }, { status: 401 }),
    };
  }
  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await db.apiKey.findUnique({ where: { keyHash } });
  if (!apiKey || !apiKey.isActive) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 }),
    };
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      valid: false,
      error: NextResponse.json({ error: "API key has expired" }, { status: 401 }),
    };
  }

  // Rate limit per API key — fixed window of 60s.
  const rl = rateLimit(`apikey:${apiKey.id}`, { limit: RATE_LIMIT_PER_MINUTE });
  if (rl) {
    return { valid: false, error: rl };
  }

  // Best-effort lastUsedAt update (do not block the request on failure).
  void db.apiKey
    .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined);

  return {
    valid: true,
    keyId: apiKey.id,
    permissions: (apiKey.permissions as Record<string, boolean>) || {},
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (auth.permissions[scope] !== true) {
    return NextResponse.json(
      {
        error: "insufficient_scope",
        message: `This API key is missing the '${scope}' scope`,
        required: scope,
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Scope registry — single source of truth so docs, UI, and runtime agree.
 */
export const API_SCOPES = [
  "providers:read",
  "sanctions:read",
  "enrollments:read",
  "fhir:read",
] as const;

export type ApiScope = (typeof API_SCOPES)[number];

