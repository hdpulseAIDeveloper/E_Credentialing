/**
 * /api/metrics contract tests.
 *
 * The metrics endpoint is the Prometheus scrape target. We freeze:
 *   - the authentication contract (no token env → 404; wrong token → 401)
 *   - the base set of metric names (providers/bot_runs/expirables/enrollments/tasks/build_info)
 *   - the Prometheus exposition format (text/plain; version=0.0.4)
 *
 * Changing any of these would break the HDPulseAI Grafana dashboards.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

type GroupByRow = { status: string; _count: { _all: number } };

const groupBy = vi.fn();
const enrollmentGroupBy = vi.fn();
const expirableGroupBy = vi.fn();
const botRunGroupBy = vi.fn();
const taskCount = vi.fn();

vi.mock("@/server/db", () => ({
  db: {
    provider: { groupBy: (...a: unknown[]) => groupBy(...a) },
    enrollment: { groupBy: (...a: unknown[]) => enrollmentGroupBy(...a) },
    expirable: { groupBy: (...a: unknown[]) => expirableGroupBy(...a) },
    botRun: { groupBy: (...a: unknown[]) => botRunGroupBy(...a) },
    task: { count: (...a: unknown[]) => taskCount(...a) },
  },
}));

function makeReq(token: string | null): Request {
  return new Request("http://localhost/api/metrics", {
    method: "GET",
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

describe("GET /api/metrics", () => {
  beforeEach(() => {
    groupBy.mockReset();
    enrollmentGroupBy.mockReset();
    expirableGroupBy.mockReset();
    botRunGroupBy.mockReset();
    taskCount.mockReset();
    delete process.env.METRICS_TOKEN;
  });

  it("returns 404 when METRICS_TOKEN is not configured (no info leak)", async () => {
    const { GET } = await import("../../../src/app/api/metrics/route");
    const res = await GET(makeReq("anything") as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(404);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("returns 401 when the bearer token does not match", async () => {
    process.env.METRICS_TOKEN = "expected-secret";
    const { GET } = await import("../../../src/app/api/metrics/route");
    const res = await GET(makeReq("wrong") as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
    expect(groupBy).not.toHaveBeenCalled();
  });

  it("returns a Prometheus exposition with all core metric names when authorized", async () => {
    process.env.METRICS_TOKEN = "ok";
    groupBy.mockResolvedValue([
      { status: "APPROVED", _count: { _all: 3 } },
      { status: "INVITED", _count: { _all: 1 } },
    ] as GroupByRow[]);
    botRunGroupBy.mockResolvedValue([{ status: "COMPLETED", _count: { _all: 7 } }] as GroupByRow[]);
    expirableGroupBy.mockResolvedValue([{ status: "CURRENT", _count: { _all: 10 } }] as GroupByRow[]);
    enrollmentGroupBy.mockResolvedValue([{ status: "DRAFT", _count: { _all: 2 } }] as GroupByRow[]);
    taskCount.mockResolvedValue(4);

    const { GET } = await import("../../../src/app/api/metrics/route");
    const res = await GET(makeReq("ok") as unknown as Parameters<typeof GET>[0]);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/plain.*version=0\.0\.4/);
    const body = await res.text();

    for (const metric of [
      "ecred_providers_total",
      "ecred_bot_runs_total",
      "ecred_expirables_total",
      "ecred_enrollments_total",
      "ecred_tasks_open_total",
      "ecred_build_info",
    ]) {
      expect(body).toContain(metric);
    }

    expect(body).toMatch(/ecred_providers_total\{status="APPROVED"\} 3/);
    expect(body).toMatch(/ecred_tasks_open_total 4/);
    expect(body).toMatch(/ecred_build_info\{version="[^"]*",node="[^"]*"\} 1/);
  });
});
