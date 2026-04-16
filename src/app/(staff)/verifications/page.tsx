import { db } from "@/server/db";
import Link from "next/link";

interface SearchParams {
  tab?: string;
  q?: string;
  status?: string;
  page?: string;
}

const PAGE_SIZE = 25;

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const statusColors: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  REMINDER_SENT: "bg-yellow-100 text-yellow-700",
  RECEIVED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-700",
  DECLINED: "bg-red-100 text-red-700",
};

const statusLabels: Record<string, string> = {
  PENDING: "Pending",
  SENT: "Sent",
  REMINDER_SENT: "Reminder Sent",
  RECEIVED: "Received",
  EXPIRED: "Expired",
  DECLINED: "Declined",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[status] ?? "bg-gray-100 text-gray-600"}`}>
      {statusLabels[status] ?? status}
    </span>
  );
}

function buildUrl(base: string, params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v) sp.set(k, v);
  }
  const qs = sp.toString();
  return `${base}${qs ? `?${qs}` : ""}`;
}

export default async function VerificationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { tab: rawTab, q, status, page: pageParam } = await searchParams;
  const tab = rawTab === "references" ? "references" : "work-history";
  const currentPage = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const providerNameFilter = q
    ? {
        provider: {
          OR: [
            { legalFirstName: { contains: q, mode: "insensitive" as const } },
            { legalLastName: { contains: q, mode: "insensitive" as const } },
          ],
        },
      }
    : {};

  if (tab === "references") {
    const where = {
      ...providerNameFilter,
      ...(status ? { status: status as never } : {}),
    };

    const [references, totalCount] = await Promise.all([
      db.professionalReference.findMany({
        where,
        include: {
          provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: (currentPage - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),
      db.professionalReference.count({ where }),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const hasFilters = !!(q || status);

    function href(p: number) {
      return buildUrl("/verifications", { tab: "references", q, status, page: p > 1 ? String(p) : undefined });
    }

    return (
      <div className="space-y-6">
        <Header />
        <TabNav activeTab={tab} q={q} status={status} />
        <FilterBar tab="references" q={q} status={status} hasFilters={hasFilters} />

        <div className="bg-white rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Reference</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Title</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Relationship</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Received</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {references.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                      No references found.{hasFilters && " Try adjusting your filters."}
                    </td>
                  </tr>
                ) : (
                  references.map((r) => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        <Link href={`/providers/${r.provider.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {r.provider.legalFirstName} {r.provider.legalLastName}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-900">{r.referenceName}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{r.referenceTitle ?? "—"}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{r.referenceEmail}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{r.relationship ?? "—"}</td>
                      <td className="px-3 py-1.5"><StatusBadge status={r.status} /></td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(r.requestSentAt)}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(r.receivedAt)}</td>
                      <td className="px-3 py-1.5">
                        <Link href={`/providers/${r.provider.id}?tab=references`} className="text-sm text-blue-600 hover:underline">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} href={href} />
        </div>
      </div>
    );
  }

  // Work History tab (default)
  const where = {
    ...providerNameFilter,
    ...(status ? { status: status as never } : {}),
  };

  const [verifications, totalCount] = await Promise.all([
    db.workHistoryVerification.findMany({
      where,
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.workHistoryVerification.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const hasFilters = !!(q || status);

  function href(p: number) {
    return buildUrl("/verifications", { tab: "work-history", q, status, page: p > 1 ? String(p) : undefined });
  }

  return (
    <div className="space-y-6">
      <Header />
      <TabNav activeTab={tab} q={q} status={status} />
      <FilterBar tab="work-history" q={q} status={status} hasFilters={hasFilters} />

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Employer</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Contact</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Position</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Period</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Sent</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Received</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {verifications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                    No work history verifications found.{hasFilters && " Try adjusting your filters."}
                  </td>
                </tr>
              ) : (
                verifications.map((v) => {
                  const period = v.startDate || v.endDate
                    ? `${v.startDate ? fmt(v.startDate) : "?"} – ${v.endDate ? fmt(v.endDate) : "Present"}`
                    : "—";
                  return (
                    <tr key={v.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5">
                        <Link href={`/providers/${v.provider.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {v.provider.legalFirstName} {v.provider.legalLastName}
                        </Link>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-900">{v.employerName}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{v.contactName ?? "—"}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{v.position ?? "—"}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{period}</td>
                      <td className="px-3 py-1.5"><StatusBadge status={v.status} /></td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(v.requestSentAt)}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(v.receivedAt)}</td>
                      <td className="px-3 py-1.5">
                        <Link href={`/providers/${v.provider.id}?tab=work-history`} className="text-sm text-blue-600 hover:underline">
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
        <Pagination currentPage={currentPage} totalPages={totalPages} totalCount={totalCount} href={href} />
      </div>
    </div>
  );
}

function Header() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">Verification Tracking</h1>
      <p className="text-gray-500 mt-1">Track work history verifications and professional reference requests</p>
    </div>
  );
}

function TabNav({ activeTab, q, status }: { activeTab: string; q?: string; status?: string }) {
  const tabs = [
    { key: "work-history", label: "Work History" },
    { key: "references", label: "Professional References" },
  ];

  return (
    <div className="flex gap-1 border-b">
      {tabs.map((t) => {
        const isActive = t.key === activeTab;
        const href = buildUrl("/verifications", { tab: t.key, q, status });
        return (
          <Link
            key={t.key}
            href={href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              isActive
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}

function FilterBar({ tab, q, status, hasFilters }: { tab: string; q?: string; status?: string; hasFilters: boolean }) {
  return (
    <form method="get" className="flex gap-3 flex-wrap">
      <input type="hidden" name="tab" value={tab} />
      <input
        type="text"
        name="q"
        defaultValue={q ?? ""}
        placeholder="Search by provider name…"
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
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
        <Link href={buildUrl("/verifications", { tab })} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
          Clear
        </Link>
      )}
    </form>
  );
}

function Pagination({
  currentPage,
  totalPages,
  totalCount,
  href,
}: {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  href: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t px-4 py-3 bg-gray-50">
      <p className="text-sm text-gray-600">
        Page {currentPage} of {totalPages} ({totalCount} total)
      </p>
      <div className="flex gap-2">
        {currentPage > 1 ? (
          <Link href={href(currentPage - 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors">
            ← Previous
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">← Previous</span>
        )}
        {currentPage < totalPages ? (
          <Link href={href(currentPage + 1)} className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-white transition-colors">
            Next →
          </Link>
        ) : (
          <span className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed">Next →</span>
        )}
      </div>
    </div>
  );
}
