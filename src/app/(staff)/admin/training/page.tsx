/**
 * Admin: training course catalog + org-wide compliance — P2 Gap #18.
 *
 * Lets admins manage the catalog of NCQA-required courses, see which
 * roles each course is required for, and view org-wide completion rate.
 */

import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getOrgComplianceSummary } from "@/lib/training";
import { CourseTable } from "./CourseTable";
import { ResyncAllButton } from "./ResyncAllButton";

export default async function AdminTrainingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [courses, summary] = await Promise.all([
    db.trainingCourse.findMany({
      orderBy: [{ category: "asc" }, { title: "asc" }],
      include: { _count: { select: { assignments: true, records: true } } },
    }),
    getOrgComplianceSummary(db),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          Staff Training Catalog
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          NCQA CR-1 / CR-12 staff training compliance — manage required
          courses and review organization-wide completion.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <Stat label="Total assignments" value={summary.totalAssignments} color="text-blue-700" />
        <Stat label="Completed" value={summary.completed} color="text-green-700" />
        <Stat label="Overdue" value={summary.overdue} color="text-red-700" />
        <Stat
          label="Compliance"
          value={`${summary.compliancePercent}%`}
          color={summary.compliancePercent >= 95 ? "text-green-700" : summary.compliancePercent >= 80 ? "text-amber-700" : "text-red-700"}
        />
      </section>

      <div className="flex justify-end">
        <ResyncAllButton />
      </div>

      <CourseTable courses={courses} />
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
