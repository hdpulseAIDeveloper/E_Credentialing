import { describe, it, expect, beforeEach, vi } from "vitest";
import { SignJWT } from "jose";

const findUnique = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    provider: {
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

const { verifyProviderInviteToken, ProviderTokenError } = await import(
  "@/lib/auth/provider-token"
);

async function sign(payload: Record<string, unknown>, exp = "1h"): Promise<string> {
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(secret);
}

describe("verifyProviderInviteToken", () => {
  beforeEach(() => {
    findUnique.mockReset();
  });

  it("rejects missing or non-string tokens", async () => {
    await expect(verifyProviderInviteToken("")).rejects.toThrow(ProviderTokenError);
  });

  it("rejects a forged JWT with wrong secret", async () => {
    const bogus = await new SignJWT({ providerId: "p1", type: "magic-link" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("different-secret"));
    await expect(verifyProviderInviteToken(bogus)).rejects.toThrow(
      ProviderTokenError
    );
  });

  it("rejects tokens missing the magic-link type claim", async () => {
    const t = await sign({ providerId: "p1" });
    await expect(verifyProviderInviteToken(t)).rejects.toThrow(ProviderTokenError);
  });

  it("returns 404 when provider does not exist", async () => {
    findUnique.mockResolvedValueOnce(null);
    const t = await sign({ providerId: "p1", type: "magic-link" });
    await expect(verifyProviderInviteToken(t)).rejects.toMatchObject({
      status: 404,
    });
  });

  it("rejects when stored inviteToken differs (single-active-token)", async () => {
    const t = await sign({ providerId: "p1", type: "magic-link" });
    findUnique.mockResolvedValueOnce({
      id: "p1",
      status: "INVITED",
      inviteToken: "a-different-token",
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyProviderInviteToken(t)).rejects.toMatchObject({
      status: 401,
      message: "token_revoked",
    });
  });

  it("rejects providers whose status is not onboarding-eligible", async () => {
    const t = await sign({ providerId: "p1", type: "magic-link" });
    findUnique.mockResolvedValueOnce({
      id: "p1",
      status: "APPROVED",
      inviteToken: t,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(verifyProviderInviteToken(t)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("accepts a matching token + eligible status and returns providerId", async () => {
    const t = await sign({ providerId: "p1", email: "p@ex.com", type: "magic-link" });
    findUnique.mockResolvedValueOnce({
      id: "p1",
      status: "ONBOARDING_IN_PROGRESS",
      inviteToken: t,
      inviteTokenExpiresAt: new Date(Date.now() + 60_000),
    });
    const res = await verifyProviderInviteToken(t);
    expect(res.providerId).toEqual("p1");
    expect(res.email).toEqual("p@ex.com");
  });
});
