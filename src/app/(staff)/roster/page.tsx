import { db } from "@/server/db";
import Link from "next/link";

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const rosterStatusColors: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  GENERATED: "bg-blue-100 text-blue-700",
  VALIDATED: "bg-indigo-100 text-indigo-700",
  SUBMITTED: "bg-green-100 text-green-700",
  ACKNOWLEDGED: "bg-green-100 text-green-800",
  ERROR: "bg-red-100 text-red-700",
};

const rosterStatusLabels: Record<string, string> = {
  DRAFT: "Draft",
  GENERATED: "Generated",
  VALIDATED: "Validated",
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  ERROR: "Error",
};

export default async function RosterPage() {
  const rosters = await db.payerRoster.findMany({
    include: {
      submissions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { payerName: "asc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roster Management</h1>
          <p className="text-gray-500 mt-1">
            Manage payer roster generation, validation, and submission — {rosters.length} payer{rosters.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Payer</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Format</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Submission Method</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Generated</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Submitted</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Latest Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider Count</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rosters.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-3 py-6 text-center text-gray-500">
                    No payer rosters configured.
                  </td>
                </tr>
              ) : (
                rosters.map((r) => {
                  const latest = r.submissions[0];
                  return (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-sm font-medium text-gray-900">{r.payerName}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500 uppercase">{r.rosterFormat}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{r.submissionMethod ?? "—"}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(r.lastGeneratedAt)}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(r.lastSubmittedAt)}</td>
                      <td className="px-3 py-1.5">
                        {latest ? (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${rosterStatusColors[latest.status] ?? "bg-gray-100 text-gray-600"}`}>
                            {rosterStatusLabels[latest.status] ?? latest.status}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">No submissions</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">
                        {latest?.providerCount ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 flex gap-2">
                        <Link href={`/roster/${r.id}`} className="text-sm text-blue-600 hover:underline">
                          View
                        </Link>
                        <Link href={`/roster/${r.id}/generate`} className="text-sm text-blue-600 hover:underline">
                          Generate
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
    </div>
  );
}
