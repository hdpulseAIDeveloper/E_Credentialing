import { db } from "@/server/db";
import Link from "next/link";
import { ExpirableRowActions } from "@/components/expirables/ExpirableRowActions";

const EXPIRABLE_TYPES = [
  "ACLS", "BLS", "PALS", "INFECTION_CONTROL",
  "PAIN_MGMT_HCS", "PAIN_MGMT_PART1", "PAIN_MGMT_PART2",
  "FLU_SHOT", "PHYSICAL_EXAM", "PPD", "QUANTIFERON", "CHEST_XRAY",
  "IDENTIFICATION", "HOSPITAL_PRIVILEGE", "CAQH_ATTESTATION",
  "MEDICAID_ETIN", "MEDICAID_REVALIDATION_PROVIDER", "MEDICAID_REVALIDATION_GROUP",
  "MEDICARE_REVALIDATION_PROVIDER", "MEDICARE_REVALIDATION_GROUP",
  "STATE_LICENSE", "DEA", "BOARD_CERTIFICATION", "MALPRACTICE_INSURANCE",
] as const;

const STATUSES = [
  "CURRENT", "EXPIRING_SOON", "EXPIRED", "PENDING_RENEWAL", "RENEWED",
] as const;

const URGENCY_OPTIONS = [
  { value: "", label: "All" },
  { value: "expired", label: "Expired" },
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "60", label: "60 Days" },
  { value: "90", label: "90 Days" },
] as const;

const PAGE_SIZE = 50;

function formatExpirableType(t: string): string {
  return t
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bHcs\b/, "HCS")
    .replace(/\bEtin\b/, "ETIN")
    .replace(/\bDea\b/, "DEA")
    .replace(/\bBls\b/, "BLS")
    .replace(/\bAcls\b/, "ACLS")
    .replace(/\bPals\b/, "PALS")
    .replace(/\bPpd\b/, "PPD")
    .replace(/\bCaqh\b/, "CAQH")
    .replace(/\bMgmt\b/, "Mgmt");
}

function statusBadgeClasses(status: string): string {
  switch (status) {
    case "CURRENT":
      return "bg-green-100 text-green-800";
    case "EXPIRING_SOON":
      return "bg-yellow-100 text-yellow-800";
    case "EXPIRED":
      return "bg-red-100 text-red-800";
    case "PENDING_RENEWAL":
      return "bg-blue-100 text-blue-800";
    case "RENEWED":
      return "bg-gray-100 text-gray-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function rowBgClass(daysLeft: number): string {
  if (daysLeft < 0) return "bg-red-50";
  if (daysLeft <= 30) return "bg-yellow-50";
  return "";
}

interface SearchParams {
  q?: string;
  expirableType?: string;
  status?: string;
  urgency?: string;
  page?: string;
}

export default async function ExpirablesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const expirableType = params.expirableType || "";
  const status = params.status || "";
  const urgency = params.urgency || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));

  const now = new Date();
  const in7 = new Date(); in7.setDate(now.getDate() + 7);
  const in30 = new Date(); in30.setDate(now.getDate() + 30);
  const in60 = new Date(); in60.setDate(now.getDate() + 60);
  const in90 = new Date(); in90.setDate(now.getDate() + 90);

  // Build filter
  const where: Record<string, unknown> = { status: { not: "RENEWED" } };

  if (status) where.status = status;
  if (expirableType) where.expirableType = expirableType;
  if (q) {
    where.provider = {
      OR: [
        { legalFirstName: { contains: q, mode: "insensitive" } },
        { legalLastName: { contains: q, mode: "insensitive" } },
      ],
    };
  }
  if (urgency === "expired") {
    where.expirationDate = { lt: now };
  } else if (urgency === "7") {
    where.expirationDate = { gte: now, lte: in7 };
  } else if (urgency === "30") {
    where.expirationDate = { gte: now, lte: in30 };
  } else if (urgency === "60") {
    where.expirationDate = { gte: now, lte: in60 };
  } else if (urgency === "90") {
    where.expirationDate = { gte: now, lte: in90 };
  }

  // Parallel: summary counts + filtered data + total count
  const [expired, expIn7, expIn30, expIn60, expIn90, total, expirables] = await Promise.all([
    db.expirable.count({ where: { expirationDate: { lt: now }, status: { not: "RENEWED" } } }),
    db.expirable.count({ where: { expirationDate: { gte: now, lte: in7 }, status: { not: "RENEWED" } } }),
    db.expirable.count({ where: { expirationDate: { gte: in7, lte: in30 }, status: { not: "RENEWED" } } }),
    db.expirable.count({ where: { expirationDate: { gte: in30, lte: in60 }, status: { not: "RENEWED" } } }),
    db.expirable.count({ where: { expirationDate: { gte: in60, lte: in90 }, status: { not: "RENEWED" } } }),
    db.expirable.count({ where }),
    db.expirable.findMany({
      where,
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true, providerType: true },
        },
      },
      orderBy: { expirationDate: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const summaryCards = [
    { label: "Expired", count: expired, urgencyParam: "expired", borderClass: "border-red-400", bgClass: "bg-red-50", textClass: "text-red-700", countClass: "text-red-900" },
    { label: "≤ 7 Days", count: expIn7, urgencyParam: "7", borderClass: "border-orange-400", bgClass: "bg-orange-50", textClass: "text-orange-700", countClass: "text-orange-900" },
    { label: "≤ 30 Days", count: expIn30, urgencyParam: "30", borderClass: "border-yellow-400", bgClass: "bg-yellow-50", textClass: "text-yellow-700", countClass: "text-yellow-900" },
    { label: "≤ 60 Days", count: expIn60, urgencyParam: "60", borderClass: "border-blue-400", bgClass: "bg-blue-50", textClass: "text-blue-700", countClass: "text-blue-900" },
    { label: "≤ 90 Days", count: expIn90, urgencyParam: "90", borderClass: "border-green-400", bgClass: "bg-green-50", textClass: "text-green-700", countClass: "text-green-900" },
  ];

  function buildUrl(overrides: Record<string, string>): string {
    const p = new URLSearchParams();
    const merged = { q, expirableType, status, urgency, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && v !== "1" || k === "page" && v !== "1") {
        if (v) p.set(k, v);
      }
    }
    if (p.get("page") === "1") p.delete("page");
    const qs = p.toString();
    return qs ? `/expirables?${qs}` : "/expirables";
  }

  const hasFilters = q || expirableType || status || urgency;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expirables Tracking</h1>
        <p className="text-gray-500 mt-1">
          Monitor credential expirations across all providers — {total} result{total !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Summary Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {summaryCards.map((card) => (
          <Link
            key={card.urgencyParam}
            href={buildUrl({ urgency: urgency === card.urgencyParam ? "" : card.urgencyParam, page: "1" })}
            className={[
              "rounded-lg border-l-4 p-4 transition-shadow hover:shadow-md",
              card.borderClass,
              card.bgClass,
              urgency === card.urgencyParam ? "ring-2 ring-offset-1 ring-gray-400" : "",
            ].join(" ")}
          >
            <div className={`text-sm font-medium ${card.textClass}`}>{card.label}</div>
            <div className={`text-3xl font-bold mt-1 ${card.countClass}`}>{card.count}</div>
          </Link>
        ))}
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
          <label htmlFor="expirableType" className="block text-xs font-medium text-gray-500 mb-1">Type</label>
          <select
            id="expirableType"
            name="expirableType"
            defaultValue={expirableType}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {EXPIRABLE_TYPES.map((t) => (
              <option key={t} value={t}>{formatExpirableType(t)}</option>
            ))}
          </select>
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
              <option key={s} value={s}>{formatExpirableType(s)}</option>
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
            href="/expirables"
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
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Credential Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Expires</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Days Left</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Verified</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Outreach Sent</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expirables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No expirables found matching your filters.
                  </td>
                </tr>
              ) : (
                expirables.map((e) => {
                  const daysLeft = Math.floor(
                    (e.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
                  );
                  return (
                    <tr key={e.id} className={`hover:bg-gray-50 ${rowBgClass(daysLeft)}`}>
                      <td className="px-3 py-1.5">
                        <Link
                          href={`/providers/${e.provider.id}`}
                          className="text-blue-600 hover:underline font-medium text-sm"
                        >
                          {e.provider.legalFirstName} {e.provider.legalLastName}
                        </Link>
                        <div className="text-[11px] text-gray-400 leading-tight">{e.provider.providerType.abbreviation}</div>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-700">{formatExpirableType(e.expirableType)}</td>
                      <td className="px-3 py-1.5">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadgeClasses(e.status)}`}
                        >
                          {formatExpirableType(e.status)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-700">
                        {e.expirationDate.toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-3 py-1.5">
                        {daysLeft < 0 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-800">
                            {Math.abs(daysLeft)}d overdue
                          </span>
                        ) : daysLeft <= 7 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">
                            {daysLeft}d
                          </span>
                        ) : daysLeft <= 30 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-orange-100 text-orange-700">
                            {daysLeft}d
                          </span>
                        ) : daysLeft <= 60 ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">
                            {daysLeft}d
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600">
                            {daysLeft}d
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {e.lastVerifiedDate
                          ? e.lastVerifiedDate.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {e.outreachSentAt
                          ? e.outreachSentAt.toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        <ExpirableRowActions
                          expirableId={e.id}
                          providerName={`${e.provider.legalFirstName} ${e.provider.legalLastName}`}
                          credentialType={formatExpirableType(e.expirableType)}
                          providerId={e.provider.id}
                        />
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
