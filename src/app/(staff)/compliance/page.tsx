/**
 * Staff: Compliance readiness dashboard — P3 Gap #23.
 *
 * Side-by-side readiness scoring for HITRUST r2 and SOC 2 Type II, plus a
 * roll-up of open gaps and audit-period status. The control catalogue and
 * evidence binders live on /compliance/[framework].
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getReadinessSummary } from "@/lib/compliance-readiness";

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const [hitrust, soc2, periods] = await Promise.all([
    getReadinessSummary(db, "HITRUST_R2"),
    getReadinessSummary(db, "SOC2_TYPE_II"),
    db.complianceAuditPeriod.findMany({
      orderBy: { periodStart: "desc" },
      take: 10,
    }),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          HITRUST r2 / SOC 2 Type II readiness
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Internal readiness tracker. Maintain control owners, evidence
          binders, and gap log so a third-party assessor can validate every
          claimed control with documentary support.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4">
        <FrameworkCard
          title="HITRUST CSF v11 r2"
          summary={hitrust}
          href="/compliance/hitrust"
        />
        <FrameworkCard
          title="SOC 2 Type II (TSC)"
          summary={soc2}
          href="/compliance/soc2"
        />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Audit periods</h2>
          <span className="text-xs text-gray-500">{periods.length} on file</span>
        </header>
        {periods.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No audit periods on file yet. Schedule the next one with your
            assessor and add it here so reminders fire.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Framework</th>
                <th className="px-4 py-2 text-left">Period</th>
                <th className="px-4 py-2 text-left">Assessor</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Report</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {periods.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {p.framework.replace("_", " ")}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {p.periodStart.toISOString().slice(0, 10)} →{" "}
                    {p.periodEnd.toISOString().slice(0, 10)}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {p.assessorOrg ?? "—"}{" "}
                    {p.assessorName ? `· ${p.assessorName}` : ""}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        p.status === "COMPLETED"
                          ? "bg-green-100 text-green-700"
                          : p.status === "FIELDWORK"
                          ? "bg-amber-100 text-amber-800"
                          : p.status === "REPORTING"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {p.reportUrl ? (
                      <a
                        href={p.reportUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Report
                      </a>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
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

function FrameworkCard({
  title,
  summary,
  href,
}: {
  title: string;
  summary: Awaited<ReturnType<typeof getReadinessSummary>>;
  href: string;
}) {
  const totalOpenGaps =
    summary.openGapsBySeverity.LOW +
    summary.openGapsBySeverity.MODERATE +
    summary.openGapsBySeverity.HIGH +
    summary.openGapsBySeverity.CRITICAL;
  const ringColor =
    summary.readinessPercent >= 90
      ? "stroke-green-600"
      : summary.readinessPercent >= 70
      ? "stroke-amber-500"
      : "stroke-red-600";

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <Link
          href={href}
          className="text-xs text-blue-600 hover:underline"
        >
          Open catalog →
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-6">
        <Ring percent={summary.readinessPercent} colorClass={ringColor} />
        <div className="flex-1 grid grid-cols-2 gap-2 text-xs">
          <Pill label="Implemented" value={summary.byStatus.IMPLEMENTED} color="text-green-700" />
          <Pill label="Partial" value={summary.byStatus.PARTIAL} color="text-amber-700" />
          <Pill label="In progress" value={summary.byStatus.IN_PROGRESS} color="text-blue-700" />
          <Pill label="Not started" value={summary.byStatus.NOT_STARTED} color="text-gray-700" />
          <Pill label="N/A" value={summary.byStatus.NOT_APPLICABLE} color="text-gray-500" />
          <Pill label="Open gaps" value={totalOpenGaps} color={totalOpenGaps > 0 ? "text-red-700" : "text-gray-500"} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
        <Mini label="Critical gaps" value={summary.openGapsBySeverity.CRITICAL} alert={summary.openGapsBySeverity.CRITICAL > 0} />
        <Mini label="Stale reviews" value={summary.staleReviewControls} alert={summary.staleReviewControls > 0} />
        <Mini label="Missing evidence (12mo)" value={summary.staleEvidenceControls} alert={summary.staleEvidenceControls > 0} />
      </div>

      {summary.nextAuditPeriodStart && (
        <p className="mt-3 text-xs text-gray-600">
          Next audit window opens{" "}
          <strong>{summary.nextAuditPeriodStart.toISOString().slice(0, 10)}</strong>
        </p>
      )}
    </div>
  );
}

function Ring({ percent, colorClass }: { percent: number; colorClass: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dash = (percent / 100) * circumference;
  return (
    <div className="relative h-24 w-24">
      <svg className="-rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          className="stroke-gray-200"
        />
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference - dash}`}
          className={colorClass}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-lg font-bold text-gray-800">
        {percent}%
      </div>
    </div>
  );
}

function Pill({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between border border-gray-100 rounded px-2 py-1">
      <span className="text-gray-600">{label}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
    </div>
  );
}

function Mini({
  label,
  value,
  alert,
}: {
  label: string;
  value: number;
  alert: boolean;
}) {
  return (
    <div
      className={`rounded px-2 py-1 ${
        alert ? "bg-red-50 text-red-700 border border-red-100" : "bg-gray-50 text-gray-600 border border-gray-100"
      }`}
    >
      <div className="text-[10px] uppercase tracking-wide">{label}</div>
      <div className="text-base font-semibold">{value}</div>
    </div>
  );
}
