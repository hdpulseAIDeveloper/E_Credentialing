import { db } from "@/server/db";
import Link from "next/link";
import { ProviderStatusBadge } from "@/components/providers/ProviderStatusBadge";
import { AddProviderModal } from "@/components/providers/AddProviderModal";
import { ProviderRowActions } from "@/components/providers/ProviderRowActions";

interface SearchParams {
  status?: string;
  q?: string;
}

export default async function ProvidersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { status, q } = await searchParams;

  const [providers, providerTypes, staffUsers] = await Promise.all([
    db.provider.findMany({
      where: {
        ...(status ? { status: status as never } : {}),
        ...(q
          ? {
              OR: [
                { legalFirstName: { contains: q, mode: "insensitive" } },
                { legalLastName: { contains: q, mode: "insensitive" } },
                { npi: { contains: q } },
              ],
            }
          : {}),
      },
      include: {
        providerType: true,
        assignedSpecialist: { select: { id: true, displayName: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.providerType.findMany({
      where: { isActive: true },
      select: { id: true, name: true, abbreviation: true },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({
      where: { isActive: true, role: { in: ["SPECIALIST", "MANAGER", "ADMIN"] } },
      select: { id: true, displayName: true },
      orderBy: { displayName: "asc" },
    }),
  ]);

  const allStatuses = [
    "INVITED",
    "ONBOARDING_IN_PROGRESS",
    "DOCUMENTS_PENDING",
    "VERIFICATION_IN_PROGRESS",
    "COMMITTEE_READY",
    "COMMITTEE_IN_REVIEW",
    "APPROVED",
    "DENIED",
    "DEFERRED",
    "INACTIVE",
  ];

  const statusLabels: Record<string, string> = {
    INVITED: "Invited",
    ONBOARDING_IN_PROGRESS: "Onboarding",
    DOCUMENTS_PENDING: "Docs Pending",
    VERIFICATION_IN_PROGRESS: "Verifying",
    COMMITTEE_READY: "Committee Ready",
    COMMITTEE_IN_REVIEW: "In Review",
    APPROVED: "Approved",
    DENIED: "Denied",
    DEFERRED: "Deferred",
    INACTIVE: "Inactive",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Providers</h1>
          <p className="text-gray-500 mt-1">All providers — {providers.length} result{providers.length !== 1 ? "s" : ""}</p>
        </div>
        <AddProviderModal providerTypes={providerTypes} staffUsers={staffUsers} />
      </div>

      {/* Filters */}
      <form method="get" className="flex gap-3 flex-wrap">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or NPI…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Statuses</option>
          {allStatuses.map((s) => (
            <option key={s} value={s}>
              {statusLabels[s] ?? s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Filter
        </button>
        {(status ?? q) && (
          <Link
            href="/providers"
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
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">NPI</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Specialist</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {providers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    No providers found.
                  </td>
                </tr>
              ) : (
                providers.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5">
                      <Link href={`/providers/${p.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                        {p.legalFirstName} {p.legalLastName}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-sm text-gray-600">{p.providerType.name}</td>
                    <td className="px-3 py-1.5 text-sm font-mono text-gray-500">{p.npi ?? "—"}</td>
                    <td className="px-3 py-1.5">
                      <ProviderStatusBadge status={p.status} />
                    </td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">
                      {p.assignedSpecialist?.displayName ?? "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <ProviderRowActions
                        providerId={p.id}
                        providerName={`${p.legalFirstName} ${p.legalLastName}`}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
