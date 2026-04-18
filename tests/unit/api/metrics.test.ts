/**
 * /api/metrics contract tests.
 *
 * The metrics endpoint is the Prometheus scrape target. We freeze:
 *   - the authentication contract (production: requires bearer token;
 *     non-production: open for local dev / curl)
 *   - the base set of metric names the Grafana dashboards rely on
 *   - the Prometheus exposition format
 *
 * Changing any of these would break the HDPulseAI Grafana dashboards.
 *
 * Wave 2.1: rewritten to match the current route shape, which moved from
 * a single per-status `groupBy` per model to a richer set of `count` +
 * `groupBy` collectors covering monitoring alerts, bot runs, providers,
 * audit log volume, and AI decisions.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const monitoringAlertGroupBy = vi.fn();
const botRunCount = vi.fn();
const botRunGroupBy = vi.fn();
const providerCount = vi.fn();
const auditLogCount = vi.fn();
const aiDecisionGroupBy = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    monitoringAlert: { groupBy: (...a: unknown[]) => monitoringAlertGroupBy(...a) },
    botRun: {
      count: (...a: unknown[]) => botRunCount(...a),
      groupBy: (...a: unknown[]) => botRunGroupBy(...a),
    },
    provider: { count: (...a: unknown[]) => providerCount(...a) },
    auditLog: { count: (...a: unknown[]) => auditLogCount(...a) },
    aiDecisionLog: { groupBy: (...a: unknown[]) => aiDecisionGroupBy(...a) },
  },
}));

// Stub BullMQ queues so we never open a Redis connection at module load.
vi.mock("@/workers/queues", () => {
  const stubQueue = {
    name: "stub",
    getJobCounts: () =>
      Promise.resolve({ waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0, paused: 0 }),
  };
  return {
    psvBotQueue: stubQueue,
    enrollmentBotQueue: stubQueue,
    scheduledJobQueue: stubQueue,
  };
});

function makeReq(token: string | null): Request {
  return new Request("http://localhost/api/metrics", {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("GET /api/metrics", () => {
  beforeEach(() => {
    monitoringAlertGroupBy.mockReset().mockResolvedValue([]);
    botRunCount.mockReset().mockResolvedValue(0);
    botRunGroupBy.mockReset().mockResolvedValue([]);
    providerCount.mockReset().mockResolvedValue(0);
    auditLogCount.mockReset().mockResolvedValue(0);
    aiDecisionGroupBy.mockReset().mockResolvedValue([]);
    delete process.env.METRICS_BEARER_TOKEN;
    vi.unstubAllEnvs();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 in production when no bearer token is configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    delete process.env.METRICS_BEARER_TOKEN;
    const { GET } = await import("../../../src/app/api/metrics/route");
    const res = await GET(makeReq("anything") as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
    expect(providerCount).not.toHaveBeenCalled();
  });

  it("returns 401 in production when the bearer token does not match", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.METRICS_BEARER_TOKEN = "expected-secret";
    const { GET } = await import("../../../src/app/api/metrics/route");
    const res = await GET(makeReq("wrong") as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
    expect(providerCount).not.toHaveBeenCalled();
  });

  it("returns a Prometheus exposition with all core metric names (dev/test mode = open)", async () => {
    botRunCount.mockResolvedValue(7);
    botRunGroupBy.mockResolvedValue([{ status: "COMPLETED", _count: { _all: 7 } }]);
    providerCount.mockResolvedValue(42);
    auditLogCount.mockResolvedValue(123);
    aiDecisionGroupBy.mockResolvedValue([{ humanDecision: "ACCEPTED", _count: { _all: 5 } }]);

    const { GET } = await import("../../../src/app/api/metrics/route");
    const res = await GET(makeReq(null) as unknown as Parameters<typeof GET>[0]);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain.*version=0\.0\.4/);
    const body = await res.text();

    for (const metric of [
      "ecred_process_resident_memory_bytes",
      "ecred_process_uptime_seconds",
      "ecred_queue_jobs",
      "ecred_monitoring_alerts_open",
      "ecred_bot_runs_total",
      "ecred_bot_runs_by_status",
      "ecred_providers_total",
      "ecred_audit_log_writes_24h",
      "ecred_ai_decisions_total",
      "ecred_metrics_scrape_errors_total",
    ]) {
      expect(body, `metric ${metric} missing from exposition`).toContain(metric);
    }

    expect(body).toMatch(/ecred_providers_total\s+42/);
    expect(body).toMatch(/ecred_bot_runs_total\s+7/);
    expect(body).toMatch(/ecred_ai_decisions_total\{decision="ACCEPTED"\}\s+5/);
  });
});
