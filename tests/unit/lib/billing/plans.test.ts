import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PLANS,
  assertWithinPlanLimits,
  getPlan,
  listActivePlans,
  resolveStripePriceId,
} from "@/lib/billing/plans";

describe("plan catalog", () => {
  it("exposes the three commercial plans", () => {
    expect(Object.keys(PLANS).sort()).toEqual(["enterprise", "growth", "starter"]);
  });

  it("listActivePlans hides archived plans", () => {
    expect(listActivePlans().every((p) => !p.archived)).toBe(true);
  });

  it("getPlan returns the plan by slug and null for unknowns", () => {
    expect(getPlan("starter")?.slug).toBe("starter");
    expect(getPlan("nope")).toBeNull();
  });
});

describe("resolveStripePriceId", () => {
  const original = { ...process.env };
  beforeEach(() => {
    delete process.env.STRIPE_PRICE_STARTER;
    delete process.env.STRIPE_PRICE_GROWTH;
    delete process.env.STRIPE_PRICE_ENTERPRISE;
  });
  afterEach(() => {
    process.env = { ...original };
  });

  it("returns null when env is unset", () => {
    expect(resolveStripePriceId("starter")).toBeNull();
  });

  it("returns null when env is empty string", () => {
    process.env.STRIPE_PRICE_STARTER = "   ";
    expect(resolveStripePriceId("starter")).toBeNull();
  });

  it("returns the price id when set", () => {
    process.env.STRIPE_PRICE_STARTER = "price_test_starter_123";
    expect(resolveStripePriceId("starter")).toBe("price_test_starter_123");
  });
});

describe("assertWithinPlanLimits", () => {
  it("starter caps at 25 providers", () => {
    expect(assertWithinPlanLimits({ planSlug: "starter", currentProviderCount: 25 })).toEqual({ ok: true });
    expect(assertWithinPlanLimits({ planSlug: "starter", currentProviderCount: 26 }))
      .toMatchObject({ ok: false });
  });

  it("growth caps at 250 providers", () => {
    expect(assertWithinPlanLimits({ planSlug: "growth", currentProviderCount: 250 })).toEqual({ ok: true });
    const over = assertWithinPlanLimits({ planSlug: "growth", currentProviderCount: 251 });
    expect(over.ok).toBe(false);
    if (!over.ok) expect(over.reason).toMatch(/250/);
  });

  it("enterprise has no cap", () => {
    expect(
      assertWithinPlanLimits({ planSlug: "enterprise", currentProviderCount: 100_000 }),
    ).toEqual({ ok: true });
  });

  it("unknown slugs default to starter limits", () => {
    expect(
      assertWithinPlanLimits({ planSlug: "what", currentProviderCount: 26 }).ok,
    ).toBe(false);
  });
});
