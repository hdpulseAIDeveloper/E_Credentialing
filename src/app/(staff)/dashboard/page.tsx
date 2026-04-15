import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { PipelineTable } from "@/components/dashboard/PipelineTable";
import { TaskList } from "@/components/dashboard/TaskList";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const [providers, tasks, stats] = await Promise.all([
    db.provider.findMany({
      where: {
        status: {
          notIn: ["APPROVED", "DENIED", "INACTIVE"],
        },
      },
      include: {
        providerType: true,
        assignedSpecialist: { select: { id: true, displayName: true } },
        checklistItems: { select: { status: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    db.task.findMany({
      where: {
        assignedToId: session.user.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: 10,
    }),
    {
      totalInProgress: await db.provider.count({
        where: { status: { in: ["ONBOARDING_IN_PROGRESS", "DOCUMENTS_PENDING", "VERIFICATION_IN_PROGRESS"] } },
      }),
      committeeReady: await db.provider.count({ where: { status: "COMMITTEE_READY" } }),
      approved: await db.provider.count({ where: { status: "APPROVED" } }),
    },
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Onboarding Dashboard</h1>
        <p className="text-gray-500 mt-1">Provider credentialing pipeline</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.totalInProgress}</div>
          <div className="text-sm text-gray-500 mt-1">In Progress</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-yellow-600">{stats.committeeReady}</div>
          <div className="text-sm text-gray-500 mt-1">Committee Ready</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-green-600">{stats.approved}</div>
          <div className="text-sm text-gray-500 mt-1">Approved (Total)</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2">
          <PipelineTable providers={providers as Parameters<typeof PipelineTable>[0]["providers"]} />
        </div>
        <div>
          <TaskList tasks={tasks as Parameters<typeof TaskList>[0]["tasks"]} />
        </div>
      </div>
    </div>
  );
}
