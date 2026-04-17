/**
 * Continuous Monitoring page (P1 Gap #9).
 *
 * Lists alerts produced by:
 *   • POST /api/webhooks/exclusions  (SAM / OIG / state Medicaid pushes)
 *   • runContinuousLicenseMonitoring  (nightly diff alerts)
 *   • runSanctions30DayMonitoring     (30-day sweep)
 *   • NPDB Continuous Query when enabled
 */

import { db } from "@/server/db";
import Link from "next/link";
import {
  MonitoringAlertSeverity,
  MonitoringAlertStatus,
} from "@prisma/client";
import { MonitoringAlertActions } from "@/components/monitoring/MonitoringAlertActions";

interface SearchParams {
  status?: string;
  severity?: string;
  type?: string;
  page?: string;
}

const PAGE_SIZE = 50;

function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  });
}

const SEVERITY_BADGE: Record<MonitoringAlertSeverity, string> = {
  CRITICAL: "bg-red-100 text-red-700 border-red-200",
  WARNING: "bg-amber-100 text-amber-800 border-amber-200",
  INFO: "bg-blue-50 text-blue-700 border-blue-200",
};

const STATUS_BADGE: Record<MonitoringAlertStatus, string> = {
  OPEN: "bg-red-50 text-red-700",
  ACKNOWLEDGED: "bg-amber-50 text-amber-700",
  RESOLVED: "bg-green-50 text-green-700",
  DISMISSED: "bg-gray-100 text-gray-600",
};

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

export default async function MonitoringPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = (params.status ?? "OPEN") as MonitoringAlertStatus | "ALL";
  const severity = params.severity as MonitoringAlertSeverity | undefined;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (status !== "ALL") where.status = status;
  if (severity) where.severity = severity;

  const [items, total, counts] = await Promise.all([
    db.monitoringAlert.findMany({
      where: where as never,
      orderBy: [{ severity: "desc" }, { detectedAt: "desc" }],
      take: PAGE_SIZE,
      skip: (currentPage - 1) * PAGE_SIZE,
      include: {
        provider: {
          select: {
            id: true,
            legalFirstName: true,
            legalLastName: true,
            npi: true,
          },
        },
        acknowledgedBy: { select: { displayName: true } },
        resolvedBy: { select: { displayName: true } },
      },
    }),
    db.monitoringAlert.count({ where: where as never }),
    db.monitoringAlert.groupBy({
      by: ["status", "severity"],
      _count: { _all: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // tabs: OPEN / ACKNOWLEDGED / RESOLVED / ALL
  const tabs: { label: string; value: MonitoringAlertStatus | "ALL" }[] = [
    { label: "Open", value: "OPEN" },
    { label: "Acknowledged", value: "ACKNOWLEDGED" },
    { label: "Resolved", value: "RESOLVED" },
    { label: "All", value: "ALL" },
  ];

  const countOpenCritical =
    counts.find((c) => c.status === "OPEN" && c.severity === "CRITICAL")?._count
      ._all ?? 0;
  const countOpenWarning =
    counts.find((c) => c.status === "OPEN" && c.severity === "WARNING")?._count
      ._all ?? 0;
  const countOpenInfo =
    counts.find((c) => c.status === "OPEN" && c.severity === "INFO")?._count
      ._all ?? 0;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Continuous Monitoring
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            License-board diffs, federal exclusion pushes, NPDB Continuous
            Query, and 30-day sweep results in one feed.
          </p>
        </div>
        <Link
          href="/admin/settings#continuous-monitoring"
          className="text-xs text-blue-600 hover:underline"
        >
          Configure sources →
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5">
          <div className="text-2xl font-bold text-red-700">
            {countOpenCritical}
          </div>
          <div className="text-xs text-red-700/70">Open Critical</div>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
          <div className="text-2xl font-bold text-amber-700">
            {countOpenWarning}
          </div>
          <div className="text-xs text-amber-700/70">Open Warning</div>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5">
          <div className="text-2xl font-bold text-blue-700">
            {countOpenInfo}
          </div>
          <div className="text-xs text-blue-700/70">Open Info</div>
        </div>
      </div>

      <div className="bg-white rounded-lg border">
        <div className="px-3 py-2 border-b flex items-center gap-1 overflow-x-auto">
          {tabs.map((t) => {
            const active = status === t.value;
            return (
              <Link
                key={t.value}
                href={buildUrl("/monitoring", {
                  status: t.value,
                  severity,
                })}
                className={`text-xs px-2.5 py-1 rounded ${
                  active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
          <span className="mx-2 text-gray-300">|</span>
          {(["CRITICAL", "WARNING", "INFO"] as MonitoringAlertSeverity[]).map(
            (s) => (
              <Link
                key={s}
                href={buildUrl("/monitoring", {
                  status,
                  severity: severity === s ? undefined : s,
                })}
                className={`text-xs px-2.5 py-1 rounded ${
                  severity === s
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {s.charAt(0) + s.slice(1).toLowerCase()}
              </Link>
            )
          )}
        </div>

        {items.length === 0 ? (
          <div className="px-3 py-12 text-center text-sm text-gray-400">
            No alerts match the current filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-xs font-medium text-gray-500 uppercase">
                  <th className="px-3 py-2">Severity</th>
                  <th className="px-3 py-2">Type</th>
                  <th className="px-3 py-2">Provider</th>
                  <th className="px-3 py-2">Title</th>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Detected</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((alert) => (
                  <tr key={alert.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded border ${SEVERITY_BADGE[alert.severity]}`}
                      >
                        {alert.severity}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {alert.type.replace(/_/g, " ").toLowerCase()}
                    </td>
                    <td className="px-3 py-2">
                      <Link
                        href={`/providers/${alert.provider.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {alert.provider.legalLastName},{" "}
                        {alert.provider.legalFirstName}
                      </Link>
                      {alert.provider.npi && (
                        <div className="text-[11px] text-gray-400">
                          NPI {alert.provider.npi}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">
                        {alert.title}
                      </div>
                      <div className="text-xs text-gray-500 line-clamp-2">
                        {alert.description}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500">
                      {alert.source}
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-500 whitespace-nowrap">
                      {fmtDateTime(alert.detectedAt)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${STATUS_BADGE[alert.status]}`}
                      >
                        {alert.status}
                      </span>
                      {alert.acknowledgedBy && alert.status !== "OPEN" && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          ack by {alert.acknowledgedBy.displayName}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <MonitoringAlertActions
                        alertId={alert.id}
                        status={alert.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-gray-500">
            <div>
              Page {currentPage} of {totalPages} · {total} alerts
            </div>
            <div className="flex gap-1">
              {currentPage > 1 && (
                <Link
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  href={buildUrl("/monitoring", {
                    status,
                    severity,
                    page: String(currentPage - 1),
                  })}
                >
                  Previous
                </Link>
              )}
              {currentPage < totalPages && (
                <Link
                  className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-200"
                  href={buildUrl("/monitoring", {
                    status,
                    severity,
                    page: String(currentPage + 1),
                  })}
                >
                  Next
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
