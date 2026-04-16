import { db } from "@/server/db";

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AnalyticsPage() {
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(now.getDate() - 90);

  const [
    totalProviders,
    approvedProviders,
    approvedRecently,
    avgDaysRaw,
    statusCounts,
    enrollmentStatusCounts,
    botRunCounts,
    recentApprovals,
    expirablesByStatus,
    recredByStatus,
  ] = await Promise.all([
    db.provider.count(),
    db.provider.count({ where: { status: "APPROVED" } }),
    db.provider.count({ where: { approvedAt: { gte: thirtyDaysAgo } } }),
    db.provider.findMany({
      where: { status: "APPROVED", approvedAt: { not: null } },
      select: { createdAt: true, approvedAt: true },
    }),
    db.provider.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.enrollment.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.botRun.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    db.provider.findMany({
      where: { status: "APPROVED", approvedAt: { gte: ninetyDaysAgo } },
      select: {
        id: true,
        legalFirstName: true,
        legalLastName: true,
        createdAt: true,
        approvedAt: true,
        providerType: { select: { abbreviation: true } },
      },
      orderBy: { approvedAt: "desc" },
      take: 10,
    }),
    db.expirable.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.recredentialingCycle.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const avgDays =
    avgDaysRaw.length > 0
      ? Math.round(
          avgDaysRaw.reduce((sum, p) => {
            const days = Math.floor(
              ((p.approvedAt?.getTime() || 0) - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)
            );
            return sum + days;
          }, 0) / avgDaysRaw.length
        )
      : 0;

  const medianDays = (() => {
    if (avgDaysRaw.length === 0) return 0;
    const days = avgDaysRaw
      .map((p) =>
        Math.floor(((p.approvedAt?.getTime() || 0) - p.createdAt.getTime()) / (1000 * 60 * 60 * 24))
      )
      .sort((a, b) => a - b);
    const mid = Math.floor(days.length / 2);
    return days.length % 2 !== 0 ? days[mid] : Math.round((days[mid - 1] + days[mid]) / 2);
  })();

  const statusMap: Record<string, number> = {};
  statusCounts.forEach((s) => {
    statusMap[s.status] = s._count._all;
  });

  const enrollmentMap: Record<string, number> = {};
  enrollmentStatusCounts.forEach((s) => {
    enrollmentMap[s.status] = s._count._all;
  });

  const botMap: Record<string, number> = {};
  botRunCounts.forEach((s) => {
    botMap[s.status] = s._count._all;
  });

  const expirableMap: Record<string, number> = {};
  expirablesByStatus.forEach((s) => {
    expirableMap[s.status] = s._count.status;
  });

  const recredMap: Record<string, number> = {};
  recredByStatus.forEach((s) => {
    recredMap[s.status] = s._count.status;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Turnaround Analytics</h1>
        <p className="text-gray-500 mt-1">Credentialing performance metrics and processing times</p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Total Providers</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">{totalProviders}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Approved</div>
          <div className="text-3xl font-bold text-green-700 mt-1">{approvedProviders}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Avg Days to Approval</div>
          <div className="text-3xl font-bold text-blue-700 mt-1">{avgDays}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-xs font-medium text-gray-500 uppercase">Median Days</div>
          <div className="text-3xl font-bold text-indigo-700 mt-1">{medianDays}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Provider Pipeline */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Provider Pipeline</h3>
          <div className="space-y-3">
            {[
              { label: "Invited", value: statusMap["INVITED"] || 0, color: "bg-gray-400" },
              { label: "Onboarding", value: statusMap["ONBOARDING_IN_PROGRESS"] || 0, color: "bg-blue-400" },
              { label: "Docs Pending", value: statusMap["DOCUMENTS_PENDING"] || 0, color: "bg-yellow-400" },
              { label: "Verification", value: statusMap["VERIFICATION_IN_PROGRESS"] || 0, color: "bg-indigo-400" },
              { label: "Committee Ready", value: statusMap["COMMITTEE_READY"] || 0, color: "bg-purple-400" },
              { label: "In Review", value: statusMap["COMMITTEE_IN_REVIEW"] || 0, color: "bg-orange-400" },
              { label: "Approved", value: statusMap["APPROVED"] || 0, color: "bg-green-400" },
              { label: "Denied", value: statusMap["DENIED"] || 0, color: "bg-red-400" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className="w-28 text-xs text-gray-600">{item.label}</div>
                <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full`}
                    style={{ width: `${totalProviders > 0 ? (item.value / totalProviders) * 100 : 0}%` }}
                  />
                </div>
                <div className="w-8 text-xs font-medium text-gray-700 text-right">{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Enrollment Status */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Enrollment Status</h3>
          <div className="space-y-3">
            {[
              { label: "Draft", value: enrollmentMap["DRAFT"] || 0, color: "bg-gray-400" },
              { label: "Submitted", value: enrollmentMap["SUBMITTED"] || 0, color: "bg-blue-400" },
              { label: "Pending Payer", value: enrollmentMap["PENDING_PAYER"] || 0, color: "bg-yellow-400" },
              { label: "Enrolled", value: enrollmentMap["ENROLLED"] || 0, color: "bg-green-400" },
              { label: "Denied", value: enrollmentMap["DENIED"] || 0, color: "bg-red-400" },
              { label: "Error", value: enrollmentMap["ERROR"] || 0, color: "bg-orange-400" },
            ].map((item) => {
              const total = Object.values(enrollmentMap).reduce((a, b) => a + b, 0);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-600">{item.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs font-medium text-gray-700 text-right">{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bot Runs */}
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Bot Run Status</h3>
          <div className="space-y-3">
            {[
              { label: "Queued", value: botMap["QUEUED"] || 0, color: "bg-gray-400" },
              { label: "Running", value: botMap["RUNNING"] || 0, color: "bg-blue-400" },
              { label: "Completed", value: botMap["COMPLETED"] || 0, color: "bg-green-400" },
              { label: "Failed", value: botMap["FAILED"] || 0, color: "bg-red-400" },
              { label: "Retrying", value: botMap["RETRYING"] || 0, color: "bg-yellow-400" },
              { label: "Manual", value: botMap["REQUIRES_MANUAL"] || 0, color: "bg-orange-400" },
            ].map((item) => {
              const total = Object.values(botMap).reduce((a, b) => a + b, 0);
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="w-28 text-xs text-gray-600">{item.label}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${total > 0 ? (item.value / total) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="w-8 text-xs font-medium text-gray-700 text-right">{item.value}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Expirables & Recredentialing Summaries */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Expirables Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Current", key: "CURRENT", bg: "bg-green-100", text: "text-green-800" },
              { label: "Expiring Soon", key: "EXPIRING_SOON", bg: "bg-yellow-100", text: "text-yellow-800" },
              { label: "Expired", key: "EXPIRED", bg: "bg-red-100", text: "text-red-800" },
              { label: "Pending Renewal", key: "PENDING_RENEWAL", bg: "bg-blue-100", text: "text-blue-800" },
              { label: "Renewed", key: "RENEWED", bg: "bg-emerald-100", text: "text-emerald-800" },
            ].map((item) => (
              <div key={item.key} className="text-center">
                <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${item.bg} ${item.text}`}>
                  {expirableMap[item.key] || 0}
                </span>
                <div className="text-[11px] text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Recredentialing Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: "Pending", key: "PENDING", bg: "bg-gray-100", text: "text-gray-800" },
              { label: "In Progress", key: "IN_PROGRESS", bg: "bg-blue-100", text: "text-blue-800" },
              { label: "PSV Running", key: "PSV_RUNNING", bg: "bg-indigo-100", text: "text-indigo-800" },
              { label: "Committee Ready", key: "COMMITTEE_READY", bg: "bg-purple-100", text: "text-purple-800" },
              { label: "Completed", key: "COMPLETED", bg: "bg-green-100", text: "text-green-800" },
              { label: "Overdue", key: "OVERDUE", bg: "bg-red-100", text: "text-red-800" },
            ].map((item) => (
              <div key={item.key} className="text-center">
                <span className={`inline-block px-3 py-1.5 rounded-full text-xs font-semibold ${item.bg} ${item.text}`}>
                  {recredMap[item.key] || 0}
                </span>
                <div className="text-[11px] text-gray-500 mt-1">{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Approvals */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-sm font-semibold text-gray-700">Recent Approvals (Last 90 Days)</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Started</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Approved</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Days</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentApprovals.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">No recent approvals.</td>
                </tr>
              ) : (
                recentApprovals.map((p) => {
                  const days = Math.floor(
                    ((p.approvedAt?.getTime() || 0) - p.createdAt.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2 text-sm font-medium text-gray-900">
                        {p.legalFirstName} {p.legalLastName}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-500">{p.providerType.abbreviation}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{fmt(p.createdAt)}</td>
                      <td className="px-3 py-2 text-sm text-gray-500">{fmt(p.approvedAt)}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            days <= 30 ? "bg-green-100 text-green-800" : days <= 60 ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"
                          }`}
                        >
                          {days}d
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Approved in last 30 days: {approvedRecently} providers
      </p>
    </div>
  );
}
