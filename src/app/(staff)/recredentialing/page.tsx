import { db } from "@/server/db";
import Link from "next/link";

const STATUSES = [
  "PENDING", "APPLICATION_SENT", "IN_PROGRESS",
  "PSV_RUNNING", "COMMITTEE_READY", "COMPLETED", "OVERDUE",
] as const;

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  APPLICATION_SENT: "Application Sent",
  IN_PROGRESS: "In Progress",
  PSV_RUNNING: "PSV Running",
  COMMITTEE_READY: "Committee Ready",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
};

const URGENCY_OPTIONS = [
  { value: "", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "30", label: "≤ 30 Days" },
  { value: "60", label: "≤ 60 Days" },
  { value: "90", label: "≤ 90 Days" },
] as const;

const PAGE_SIZE = 25;

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "PENDING":
      return "bg-gray-100 text-gray-700";
    case "APPLICATION_SENT":
      return "bg-blue-100 text-blue-700";
    case "IN_PROGRESS":
      return "bg-indigo-100 text-indigo-700";
    case "PSV_RUNNING":
      return "bg-purple-100 text-purple-700";
    case "COMMITTEE_READY":
      return "bg-yellow-100 text-yellow-700";
    case "COMPLETED":
      return "bg-green-100 text-green-700";
    case "OVERDUE":
      return "bg-red-100 text-red-700";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function formatDate(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

interface SearchParams {
  q?: string;
  status?: string;
  urgency?: string;
  page?: string;
}

export default async function RecredentialingPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const status = params.status || "";
  const urgency = params.urgency || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const now = new Date();
  const in30 = new Date();
  in30.setDate(now.getDate() + 30);
  const in60 = new Date();
  in60.setDate(now.getDate() + 60);
  const in90 = new Date();
  in90.setDate(now.getDate() + 90);

  const where: Record<string, unknown> = {};

  if (status) where.status = status;
  if (q) {
    where.provider = {
      OR: [
        { legalFirstName: { contains: q, mode: "insensitive" } },
        { legalLastName: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  if (urgency === "overdue") {
    where.dueDate = { lt: now };
    where.status = { not: "COMPLETED" };
  } else if (urgency === "30") {
    where.dueDate = { gte: now, lte: in30 };
    where.status = { not: "COMPLETED" };
  } else if (urgency === "60") {
    where.dueDate = { gte: now, lte: in60 };
    where.status = { not: "COMPLETED" };
  } else if (urgency === "90") {
    where.dueDate = { gte: now, lte: in90 };
    where.status = { not: "COMPLETED" };
  }

  const [
    overdue,
    due30,
    due60,
    inProgress,
    completed,
    total,
    cycles,
  ] = await Promise.all([
    db.recredentialingCycle.count({
      where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
    }),
    db.recredentialingCycle.count({
      where: { dueDate: { gte: now, lte: in30 }, status: { not: "COMPLETED" } },
    }),
    db.recredentialingCycle.count({
      where: { dueDate: { gte: in30, lte: in60 }, status: { not: "COMPLETED" } },
    }),
    db.recredentialingCycle.count({
      where: { status: { in: ["IN_PROGRESS", "PSV_RUNNING", "APPLICATION_SENT"] } },
    }),
    db.recredentialingCycle.count({ where: { status: "COMPLETED" } }),
    db.recredentialingCycle.count({ where }),
    db.recredentialingCycle.findMany({
      where,
      include: {
        provider: {
          select: {
            id: true,
            legalFirstName: true,
            legalLastName: true,
            providerType: true,
          },
        },
      },
      orderBy: { dueDate: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summaryCards = [
    { label: "Overdue", count: overdue, urgencyParam: "overdue", borderClass: "border-red-400", bgClass: "bg-red-50", textClass: "text-red-700", countClass: "text-red-900" },
    { label: "≤ 30 Days", count: due30, urgencyParam: "30", borderClass: "border-orange-400", bgClass: "bg-orange-50", textClass: "text-orange-700", countClass: "text-orange-900" },
    { label: "≤ 60 Days", count: due60, urgencyParam: "60", borderClass: "border-yellow-400", bgClass: "bg-yellow-50", textClass: "text-yellow-700", countClass: "text-yellow-900" },
    { label: "In Progress", count: inProgress, urgencyParam: "", borderClass: "border-blue-400", bgClass: "bg-blue-50", textClass: "text-blue-700", countClass: "text-blue-900" },
    { label: "Completed", count: completed, urgencyParam: "", borderClass: "border-green-400", bgClass: "bg-green-50", textClass: "text-green-700", countClass: "text-green-900" },
  ];

  function buildUrl(overrides: Record<string, string>): string {
    const p = new URLSearchParams();
    const merged = { q, status, urgency, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "page" && v === "1")) {
        p.set(k, v);
      }
    }
    if (p.get("page") === "1") p.delete("page");
    const qs = p.toString();
    return qs ? `/recredentialing?${qs}` : "/recredentialing";
  }

  const hasFilters = q || status || urgency;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recredentialing</h1>
        <p className="text-gray-500 mt-1">
          Track provider recredentialing cycles — {total} result{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => {
          const isClickable = !!card.urgencyParam;
          const isActive = urgency === card.urgencyParam && isClickable;
          const content = (
            <>
              <div className={`text-sm font-medium ${card.textClass}`}>{card.label}</div>
              <div className={`text-3xl font-bold mt-1 ${card.countClass}`}>{card.count}</div>
            </>
          );

          if (isClickable) {
            return (
              <Link
                key={card.label}
                href={buildUrl({ urgency: isActive ? "" : card.urgencyParam, page: "1" })}
                className={[
                  "rounded-lg border-l-4 p-4 transition-shadow hover:shadow-md",
                  card.borderClass,
                  card.bgClass,
                  isActive ? "ring-2 ring-offset-1 ring-gray-400" : "",
                ].join(" ")}
              >
                {content}
              </Link>
            );
          }

          return (
            <div
              key={card.label}
              className={`rounded-lg border-l-4 p-4 ${card.borderClass} ${card.bgClass}`}
            >
              {content}
            </div>
          );
        })}
      </div>

      {/* Filter Bar */}
      <form method="get" className="flex gap-3 flex-wrap items-end">
        <div className="flex-1 min-w-48">
          <label htmlFor="q" className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            id="q"
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Provider name…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label htmlFor="status" className="block text-xs font-medium text-gray-500 mb-1">Status</label>
          <select
            id="status"
            name="status"
            defaultValue={status}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>{statusLabels[s]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="urgency" className="block text-xs font-medium text-gray-500 mb-1">Urgency</label>
          <select
            id="urgency"
            name="urgency"
            defaultValue={urgency}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {URGENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href="/recredentialing"
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
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
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Cycle #</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Days Until Due</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Started</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {cycles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No recredentialing cycles found.{hasFilters && " Try adjusting your filters."}
                  </td>
                </tr>
              ) : (
                cycles.map((c) => {
                  const daysUntilDue = Math.floor(
                    (c.dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  const isOverdue = daysUntilDue < 0 && c.status !== "COMPLETED";
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : daysUntilDue <= 30 && c.status !== "COMPLETED" ? "bg-yellow-50" : ""}`}
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/providers/${c.provider.id}`}
                          className="text-blue-600 hover:underline font-medium text-sm"
                        >
                          {c.provider.legalFirstName} {c.provider.legalLastName}
                        </Link>
                        <div className="text-[11px] text-gray-400 leading-tight">
                          {c.provider.providerType.abbreviation}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-700">
                        {c.provider.providerType.abbreviation}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-700">
                        {c.cycleNumber}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-700">
                        {formatDate(c.dueDate)}
                      </td>
                      <td className="px-3 py-1.5">
                        {c.status === "COMPLETED" ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-50 text-green-600">
                            Done
                          </span>
                        ) : daysUntilDue < 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">
                            {Math.abs(daysUntilDue)}d overdue
                          </span>
                        ) : daysUntilDue <= 30 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                            {daysUntilDue}d
                          </span>
                        ) : daysUntilDue <= 60 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                            {daysUntilDue}d
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                            {daysUntilDue}d
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses(c.status)}`}
                        >
                          {statusLabels[c.status] ?? c.status}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {formatDate(c.startedAt)}
                      </td>
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/providers/${c.provider.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View Provider
                        </Link>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={buildUrl({ page: String(page - 1) })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                ← Previous
              </Link>
            ) : (
              <span className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-lg cursor-not-allowed">
                ← Previous
              </span>
            )}
            {page < totalPages ? (
              <Link
                href={buildUrl({ page: String(page + 1) })}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Next →
              </Link>
            ) : (
              <span className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-lg cursor-not-allowed">
                Next →
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
