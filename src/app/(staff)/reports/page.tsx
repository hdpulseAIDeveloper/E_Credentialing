import { db } from "@/server/db";
import Link from "next/link";

function complianceColorClasses(rate: number): { text: string; bg: string; border: string } {
  if (rate >= 90) return { text: "text-green-700", bg: "bg-green-50", border: "border-green-400" };
  if (rate >= 70) return { text: "text-yellow-700", bg: "bg-yellow-50", border: "border-yellow-400" };
  return { text: "text-red-700", bg: "bg-red-50", border: "border-red-400" };
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const exportTypes = [
  { type: "providers", label: "Providers", description: "All providers with status, NPI, license, and facility data", icon: "👥" },
  { type: "enrollments", label: "Enrollments", description: "Payer enrollment submissions, statuses, and follow-up dates", icon: "📋" },
  { type: "expirables", label: "Expirables", description: "All credential expirations with verification dates", icon: "⏰" },
  { type: "recredentialing", label: "Recredentialing", description: "Recredentialing cycles with due dates and completion status", icon: "🔄" },
] as const;

export default async function ReportsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  const [
    totalProviders,
    activeProviders,
    providersWithVerifications,
    sanctionsProviders,
    approvedProviders,
    completedCycles,
    compliantExpirables,
    totalExpirables,
    savedReports,
  ] = await Promise.all([
    db.provider.count(),
    db.provider.count({ where: { status: "APPROVED" } }),
    db.provider.findMany({
      where: {
        status: {
          in: ["APPROVED", "COMMITTEE_READY", "COMMITTEE_IN_REVIEW", "VERIFICATION_IN_PROGRESS"],
        },
      },
      select: {
        id: true,
        verificationRecords: { select: { status: true } },
      },
    }),
    db.provider.findMany({
      where: { status: { not: "INACTIVE" } },
      select: {
        id: true,
        sanctionsChecks: {
          where: { runDate: { gte: thirtyDaysAgo } },
          select: { source: true, result: true },
        },
      },
    }),
    db.provider.findMany({
      where: { status: "APPROVED", approvedAt: { not: null } },
      select: { createdAt: true, approvedAt: true },
    }),
    db.recredentialingCycle.findMany({
      where: { status: "COMPLETED", completedAt: { not: null } },
      select: { dueDate: true, completedAt: true },
    }),
    db.expirable.count({ where: { status: { in: ["CURRENT", "RENEWED"] } } }),
    db.expirable.count(),
    db.savedReport.findMany({
      include: { createdBy: { select: { id: true, displayName: true } } },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // PSV completion rate
  const psvComplete = providersWithVerifications.filter((p) => {
    if (p.verificationRecords.length === 0) return false;
    return p.verificationRecords.every((v) => v.status === "VERIFIED");
  });
  const psvCompletionRate = providersWithVerifications.length > 0
    ? Math.round((psvComplete.length / providersWithVerifications.length) * 100)
    : 0;

  // Sanctions compliance
  const sanctionsCompliant = sanctionsProviders.filter((p) => {
    const hasOig = p.sanctionsChecks.some((s) => s.source === "OIG" && s.result === "CLEAR");
    const hasSam = p.sanctionsChecks.some((s) => s.source === "SAM_GOV" && s.result === "CLEAR");
    return hasOig && hasSam;
  });
  const sanctionsComplianceRate = sanctionsProviders.length > 0
    ? Math.round((sanctionsCompliant.length / sanctionsProviders.length) * 100)
    : 0;

  // Average credentialing days
  const avgCredentialingDays = approvedProviders.length > 0
    ? Math.round(
        approvedProviders.reduce((sum, p) => {
          const days = (p.approvedAt!.getTime() - p.createdAt.getTime()) / (1000 * 60 * 60 * 24);
          return sum + days;
        }, 0) / approvedProviders.length
      )
    : 0;

  // Recredentialing on-time rate
  const onTime = completedCycles.filter((c) => c.completedAt! <= c.dueDate);
  const recredentialingOnTimeRate = completedCycles.length > 0
    ? Math.round((onTime.length / completedCycles.length) * 100)
    : 0;

  // Expirable compliance rate
  const expirableComplianceRate = totalExpirables > 0
    ? Math.round((compliantExpirables / totalExpirables) * 100)
    : 0;

  const complianceMetrics = [
    { label: "Total Providers", value: String(totalProviders), isRate: false },
    { label: "Active Providers", value: String(activeProviders), isRate: false },
    { label: "PSV Completion Rate", value: psvCompletionRate, isRate: true },
    { label: "Sanctions Compliance", value: sanctionsComplianceRate, isRate: true },
    { label: "Avg Credentialing Days", value: `${avgCredentialingDays}d`, isRate: false },
    { label: "Recredentialing On-Time", value: recredentialingOnTimeRate, isRate: true },
    { label: "Expirable Compliance", value: expirableComplianceRate, isRate: true },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Analytics</h1>
        <p className="text-gray-500 mt-1">
          Compliance metrics, data exports, and saved reports
        </p>
      </div>

      {/* Compliance Summary */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Compliance Summary</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
          {complianceMetrics.map((m) => {
            const rate = m.isRate ? (m.value as number) : null;
            const colors = rate !== null
              ? complianceColorClasses(rate)
              : { text: "text-gray-700", bg: "bg-white", border: "border-gray-200" };

            return (
              <div
                key={m.label}
                className={`rounded-lg border-l-4 p-4 ${colors.border} ${colors.bg}`}
              >
                <div className={`text-xs font-medium ${rate !== null ? colors.text : "text-gray-500"} uppercase tracking-wide`}>
                  {m.label}
                </div>
                <div className={`text-2xl font-bold mt-1 ${rate !== null ? colors.text : "text-gray-900"}`}>
                  {m.isRate ? `${m.value}%` : m.value}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Export Data */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Export Data</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {exportTypes.map((exp) => (
            <Link
              key={exp.type}
              href={`/reports/export?type=${exp.type}`}
              className="bg-white rounded-lg border p-5 hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="text-2xl mb-2">{exp.icon}</div>
              <div className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                {exp.label}
              </div>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                {exp.description}
              </p>
              <div className="mt-3 text-xs font-medium text-blue-600 group-hover:text-blue-700">
                Export CSV →
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Saved Reports */}
      <section>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Saved Reports</h2>
        {savedReports.length === 0 ? (
          <div className="bg-white rounded-lg border p-6 text-center text-gray-500">
            No saved reports yet. Create custom reports from the export tools above.
          </div>
        ) : (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Category</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Created By</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {savedReports.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium text-sm text-gray-900">{r.name}</div>
                        {r.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{r.description}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                          {r.category}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {r.createdBy.displayName}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">
                        {formatDate(r.updatedAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
