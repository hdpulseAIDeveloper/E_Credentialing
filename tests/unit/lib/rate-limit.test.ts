import { describe, it, expect, beforeEach, vi } from "vitest";
import { rateLimit } from "@/lib/api/rate-limit";

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

  it("rejects the (limit+1)th request with 429 and Retry-After", async () => {
    const key = `k-${Math.random()}`;
    for (let i = 0; i < 3; i++) rateLimit(key, { limit: 3, windowMs: 5000 });
    const res = rateLimit(key, { limit: 3, windowMs: 5000 });
    expect(res).not.toBeNull();
    expect(res!.status).toBe(429);
    const body = (await res!.json()) as { error: string; retryAfterSeconds: number };
    expect(body.error).toEqual("Too Many Requests");
    expect(body.retryAfterSeconds).toBeGreaterThanOrEqual(1);
    expect(res!.headers.get("Retry-After")).not.toBeNull();
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
