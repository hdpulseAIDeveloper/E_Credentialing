/**
 * Provider invite-token verifier: end-to-end security assertions.
 *
 * This covers the security-critical path every unauthenticated
 * provider request flows through. Regressions would leak provider
 * data or allow token replay after rotation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT } from "jose";

const findUnique = vi.fn();
vi.mock("@/server/db", () => ({
  db: { provider: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

const { verifyProviderInviteToken, ProviderTokenError } = await import(
  "../../../../src/lib/auth/provider-token"
);

async function signToken(
  claims: Record<string, unknown>,
  { exp = "1h", secret = process.env.NEXTAUTH_SECRET! }: { exp?: string; secret?: string } = {},
): Promise<string> {
  const key = new TextEncoder().encode(secret);
  return new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(key);
}

describe("verifyProviderInviteToken", () => {
  beforeEach(() => {
    findUnique.mockReset();
    process.env.NEXTAUTH_SECRET = "unit-test-secret-min-32-characters";
  });

  it("rejects a missing or non-string token", async () => {
    await expect(verifyProviderInviteToken("")).rejects.toBeInstanceOf(ProviderTokenError);
  });

  it("rejects a JWT signed with the wrong secret", async () => {
    const bad = await signToken(
      { providerId: "p1", type: "magic-link" },
      { secret: "some-other-secret-also-32-chars-long!" },
    );
    await expect(verifyProviderInviteToken(bad)).rejects.toMatchObject({
      message: "invalid_or_expired_token",
      status: 401,
    });
  });

  it("rejects a token with the wrong 'type' claim", async () => {
    const wrongType = await signToken({ providerId: "p1", type: "session" });
    await expect(verifyProviderInviteToken(wrongType)).rejects.toMatchObject({
      message: "invalid_token_type",
      status: 401,
    });
  });

  it("rejects a well-signed token whose provider cannot be found", async () => {
    const token = await signToken({ providerId: "missing", type: "magic-link" });
    findUnique.mockResolvedValue(null);
    await expect(verifyProviderInviteToken(token)).rejects.toMatchObject({
      message: "provider_not_found",
      status: 404,
    });
  });

  it("rejects a token that no longer matches Provider.inviteToken (rotation)", async () => {
    const token = await signToken({ providerId: "p1", type: "magic-link" });
    findUnique.mockResolvedValue({
      id: "p1",
      status: "ONBOARDING_IN_PROGRESS",
      inviteToken: "some-newer-token",
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyProviderInviteToken(token)).rejects.toMatchObject({
      message: "token_revoked",
      status: 401,
    });
  });

  it("rejects a token past Provider.inviteTokenExpiresAt", async () => {
    const token = await signToken({ providerId: "p1", type: "magic-link" });
    findUnique.mockResolvedValue({
      id: "p1",
      status: "ONBOARDING_IN_PROGRESS",
      inviteToken: token,
      inviteTokenExpiresAt: new Date(Date.now() - 60_000),
    });
    await expect(verifyProviderInviteToken(token)).rejects.toMatchObject({
      message: "token_expired",
      status: 401,
    });
  });

  it("rejects a provider whose status is not onboarding-eligible", async () => {
    const token = await signToken({ providerId: "p1", type: "magic-link" });
    findUnique.mockResolvedValue({
      id: "p1",
      status: "APPROVED",
      inviteToken: token,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyProviderInviteToken(token)).rejects.toMatchObject({
      message: "provider_not_eligible",
      status: 403,
    });
  });

  it("returns the providerId and email on a valid token", async () => {
    const token = await signToken({
      providerId: "p1",
      email: "doc@example.com",
      type: "magic-link",
    });
    findUnique.mockResolvedValue({
      id: "p1",
      status: "INVITED",
      inviteToken: token,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    const result = await verifyProviderInviteToken(token);
    expect(result).toEqual({ providerId: "p1", email: "doc@example.com" });
  });

  it("accepts a valid token without an email claim", async () => {
    const token = await signToken({ providerId: "p2", type: "magic-link" });
    findUnique.mockResolvedValue({
      id: "p2",
      status: "DOCUMENTS_PENDING",
      inviteToken: token,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    const result = await verifyProviderInviteToken(token);
    expect(result).toEqual({ providerId: "p2", email: null });
  });
});
