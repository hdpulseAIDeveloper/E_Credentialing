import { describe, expect, it } from "vitest";
import {
  isEntitled,
  isLocked,
  normalizeSubscription,
  shouldShowDunningBanner,
} from "@/lib/billing/subscription-state";

describe("isEntitled", () => {
  it("active and trialing grant access", () => {
    expect(isEntitled("active")).toBe(true);
    expect(isEntitled("trialing")).toBe(true);
  });

  it("past_due intentionally still grants access (smart retries)", () => {
    expect(isEntitled("past_due")).toBe(false);
  });

  it("nullish and unknown statuses do not grant access", () => {
    expect(isEntitled(null)).toBe(false);
    expect(isEntitled(undefined)).toBe(false);
    expect(isEntitled("")).toBe(false);
    expect(isEntitled("nonsense")).toBe(false);
  });
});

describe("shouldShowDunningBanner", () => {
  it("flags past_due and incomplete only", () => {
    expect(shouldShowDunningBanner("past_due")).toBe(true);
    expect(shouldShowDunningBanner("incomplete")).toBe(true);
    expect(shouldShowDunningBanner("active")).toBe(false);
    expect(shouldShowDunningBanner("canceled")).toBe(false);
  });
});

describe("isLocked", () => {
  it("locks canceled / incomplete_expired / unpaid / paused", () => {
    for (const s of ["canceled", "incomplete_expired", "unpaid", "paused"]) {
      expect(isLocked(s)).toBe(true);
    }
  });

  it("does not lock healthy or transitional states", () => {
    expect(isLocked("active")).toBe(false);
    expect(isLocked("trialing")).toBe(false);
    expect(isLocked("past_due")).toBe(false);
    expect(isLocked(null)).toBe(false);
  });
});

describe("normalizeSubscription", () => {
  it("returns null when id or status are missing", () => {
    expect(normalizeSubscription(null)).toBeNull();
    expect(normalizeSubscription({})).toBeNull();
    expect(normalizeSubscription({ id: "sub_1" })).toBeNull();
  });

  it("converts current_period_end seconds to Date", () => {
    const out = normalizeSubscription({
      id: "sub_1",
      status: "active",
      current_period_end: 1_900_000_000,
    });
    expect(out?.billingCurrentPeriodEnd?.toISOString()).toBe(new Date(1_900_000_000_000).toISOString());
  });

  it("resolves plan slug from subscription metadata first", () => {
    const out = normalizeSubscription({
      id: "sub_1",
      status: "active",
      metadata: { plan: "growth" },
      items: { data: [{ price: { id: "p", lookup_key: "starter" } }] },
    });
    expect(out?.planSlug).toBe("growth");
  });

  it("falls back to price.metadata.plan, then lookup_key", () => {
    const fromPriceMeta = normalizeSubscription({
      id: "sub_2",
      status: "active",
      items: { data: [{ price: { metadata: { plan: "enterprise" }, lookup_key: "starter" } }] },
    });
    expect(fromPriceMeta?.planSlug).toBe("enterprise");

    const fromLookupKey = normalizeSubscription({
      id: "sub_3",
      status: "active",
      items: { data: [{ price: { lookup_key: "starter" } }] },
    });
    expect(fromLookupKey?.planSlug).toBe("starter");
  });

  it("planSlug is null when nothing resolves", () => {
    const out = normalizeSubscription({ id: "sub_4", status: "active" });
    expect(out?.planSlug).toBeNull();
  });
});
