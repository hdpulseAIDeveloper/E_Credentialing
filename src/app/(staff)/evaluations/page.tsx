import { db } from "@/server/db";
import Link from "next/link";

interface SearchParams {
  q?: string;
  evaluationType?: string;
  status?: string;
  page?: string;
}

const PAGE_SIZE = 25;

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function buildUrl(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/evaluations${qs ? `?${qs}` : ""}`;
}

export default async function EvaluationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, evaluationType, status, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (evaluationType) where.evaluationType = evaluationType;
  if (q) {
    where.provider = {
      OR: [
        { legalFirstName: { contains: q, mode: "insensitive" } },
        { legalLastName: { contains: q, mode: "insensitive" } },
      ],
    };
  }

  const [evaluations, totalCount, allForStats] = await Promise.all([
    db.practiceEvaluation.findMany({
      where,
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
        evaluator: { select: { id: true, displayName: true } },
      },
      orderBy: { dueDate: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.practiceEvaluation.count({ where }),
    db.practiceEvaluation.findMany({
      select: { status: true, completedAt: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(q || evaluationType || status);

  const stats = {
    scheduled: allForStats.filter((e) => e.status === "SCHEDULED").length,
    inProgress: allForStats.filter((e) => e.status === "IN_PROGRESS").length,
    overdue: allForStats.filter((e) => e.status === "OVERDUE").length,
    completedThisMonth: allForStats.filter(
      (e) => e.status === "COMPLETED" && e.completedAt && e.completedAt >= monthStart
    ).length,
  };

  function paginationHref(p: number) {
    return buildUrl({ q, evaluationType, status, page: p > 1 ? String(p) : undefined });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Practice Evaluations (OPPE/FPPE)</h1>
        <p className="text-gray-500 mt-1">
          Track ongoing and focused professional practice evaluations — {totalCount} result{totalCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.scheduled}</div>
          <div className="text-sm text-gray-500 mt-1">Scheduled</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-indigo-600">{stats.inProgress}</div>
          <div className="text-sm text-gray-500 mt-1">In Progress</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-gray-500 mt-1">Overdue</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">{stats.completedThisMonth}</div>
          <div className="text-sm text-gray-500 mt-1">Completed This Month</div>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex gap-3 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by provider name…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="evaluationType"
          defaultValue={evaluationType ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          <option value="OPPE">OPPE</option>
          <option value="FPPE">FPPE</option>
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Filter
        </button>
        {hasFilters && (
          <Link href="/evaluations" className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
            Clear
          </Link>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Days Until Due</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Evaluator</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {evaluations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No evaluations found.{hasFilters && " Try adjusting your filters."}
                  </td>
                </tr>
              ) : (
                evaluations.map((ev) => {
                  const daysUntilDue = Math.ceil(
                    (ev.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const daysLabel =
                    ev.status === "COMPLETED"
                      ? "—"
                      : daysUntilDue < 0
                        ? `${Math.abs(daysUntilDue)}d overdue`
                        : `${daysUntilDue}d`;
                  const daysColor =
                    ev.status === "COMPLETED"
                      ? "text-gray-400"
                      : daysUntilDue < 0
                        ? "text-red-600 font-medium"
                        : daysUntilDue <= 14
                          ? "text-yellow-600 font-medium"
                          : "text-gray-500";

                  return (
                    <tr key={ev.id} className={`hover:bg-gray-50 ${ev.status === "OVERDUE" ? "bg-red-50" : ""}`}>
                      <td className="px-3 py-1.5">
                        <Link href={`/providers/${ev.provider.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {ev.provider.legalFirstName} {ev.provider.legalLastName}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ev.evaluationType === "OPPE" ? "bg-purple-100 text-purple-700" : "bg-orange-100 text-orange-700"
                        }`}>
                          {ev.evaluationType}
                        </span>
                      </td>
                      <td className="px-3 py-1.5"><StatusBadge status={ev.status} /></td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {fmt(ev.periodStart)} – {fmt(ev.periodEnd)}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(ev.dueDate)}</td>
                      <td className={`px-3 py-1.5 text-sm ${daysColor}`}>{daysLabel}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{ev.evaluator?.displayName ?? "—"}</td>
                      <td className="px-3 py-1.5">
                        <Link href={`/providers/${ev.provider.id}?tab=evaluations`} className="text-sm text-blue-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t px-4 py-3 bg-gray-50">
            <p className="text-sm text-gray-600">
              Page {currentPage} of {totalPages} ({totalCount} total)
            </p>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link href={paginationHref(currentPage - 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors">
                  ← Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">← Previous</span>
              )}
              {currentPage < totalPages ? (
                <Link href={paginationHref(currentPage + 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors">
                  Next →
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">Next →</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
