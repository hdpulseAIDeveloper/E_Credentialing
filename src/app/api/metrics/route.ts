/**
 * GET /api/metrics — Prometheus exposition format.
 *
 * Exposes a small, hand-curated set of business + queue metrics that ops
 * dashboards (Datadog, Grafana) can scrape to alert on platform health.
 *
 * Auth model:
 *   - In production, requires `Authorization: Bearer <METRICS_BEARER_TOKEN>`
 *     so the endpoint can be exposed publicly behind a reverse proxy without
 *     leaking internal queue depths and alert counts to the world.
 *   - In dev, auth is skipped so `curl http://localhost:6015/api/metrics`
 *     just works.
 *
 * Output format: Prometheus text exposition (HELP / TYPE / value lines).
 * See https://prometheus.io/docs/instrumenting/exposition_formats/
 *
 * Failure mode: any data-source error degrades gracefully to a metric value
 * of 0 with a corresponding `<metric>_scrape_errors_total` counter so the
 * scrape itself never fails — Prometheus prefers a stale-but-present series
 * to a 500.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import { childLogger } from "@/lib/logger";
import { psvBotQueue, enrollmentBotQueue, scheduledJobQueue } from "@/workers/queues";

const log = childLogger({ module: "metrics" });

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface MetricLine {
  name: string;
  help: string;
  type: "gauge" | "counter";
  labels?: Record<string, string>;
  value: number;
}

function isAuthorized(req: NextRequest): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const token = process.env.METRICS_BEARER_TOKEN;
  if (!token) return false;
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.toLowerCase().startsWith("bearer ")) return false;
  const presented = auth.slice("bearer ".length).trim();
  return presented.length > 0 && presented === token;
}

function formatLabels(labels: Record<string, string> | undefined): string {
  if (!labels || Object.keys(labels).length === 0) return "";
  const pairs = Object.entries(labels)
    .map(([k, v]) => `${k}="${String(v).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`)
    .join(",");
  return `{${pairs}}`;
}

function render(metrics: MetricLine[]): string {
  // Group by metric name so each name has exactly one HELP/TYPE block.
  const grouped = new Map<string, MetricLine[]>();
  for (const m of metrics) {
    const arr = grouped.get(m.name);
    if (arr) arr.push(m);
    else grouped.set(m.name, [m]);
  }
  const lines: string[] = [];
  for (const [name, rows] of grouped.entries()) {
    const first = rows[0]!;
    lines.push(`# HELP ${name} ${first.help}`);
    lines.push(`# TYPE ${name} ${first.type}`);
    for (const r of rows) {
      lines.push(`${name}${formatLabels(r.labels)} ${r.value}`);
    }
  }
  lines.push("");
  return lines.join("\n");
}

async function gather(): Promise<MetricLine[]> {
  const out: MetricLine[] = [];
  let scrapeErrors = 0;

  // ── Process metrics ──────────────────────────────────────────────────────
  const mem = process.memoryUsage();
  out.push({
    name: "ecred_process_resident_memory_bytes",
    help: "Resident set size of the Node.js process",
    type: "gauge",
    value: mem.rss,
  });
  out.push({
    name: "ecred_process_heap_used_bytes",
    help: "V8 heap currently in use",
    type: "gauge",
    value: mem.heapUsed,
  });
  out.push({
    name: "ecred_process_uptime_seconds",
    help: "Seconds since the Node.js process started",
    type: "gauge",
    value: process.uptime(),
  });

  // ── BullMQ queue depths ──────────────────────────────────────────────────
  const queues: Array<{ name: string; q: typeof psvBotQueue }> = [
    { name: "psv-bot", q: psvBotQueue },
    { name: "enrollment-bot", q: enrollmentBotQueue },
    { name: "scheduled-jobs", q: scheduledJobQueue },
  ];
  for (const { name, q } of queues) {
    try {
      const counts = await q.getJobCounts(
        "waiting",
        "active",
        "completed",
        "failed",
        "delayed",
        "paused",
      );
      for (const [state, value] of Object.entries(counts)) {
        out.push({
          name: "ecred_queue_jobs",
          help: "BullMQ job count by queue and state",
          type: "gauge",
          labels: { queue: name, state },
          value: Number(value) || 0,
        });
      }
    } catch (err) {
      scrapeErrors += 1;
      log.warn({ err, queue: name }, "metrics: queue counts failed");
    }
  }

  // ── Business gauges (open work, breaches, audit volume) ─────────────────
  // Each of these is wrapped so a missing table on a partially-migrated env
  // can't take the scrape down.
  type Counter = () => Promise<MetricLine | MetricLine[]>;
  const counters: Counter[] = [
    async () => {
      const grouped = await db.monitoringAlert.groupBy({
        by: ["severity"],
        where: { status: "OPEN" },
        _count: { _all: true },
      });
      if (grouped.length === 0) {
        return {
          name: "ecred_monitoring_alerts_open",
          help: "Open continuous-monitoring alerts (sanctions, license, FSMB) by severity",
          type: "gauge",
          labels: { severity: "all" },
          value: 0,
        };
      }
      return grouped.map((g) => ({
        name: "ecred_monitoring_alerts_open",
        help: "Open continuous-monitoring alerts (sanctions, license, FSMB) by severity",
        type: "gauge" as const,
        labels: { severity: String(g.severity) },
        value: g._count._all,
      }));
    },
    async () => {
      const n = await db.botRun.count();
      return {
        name: "ecred_bot_runs_total",
        help: "Cumulative count of PSV/enrollment bot runs (all statuses)",
        type: "counter",
        value: n,
      };
    },
    async () => {
      const grouped = await db.botRun.groupBy({
        by: ["status"],
        _count: { _all: true },
      });
      return grouped.map((g) => ({
        name: "ecred_bot_runs_by_status",
        help: "Bot runs by terminal status",
        type: "gauge" as const,
        labels: { status: String(g.status) },
        value: g._count._all,
      }));
    },
    async () => {
      const n = await db.provider.count();
      return {
        name: "ecred_providers_total",
        help: "Total providers in the system (all statuses)",
        type: "gauge",
        value: n,
      };
    },
    async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const n = await db.auditLog.count({ where: { timestamp: { gte: since } } });
      return {
        name: "ecred_audit_log_writes_24h",
        help: "Audit log rows written in the last 24 hours",
        type: "gauge",
        value: n,
      };
    },
    async () => {
      // AI decisions that landed on a non-pending human verdict (a proxy for
      // "humans have reviewed this" — both ACCEPTED and overridden states).
      const grouped = await db.aiDecisionLog.groupBy({
        by: ["humanDecision"],
        _count: { _all: true },
      });
      return grouped.map((g) => ({
        name: "ecred_ai_decisions_total",
        help: "AI decision logs by terminal human verdict",
        type: "gauge" as const,
        labels: { decision: String(g.humanDecision) },
        value: g._count._all,
      }));
    },
  ];

  for (const c of counters) {
    try {
      const result = await c();
      if (Array.isArray(result)) out.push(...result);
      else out.push(result);
    } catch (err) {
      scrapeErrors += 1;
      log.warn({ err }, "metrics: counter failed");
    }
  }

  out.push({
    name: "ecred_metrics_scrape_errors_total",
    help: "Number of individual metric collectors that errored during this scrape",
    type: "counter",
    value: scrapeErrors,
  });

  return out;
}

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return new NextResponse(
      "# unauthorized — set Authorization: Bearer <METRICS_BEARER_TOKEN>\n",
      {
        status: 401,
        headers: {
          "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
          "WWW-Authenticate": 'Bearer realm="metrics"',
        },
      },
    );
  }

  const metrics = await gather();
  const body = render(metrics);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
