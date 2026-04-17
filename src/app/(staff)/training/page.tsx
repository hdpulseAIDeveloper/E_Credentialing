/**
 * Staff "My Training" page — P2 Gap #18.
 *
 * Shows the current user every required NCQA / HIPAA / non-discrimination /
 * AI-governance course, with status, due date, and a one-click "mark
 * complete" path that creates a StaffTrainingRecord.
 */

import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { db } from "@/server/db";
import { syncAssignmentsForUser } from "@/lib/training";
import { TrainingRow } from "./TrainingRow";

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  COMPLETED: "bg-green-100 text-green-700",
  OVERDUE: "bg-red-100 text-red-700",
  WAIVED: "bg-gray-100 text-gray-600",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function MyTrainingPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, role: true, isActive: true, displayName: true },
  });
  if (user) {
    await syncAssignmentsForUser(db, user);
  }

  const assignments = await db.trainingAssignment.findMany({
    where: { userId: session.user.id },
    include: { course: true },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }],
  });

  const now = Date.now();
  const overdueCount = assignments.filter(
    (a) =>
      a.status === "OVERDUE" ||
      (a.status !== "COMPLETED" && a.dueDate && a.dueDate.getTime() < now)
  ).length;
  const completedCount = assignments.filter(
    (a) => a.status === "COMPLETED"
  ).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">My Training</h1>
        <p className="text-sm text-gray-600 mt-1">
          NCQA-required staff training. Completing each course on time keeps
          us audit-ready and protects PHI.
        </p>
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Assigned" value={assignments.length} color="text-blue-700" />
        <Stat label="Completed" value={completedCount} color="text-green-700" />
        <Stat label="Overdue" value={overdueCount} color="text-red-700" />
      </div>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Assigned courses
          </h2>
        </header>
        {assignments.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            You have no assigned courses. (You may not currently hold a role
            that requires NCQA training.)
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Course</th>
                <th className="px-4 py-2 text-left">Category</th>
                <th className="px-4 py-2 text-left">Due</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {assignments.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2">
                    <div className="font-medium text-gray-900">
                      {a.course.title}
                    </div>
                    {a.course.description && (
                      <div className="text-xs text-gray-500 mt-0.5">
                        {a.course.description}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700 capitalize">
                    {a.course.category.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{fmt(a.dueDate)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[a.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <TrainingRow
                      assignmentId={a.id}
                      contentUrl={a.course.contentUrl}
                      status={a.status}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
