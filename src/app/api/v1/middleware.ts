import { db } from "@/server/db";
import { createHash } from "crypto";
import { NextResponse } from "next/server";

export async function authenticateApiKey(request: Request): Promise<{ valid: boolean; keyId?: string; permissions?: Record<string, boolean>; error?: NextResponse }> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return {
      valid: false,
      error: NextResponse.json({ error: "Missing or invalid Authorization header. Use Bearer <api-key>" }, { status: 401 }),
    };
  }

  const rawKey = authHeader.slice(7);
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

  await db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  });

  return {
    valid: true,
    keyId: apiKey.id,
    permissions: (apiKey.permissions as Record<string, boolean>) || {},
  };
}
