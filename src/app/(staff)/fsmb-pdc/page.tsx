/**
 * Staff: FSMB PDC continuous monitoring overview — P3 Gap #21.
 *
 * Shows subscriber counts, recent events, and links to the per-provider
 * subscription card on the provider detail page.
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PENDING: "bg-amber-100 text-amber-800",
  SUSPENDED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
};

const SEVERITY_COLORS: Record<string, string> = {
  INFO: "bg-blue-100 text-blue-700",
  WARNING: "bg-amber-100 text-amber-800",
  CRITICAL: "bg-red-100 text-red-700",
};

const PROCESSING_COLORS: Record<string, string> = {
  RECEIVED: "bg-amber-100 text-amber-800",
  PROCESSED: "bg-green-100 text-green-700",
  IGNORED: "bg-gray-100 text-gray-600",
  FAILED: "bg-red-100 text-red-700",
};

export default async function FsmbPdcPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [subs, events, counts] = await Promise.all([
    db.fsmbPdcSubscription.findMany({
      include: {
        provider: {
          select: {
            id: true,
            legalFirstName: true,
            legalLastName: true,
            npi: true,
          },
        },
      },
      orderBy: [{ status: "asc" }, { lastEventReceivedAt: "desc" }],
    }),
    db.fsmbPdcEvent.findMany({
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true },
        },
      },
      orderBy: { occurredAt: "desc" },
      take: 50,
    }),
    Promise.all([
      db.fsmbPdcSubscription.count({ where: { status: "ACTIVE" } }),
      db.fsmbPdcSubscription.count({ where: { status: "PENDING" } }),
      db.fsmbPdcEvent.count({ where: { occurredAt: { gte: since7d } } }),
      db.fsmbPdcEvent.count({
        where: {
          occurredAt: { gte: since7d },
          monitoringAlertId: { not: null },
        },
      }),
    ]),
  ]);
  const [active, pending, eventsLast7d, alertsLast7d] = counts;

  const lastSync = subs.find((s) => s.lastSyncedAt)?.lastSyncedAt;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          FSMB Practitioner Data Center
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Continuous monitoring feed from the Federation of State Medical
          Boards. Each event from a subscribed physician triggers a
          MonitoringAlert when it represents a board action, license-status
          change, or disciplinary report.
        </p>
        {lastSync && (
          <p className="text-xs text-gray-500 mt-1">
            Last feed sync: {lastSync.toLocaleString("en-US")}
          </p>
        )}
      </header>

      <section className="grid grid-cols-4 gap-4">
        <Stat label="Active subscriptions" value={active} color="text-green-700" />
        <Stat label="Pending enrollment" value={pending} color="text-amber-700" />
        <Stat
          label="Events (7d)"
          value={eventsLast7d}
          color="text-indigo-700"
        />
        <Stat
          label="Alerts raised (7d)"
          value={alertsLast7d}
          color={alertsLast7d > 0 ? "text-red-700" : "text-gray-600"}
        />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Subscriptions ({subs.length})
          </h2>
        </header>
        {subs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No FSMB PDC subscriptions yet — enroll a provider from their
            provider page.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">NPI</th>
                <th className="px-4 py-2 text-left">FSMB ID</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Enrolled</th>
                <th className="px-4 py-2 text-left">Last event</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subs.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs">
                    <Link
                      href={`/providers/${s.provider.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {s.provider.legalLastName}, {s.provider.legalFirstName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {s.provider.npi ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {s.fsmbId ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[s.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {s.enrolledAt?.toLocaleDateString("en-US") ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {s.lastEventReceivedAt?.toLocaleString("en-US") ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent events ({events.length})
          </h2>
        </header>
        {events.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No events received yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">State</th>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {events.map((e) => (
                <tr key={e.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {e.occurredAt.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Link
                      href={`/providers/${e.provider.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {e.provider.legalLastName}, {e.provider.legalFirstName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {e.eventType.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {e.state ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        SEVERITY_COLORS[e.severity] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {e.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        PROCESSING_COLORS[e.processingStatus] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {e.processingStatus}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700 max-w-md truncate">
                    {e.summary}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
