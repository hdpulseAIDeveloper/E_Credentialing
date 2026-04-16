/**
 * Verifies a provider invite/magic-link JWT and returns the associated provider.
 *
 * Security checks:
 *  1. JWT signature + expiry must validate against NEXTAUTH_SECRET.
 *  2. The token presented must equal the value stored on Provider.inviteToken
 *     (single-active-token enforcement; rotated by sendInvite).
 *  3. Provider.inviteTokenExpiresAt must be in the future.
 *  4. Provider.status must be in an onboarding-eligible state
 *     (INVITED, ONBOARDING_IN_PROGRESS, DOCUMENTS_PENDING).
 */
import { jwtVerify } from "jose";
import { db } from "@/server/db";

export interface VerifiedProviderToken {
  providerId: string;
  email: string | null;
}

const ELIGIBLE_STATUSES = new Set([
  "INVITED",
  "ONBOARDING_IN_PROGRESS",
  "DOCUMENTS_PENDING",
]);

export async function verifyProviderInviteToken(
  token: string
): Promise<VerifiedProviderToken> {
  if (!token || typeof token !== "string") {
    throw new ProviderTokenError("invalid_token", 401);
  }

  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  let providerIdClaim: string;
  let emailClaim: string | null = null;
  try {
    const { payload } = await jwtVerify(token, secret);
    providerIdClaim = payload.providerId as string;
    emailClaim = (payload.email as string | undefined) ?? null;
    if (payload.type !== "magic-link") {
      throw new ProviderTokenError("invalid_token_type", 401);
    }
  } catch {
    throw new ProviderTokenError("invalid_or_expired_token", 401);
  }

  const provider = await db.provider.findUnique({
    where: { id: providerIdClaim },
    select: { id: true, status: true, inviteToken: true, inviteTokenExpiresAt: true },
  });
  if (!provider) {
    throw new ProviderTokenError("provider_not_found", 404);
  }
  if (provider.inviteToken !== token) {
    throw new ProviderTokenError("token_revoked", 401);
  }
  if (provider.inviteTokenExpiresAt && provider.inviteTokenExpiresAt < new Date()) {
    throw new ProviderTokenError("token_expired", 401);
  }
  if (!ELIGIBLE_STATUSES.has(provider.status)) {
    throw new ProviderTokenError("provider_not_eligible", 403);
  }

  return { providerId: provider.id, email: emailClaim };
}

export class ProviderTokenError extends Error {
  status: number;
  constructor(code: string, status: number) {
    super(code);
    this.name = "ProviderTokenError";
    this.status = status;
  }
}
