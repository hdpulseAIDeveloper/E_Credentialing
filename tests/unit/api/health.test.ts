/**
 * Health probe contract tests.
 *
 * The /api/live and /api/ready probes are the primary signals that
 * orchestrators (Kubernetes, Azure Container Apps, nginx upstream
 * checks) use to decide whether to restart a container or keep it in
 * the load balancer rotation. If these change shape silently the
 * platform can go "healthy but unreachable" — so we freeze the contract.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const dbQueryRaw = vi.fn();
vi.mock("@/server/db", () => ({ db: { $queryRaw: (...args: unknown[]) => dbQueryRaw(...args) } }));

const redisPing = vi.fn();
const redisQuit = vi.fn();
vi.mock("@/lib/redis", () => ({
  createRedisConnection: vi.fn(() => ({ ping: redisPing, quit: redisQuit })),
}));

describe("GET /api/live", () => {
  it("returns 200 + status=live without touching DB or Redis", async () => {
    const { GET } = await import("../../../src/app/api/live/route");
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; timestamp: string };
    expect(body.status).toBe("live");
    expect(body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(dbQueryRaw).not.toHaveBeenCalled();
    expect(redisPing).not.toHaveBeenCalled();
  });
});

describe("GET /api/ready", () => {
  beforeEach(() => {
    dbQueryRaw.mockReset();
    redisPing.mockReset();
    redisQuit.mockReset();
    redisQuit.mockResolvedValue("OK");
    delete process.env.REDIS_URL;
  });

  it("returns 200 when the DB responds and Redis is not configured", async () => {
    dbQueryRaw.mockResolvedValue([{ "?column?": 1 }]);

    const { GET } = await import("../../../src/app/api/ready/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status: string;
      checks: { database: boolean; redis: boolean };
    };
    expect(body.status).toBe("ready");
    expect(body.checks.database).toBe(true);
    expect(body.checks.redis).toBe(true); // skipped = considered healthy
  });

  it("returns 503 when the DB is unreachable", async () => {
    dbQueryRaw.mockRejectedValue(new Error("connection refused"));

    const { GET } = await import("../../../src/app/api/ready/route");
    const res = await GET();

    expect(res.status).toBe(503);
    const body = (await res.json()) as { checks: { database: boolean } };
    expect(body.checks.database).toBe(false);
  });

  it("returns 503 when Redis is configured but fails to respond", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    dbQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    redisPing.mockRejectedValue(new Error("redis down"));

    const { GET } = await import("../../../src/app/api/ready/route");
    const res = await GET();

    expect(res.status).toBe(503);
    const body = (await res.json()) as { checks: { redis: boolean } };
    expect(body.checks.redis).toBe(false);
  });

  it("returns 200 when both DB and Redis respond", async () => {
    process.env.REDIS_URL = "redis://localhost:6379";
    dbQueryRaw.mockResolvedValue([{ "?column?": 1 }]);
    redisPing.mockResolvedValue("PONG");

    const { GET } = await import("../../../src/app/api/ready/route");
    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as { checks: { database: boolean; redis: boolean } };
    expect(body.checks).toEqual({ database: true, redis: true });
    expect(redisQuit).toHaveBeenCalled();
  });
});
