import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { api } from "@/trpc/server";
import Link from "next/link";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  IN_PROCESS: "bg-blue-100 text-blue-700",
  ENROLLED: "bg-green-100 text-green-700",
  REVALIDATION_DUE: "bg-orange-100 text-orange-700",
  EXPIRED: "bg-red-100 text-red-700",
};

const PATH_LABELS: Record<string, string> = {
  NEW_PSP: "New (PSP)",
  REINSTATEMENT: "Reinstatement",
  AFFILIATION_UPDATE: "Affiliation Update",
};

export default async function MedicaidPage() {
  const session = await auth();
  if (!session) redirect("/auth/signin");

  let data;
  let summary;
  try {
    [data, summary] = await Promise.all([
      api.medicaid.list({ page: 1, limit: 50 }),
      api.medicaid.getSummary(),
    ]);
  } catch {
    data = { items: [], total: 0 };
    summary = { total: 0, byStatus: {}, byPath: {} };
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NY Medicaid / ETIN</h1>
          <p className="text-gray-500 mt-1">Manage NY Medicaid enrollments, ETIN affiliations, and revalidations</p>
        </div>
        <Link
          href="/medicaid/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          + New Enrollment
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-5 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">{summary.total}</div>
          <div className="text-sm text-gray-500">Total</div>
        </div>
        {Object.entries(summary.byStatus).map(([status, count]) => (
          <div key={status} className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-gray-900">{count as number}</div>
            <div className="text-sm text-gray-500">{status.replace(/_/g, " ")}</div>
          </div>
        ))}
      </div>

      {/* Enrollments Table */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="px-4 py-3 text-left font-medium text-gray-500">Provider</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Path</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">ETIN</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Submitted</th>
                <th className="px-4 py-3 text-left font-medium text-gray-500">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {data.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    No NY Medicaid enrollments yet. Click &quot;+ New Enrollment&quot; to create one.
                  </td>
                </tr>
              ) : (
                data.items.map((item: any) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <Link href={`/medicaid/${item.id}`} className="font-medium text-blue-600 hover:underline">
                        {item.provider.legalFirstName} {item.provider.legalLastName}
                      </Link>
                      <div className="text-xs text-gray-400">{item.provider.providerType?.name} &middot; NPI: {item.provider.npi ?? "N/A"}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium px-2 py-1 rounded bg-gray-100 text-gray-700">
                        {PATH_LABELS[item.enrollmentPath] ?? item.enrollmentPath ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{item.etinNumber ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[item.affiliationStatus] ?? "bg-gray-100 text-gray-700"}`}>
                        {item.affiliationStatus.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {item.submissionDate ? new Date(item.submissionDate).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(item.updatedAt).toLocaleDateString()}
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
