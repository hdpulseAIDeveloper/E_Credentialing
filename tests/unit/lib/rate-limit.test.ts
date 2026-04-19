import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyRateLimitHeaders,
  buildRateLimitResponse,
  evaluateRateLimit,
  rateLimit,
} from "@/lib/api/rate-limit";
import { NextResponse } from "next/server";

describe("rateLimit (in-memory fixed window)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("allows up to the limit within a window", () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 5; i++) {
      expect(rateLimit(key, { limit: 5, windowMs: 1000 })).toBeNull();
    }
  });

  it("rejects the (limit+1)th request with 429, Retry-After, and v1 RateLimitProblem body", async () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowMs: 5000 });
    const res = rateLimit(key, { limit: 3, windowMs: 5000 });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const body = (await res!.json()) as {
      error: { code: string; message: string; retryAfterSeconds: number };
    };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.message).toMatch(/Rate limit/);
    expect(body.error.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(res!.headers.get("Retry-After")).not.toBeNull();
    // Standard rate-limit headers must be on the 429 too.
    expect(res!.headers.get("X-RateLimit-Limit")).toBe("3");
    expect(res!.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res!.headers.get("X-RateLimit-Reset")).not.toBeNull();
  });

  it("resets after the window elapses", () => {
    const key = `k-${Math.random()}`;
    rateLimit(key, { limit: 1, windowMs: 100 });
    expect(rateLimit(key, { limit: 1, windowMs: 100 })).not.toBeNull();
    vi.advanceTimersByTime(101);
    expect(rateLimit(key, { limit: 1, windowMs: 100 })).toBeNull();
  });

  it("keeps different keys independent", () => {
    expect(rateLimit("a", { limit: 1, windowMs: 1000 })).toBeNull();
    expect(rateLimit("b", { limit: 1, windowMs: 1000 })).toBeNull();
    expect(rateLimit("a", { limit: 1, windowMs: 1000 })).not.toBeNull();
    expect(rateLimit("b", { limit: 1, windowMs: 1000 })).not.toBeNull();
  });
});

describe("evaluateRateLimit (Wave 13: structured state)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T20:00:00Z"));
  });

  it("returns allowed=true and decrementing remaining within budget", () => {
    const key = `k-${Math.random()}`;
    const a = evaluateRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(a.allowed).toBe(true);
    expect(a.limit).toBe(3);
    expect(a.remaining).toBe(2);
    expect(a.resetUnixSeconds).toBeGreaterThan(Date.now() / 1000);

    const b = evaluateRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(1);

    const c = evaluateRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(c.allowed).toBe(true);
    expect(c.remaining).toBe(0);

    const d = evaluateRateLimit(key, { limit: 3, windowMs: 60_000 });
    expect(d.allowed).toBe(false);
    expect(d.remaining).toBe(0);
    expect(d.retryAfterSeconds).toBeGreaterThanOrEqual(1);
  });

  it("Reset advances after a window elapses", () => {
    const key = `k-${Math.random()}`;
    const first = evaluateRateLimit(key, { limit: 1, windowMs: 1000 });
    vi.advanceTimersByTime(1500);
    const second = evaluateRateLimit(key, { limit: 1, windowMs: 1000 });
    expect(second.allowed).toBe(true);
    expect(second.resetUnixSeconds).toBeGreaterThan(first.resetUnixSeconds);
  });
});

describe("applyRateLimitHeaders", () => {
  it("attaches the three standard headers as strings", () => {
    const state = {
      limit: 100,
      remaining: 73,
      resetUnixSeconds: 1739887200,
      allowed: true,
      retryAfterSeconds: 1,
    };
    const res = applyRateLimitHeaders(NextResponse.json({ ok: true }), state);
    expect(res.headers.get("X-RateLimit-Limit")).toBe("100");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("73");
    expect(res.headers.get("X-RateLimit-Reset")).toBe("1739887200");
  });

  it("is a no-op when state is undefined", () => {
    const res = applyRateLimitHeaders(NextResponse.json({ ok: true }), undefined);
    expect(res.headers.get("X-RateLimit-Limit")).toBeNull();
  });
});

describe("buildRateLimitResponse", () => {
  it("returns 429 with the v1 RateLimitProblem envelope", async () => {
    const state = {
      limit: 60,
      remaining: 0,
      resetUnixSeconds: 1739887200,
      allowed: false,
      retryAfterSeconds: 12,
    };
    const res = buildRateLimitResponse(state);
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("12");
    expect(res.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(res.headers.get("X-RateLimit-Reset")).toBe("1739887200");
    const body = (await res.json()) as {
      error: { code: string; retryAfterSeconds: number };
    };
    expect(body.error.code).toBe("rate_limited");
    expect(body.error.retryAfterSeconds).toBe(12);
  });
});
