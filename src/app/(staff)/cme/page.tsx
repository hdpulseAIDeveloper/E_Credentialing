import { db } from "@/server/db";
import Link from "next/link";

interface SearchParams {
  q?: string;
  page?: string;
}

const PAGE_SIZE = 25;

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function buildUrl(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return `/cme${qs ? `?${qs}` : ""}`;
}

const CME_REQUIREMENT = 50;

export default async function CmePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { q, page: pageParam } = await searchParams;
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const providerWhere = q
    ? {
        OR: [
          { legalFirstName: { contains: q, mode: "insensitive" as const } },
          { legalLastName: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [providers, totalCount] = await Promise.all([
    db.provider.findMany({
      where: {
        ...providerWhere,
        cmeCredits: { some: {} },
      },
      select: {
        id: true,
        legalFirstName: true,
        legalLastName: true,
        cmeCredits: {
          select: {
            credits: true,
            category: true,
            completedDate: true,
          },
          orderBy: { completedDate: "desc" },
        },
      },
      orderBy: { legalLastName: "asc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.provider.count({
      where: {
        ...providerWhere,
        cmeCredits: { some: {} },
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!q;

  const rows = providers.map((p) => {
    const totalCredits = p.cmeCredits.reduce((sum, c) => sum + c.credits, 0);
    const cat1 = p.cmeCredits
      .filter((c) => c.category === "Category 1")
      .reduce((sum, c) => sum + c.credits, 0);
    const cat2 = p.cmeCredits
      .filter((c) => c.category === "Category 2")
      .reduce((sum, c) => sum + c.credits, 0);
    const lastActivity = p.cmeCredits[0]?.completedDate ?? null;
    const requirementsMet = totalCredits >= CME_REQUIREMENT;

    return {
      id: p.id,
      name: `${p.legalFirstName} ${p.legalLastName}`,
      totalCredits,
      cat1,
      cat2,
      requirementsMet,
      lastActivity,
    };
  });

  function paginationHref(p: number) {
    return buildUrl({ q, page: p > 1 ? String(p) : undefined });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CME Credit Tracking</h1>
        <p className="text-gray-500 mt-1">
          Monitor continuing medical education credits by provider — {totalCount} provider{totalCount !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Filter */}
      <form method="get" className="flex gap-3 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by provider name…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
          Filter
        </button>
        {hasFilters && (
          <Link href="/cme" className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
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
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Total Credits</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Category 1</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Category 2</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Requirements Met</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Activity</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    No CME credits found.{hasFilters && " Try adjusting your search."}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <Link href={`/providers/${r.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-sm font-medium text-gray-900">{r.totalCredits.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{r.cat1.toFixed(1)}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{r.cat2.toFixed(1)}</td>
                    <td className="px-3 py-1.5">
                      {r.requirementsMet ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Met</span>
                      ) : (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Not Met</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(r.lastActivity)}</td>
                    <td className="px-3 py-1.5">
                      <Link href={`/providers/${r.id}?tab=cme`} className="text-sm text-blue-600 hover:underline">
                        Details
                      </Link>
                    </td>
                  </tr>
                ))
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
