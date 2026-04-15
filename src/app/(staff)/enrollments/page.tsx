import { db } from "@/server/db";
import Link from "next/link";
import { EnrollmentRowActions } from "@/components/enrollments/EnrollmentRowActions";
import { RosterGenerationPanel } from "@/components/enrollments/RosterGenerationPanel";

interface SearchParams {
  q?: string;
  status?: string;
  enrollmentType?: string;
  page?: string;
}

const PAGE_SIZE = 25;

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  PENDING_PAYER: "Pending Payer",
  ENROLLED: "Enrolled",
  DENIED: "Denied",
  ERROR: "Error",
  WITHDRAWN: "Withdrawn",
};

const typeLabels: Record<string, string> = {
  DELEGATED: "Delegated",
  FACILITY_BTC: "Facility (BTC)",
  DIRECT: "Direct",
};

const methodLabels: Record<string, string> = {
  PORTAL_MPP: "My Practice Profile",
  PORTAL_AVAILITY: "Availity",
  PORTAL_VERITY: "Verity",
  PORTAL_EYEMED: "EyeMed Portal",
  PORTAL_VNS: "VNS Portal",
  EMAIL: "Email",
  FAX: "Fax",
  PAPER: "Paper",
  OTHER: "Other",
};

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ENROLLED":
      return <span className="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">{statusLabels[status]}</span>;
    case "DENIED":
      return <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{statusLabels[status]}</span>;
    case "ERROR":
      return <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">{statusLabels[status]}</span>;
    case "PENDING_PAYER":
      return <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">{statusLabels[status]}</span>;
    case "SUBMITTED":
      return <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-700">{statusLabels[status]}</span>;
    case "WITHDRAWN":
      return <span className="text-xs px-2 py-1 rounded-full bg-orange-100 text-orange-700">{statusLabels[status]}</span>;
    default:
      return <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{statusLabels[status] ?? status}</span>;
  }
}

export default async function EnrollmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, status, enrollmentType, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (enrollmentType) where.enrollmentType = enrollmentType;
  if (q) {
    where.OR = [
      { payerName: { contains: q, mode: "insensitive" } },
      {
        provider: {
          OR: [
            { legalFirstName: { contains: q, mode: "insensitive" } },
            { legalLastName: { contains: q, mode: "insensitive" } },
          ],
        },
      },
    ];
  }

  const [enrollments, totalCount, allEnrollmentsForStats] = await Promise.all([
    db.enrollment.findMany({
      where,
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true, providerType: true },
        },
        assignedTo: { select: { id: true, displayName: true } },
        followUps: { orderBy: { followUpDate: "desc" }, take: 1 },
      },
      orderBy: [
        { followUpDueDate: "asc" },
        { updatedAt: "desc" },
      ],
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.enrollment.count({ where }),
    db.enrollment.findMany({
      select: { status: true, followUpDueDate: true },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const now = new Date();

  const stats = {
    draft: allEnrollmentsForStats.filter((e) => e.status === "DRAFT").length,
    submitted: allEnrollmentsForStats.filter((e) => e.status === "SUBMITTED").length,
    pendingPayer: allEnrollmentsForStats.filter((e) => e.status === "PENDING_PAYER").length,
    enrolled: allEnrollmentsForStats.filter((e) => e.status === "ENROLLED").length,
    overdueFollowUp: allEnrollmentsForStats.filter(
      (e) => e.followUpDueDate && e.followUpDueDate < now && e.status !== "ENROLLED"
    ).length,
  };

  const hasFilters = !!(q || status || enrollmentType);

  function paginationHref(p: number) {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status) params.set("status", status);
    if (enrollmentType) params.set("enrollmentType", enrollmentType);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/enrollments${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
          <p className="text-gray-500 mt-1">
            Track payer enrollment submissions and status — {totalCount} result{totalCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-600">{stats.draft}</div>
          <div className="text-sm text-gray-500 mt-1">Draft</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.submitted}</div>
          <div className="text-sm text-gray-500 mt-1">Submitted</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.pendingPayer}</div>
          <div className="text-sm text-gray-500 mt-1">Pending Payer</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">{stats.enrolled}</div>
          <div className="text-sm text-gray-500 mt-1">Enrolled</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-red-600">{stats.overdueFollowUp}</div>
          <div className="text-sm text-gray-500 mt-1">Overdue Follow-Up</div>
        </div>
      </div>

      {/* Filters */}
      <form method="get" className="flex gap-3 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search payer or provider name…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="enrollmentType"
          defaultValue={enrollmentType ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filter
        </button>
        {hasFilters && (
          <Link
            href="/enrollments"
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Clear
          </Link>
        )}
      </form>

      {/* Enrollments Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Payer</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Method</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Follow-Up Due</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Follow-Up</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Assigned To</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                    No enrollments found.{hasFilters && " Try adjusting your filters."}
                  </td>
                </tr>
              ) : (
                enrollments.map((e) => {
                  const isOverdue =
                    e.followUpDueDate && e.followUpDueDate < now && e.status !== "ENROLLED";
                  const lastFollowUp = e.followUps[0];
                  return (
                    <tr
                      key={e.id}
                      className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : ""}`}
                    >
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/providers/${e.provider.id}`}
                          className="text-sm text-blue-600 hover:underline font-medium"
                        >
                          {e.provider.legalFirstName} {e.provider.legalLastName}
                        </Link>
                        <div className="text-[11px] text-gray-400 leading-tight">
                          {e.provider.providerType.abbreviation}
                        </div>
                      </td>
                      <td className="px-3 py-1.5 text-sm">
                        <Link
                          href={`/enrollments/${e.id}`}
                          className="text-gray-900 hover:text-blue-600 hover:underline"
                        >
                          {e.payerName}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {typeLabels[e.enrollmentType] ?? e.enrollmentType}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {methodLabels[e.submissionMethod] ?? e.submissionMethod}
                      </td>
                      <td className="px-3 py-1.5">
                        <StatusBadge status={e.status} />
                      </td>
                      <td
                        className={`px-3 py-1.5 text-sm ${
                          isOverdue ? "text-red-600 font-medium" : "text-gray-500"
                        }`}
                      >
                        {e.followUpDueDate
                          ? e.followUpDueDate.toLocaleDateString()
                          : "—"}
                        {isOverdue && " (OVERDUE)"}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {lastFollowUp
                          ? lastFollowUp.followUpDate.toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {e.assignedTo?.displayName ?? "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <EnrollmentRowActions
                          enrollmentId={e.id}
                          payerName={e.payerName}
                        />
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
                <Link
                  href={paginationHref(currentPage - 1)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
                >
                  ← Previous
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">
                  ← Previous
                </span>
              )}
              {currentPage < totalPages ? (
                <Link
                  href={paginationHref(currentPage + 1)}
                  className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors"
                >
                  Next →
                </Link>
              ) : (
                <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">
                  Next →
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Roster Generation Panel */}
      <RosterGenerationPanel
        enrollments={enrollments.map((e) => ({
          id: e.id,
          payerName: e.payerName,
          enrollmentType: e.enrollmentType,
          status: e.status,
        }))}
      />
    </div>
  );
}
