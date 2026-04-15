import { db } from "@/server/db";
import Link from "next/link";

export default async function EnrollmentsPage() {
  const enrollments = await db.enrollment.findMany({
    include: {
      provider: { select: { id: true, legalFirstName: true, legalLastName: true, providerType: true } },
      assignedTo: { select: { id: true, displayName: true } },
      followUps: { orderBy: { followUpDate: "desc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const stats = {
    draft: enrollments.filter((e) => e.status === "DRAFT").length,
    submitted: enrollments.filter((e) => e.status === "SUBMITTED").length,
    pendingPayer: enrollments.filter((e) => e.status === "PENDING_PAYER").length,
    enrolled: enrollments.filter((e) => e.status === "ENROLLED").length,
    overdueFollowUp: enrollments.filter(
      (e) => e.followUpDueDate && e.followUpDueDate < new Date() && e.status !== "ENROLLED"
    ).length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Enrollments</h1>
        <p className="text-gray-500 mt-1">Track payer enrollment submissions and status</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Draft", value: stats.draft, color: "gray" },
          { label: "Submitted", value: stats.submitted, color: "blue" },
          { label: "Pending Payer", value: stats.pendingPayer, color: "yellow" },
          { label: "Enrolled", value: stats.enrolled, color: "green" },
          { label: "Overdue Follow-Up", value: stats.overdueFollowUp, color: "red" },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border p-4">
            <div className={`text-2xl font-bold text-${s.color}-600`}>{s.value}</div>
            <div className="text-sm text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Enrollments Table */}
      <div className="bg-white rounded-lg border">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Provider</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Payer</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Type</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Follow-Up Due</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {enrollments.map((e) => {
                const isOverdue = e.followUpDueDate && e.followUpDueDate < new Date() && e.status !== "ENROLLED";
                return (
                  <tr key={e.id} className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : ""}`}>
                    <td className="p-3">
                      <Link href={`/providers/${e.provider.id}`} className="text-blue-600 hover:underline font-medium">
                        {e.provider.legalFirstName} {e.provider.legalLastName}
                      </Link>
                      <div className="text-xs text-gray-400">{e.provider.providerType.abbreviation}</div>
                    </td>
                    <td className="p-3 text-sm">
                      <Link href={`/enrollments/${e.id}`} className="text-gray-900 hover:text-blue-600 hover:underline">
                        {e.payerName}
                      </Link>
                    </td>
                    <td className="p-3 text-sm text-gray-500">{e.enrollmentType}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        e.status === "ENROLLED" ? "bg-green-100 text-green-700" :
                        e.status === "DENIED" ? "bg-red-100 text-red-700" :
                        e.status === "PENDING_PAYER" ? "bg-yellow-100 text-yellow-700" :
                        "bg-gray-100 text-gray-600"
                      }`}>{e.status}</span>
                    </td>
                    <td className={`p-3 text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                      {e.followUpDueDate ? e.followUpDueDate.toLocaleDateString() : "—"}
                      {isOverdue && " (OVERDUE)"}
                    </td>
                    <td className="p-3 text-sm text-gray-500">{e.assignedTo?.displayName ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
