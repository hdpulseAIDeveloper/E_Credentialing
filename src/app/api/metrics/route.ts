/**
 * GET /api/metrics — Prometheus exposition endpoint.
 *
 * Emits a small, fixed set of business metrics so Prometheus / Grafana can
 * alert on credentialing pipeline health:
 *
 *   ecred_providers_total{status="..."}        gauge
 *   ecred_bot_runs_total{status="..."}         gauge (window = last 24h)
 *   ecred_expirables_total{status="..."}       gauge
 *   ecred_enrollments_total{status="..."}      gauge
 *   ecred_tasks_open_total                     gauge
 *   ecred_build_info{version="..."}            gauge (value=1)
 *
 * Auth: protected by the METRICS_TOKEN env var. Prometheus must send
 *       `Authorization: Bearer <token>`. If METRICS_TOKEN is unset, the
 *       endpoint returns 404 to avoid information disclosure.
 *
 * This endpoint intentionally avoids pulling in `prom-client` to keep the
 * bundle lean — we already have `db` and can produce the tiny exposition
 * format inline.
 */

import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatMetric(
  name: string,
  help: string,
  type: "counter" | "gauge",
  samples: Array<{ labels?: Record<string, string>; value: number }>,
): string {
  const lines: string[] = [];
  lines.push(`# HELP ${name} ${help}`);
  lines.push(`# TYPE ${name} ${type}`);
  for (const s of samples) {
    const labelStr = s.labels
      ? "{" +
        Object.entries(s.labels)
          .map(([k, v]) => `${k}="${v.replace(/"/g, '\\"')}"`)
          .join(",") +
        "}"
      : "";
    lines.push(`${name}${labelStr} ${s.value}`);
  }
  return lines.join("\n");
}

export async function GET(req: NextRequest) {
  const token = process.env.METRICS_TOKEN;
  if (!token) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const auth = req.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${token}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [providersByStatus, botRunsByStatus, expirablesByStatus, enrollmentsByStatus, openTasks] =
    await Promise.all([
      db.provider.groupBy({ by: ["status"], _count: { _all: true } }),
      db.botRun.groupBy({
        by: ["status"],
        where: { queuedAt: { gte: since24h } },
        _count: { _all: true },
      }),
      db.expirable.groupBy({ by: ["status"], _count: { _all: true } }),
      db.enrollment.groupBy({ by: ["status"], _count: { _all: true } }),
      db.task.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] } } }),
    ]);

  const blocks: string[] = [];

  blocks.push(
    formatMetric(
      "ecred_providers_total",
      "Providers in the system by pipeline status.",
      "gauge",
      providersByStatus.map((p) => ({ labels: { status: p.status }, value: p._count._all })),
    ),
  );

  blocks.push(
    formatMetric(
      "ecred_bot_runs_total",
      "Bot runs queued in the last 24h by terminal status.",
      "gauge",
      botRunsByStatus.map((r) => ({ labels: { status: r.status }, value: r._count._all })),
    ),
  );

  blocks.push(
    formatMetric(
      "ecred_expirables_total",
      "Expirables by current status (EXPIRED is the alert signal).",
      "gauge",
      expirablesByStatus.map((e) => ({ labels: { status: e.status }, value: e._count._all })),
    ),
  );

  blocks.push(
    formatMetric(
      "ecred_enrollments_total",
      "Enrollments by current status.",
      "gauge",
      enrollmentsByStatus.map((e) => ({ labels: { status: e.status }, value: e._count._all })),
    ),
  );

  blocks.push(
    formatMetric(
      "ecred_tasks_open_total",
      "Staff-facing tasks currently OPEN or IN_PROGRESS.",
      "gauge",
      [{ value: openTasks }],
    ),
  );

  blocks.push(
    formatMetric(
      "ecred_build_info",
      "Build information for the currently-running web container.",
      "gauge",
      [
        {
          labels: {
            version: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
            node: process.versions.node,
          },
          value: 1,
        },
      ],
    ),
  );

  const body = blocks.join("\n\n") + "\n";
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
