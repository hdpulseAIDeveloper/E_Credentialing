import { api } from "@/trpc/server";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { UserDetailActions } from "@/components/admin/UserDetailActions";
import Link from "next/link";

const ROLE_LABELS: Record<string, string> = {
  SPECIALIST: "Specialist",
  MANAGER: "Manager",
  COMMITTEE_MEMBER: "Committee Member",
  ADMIN: "Admin",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  MANAGER: "bg-purple-100 text-purple-700",
  COMMITTEE_MEMBER: "bg-blue-100 text-blue-700",
  SPECIALIST: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  INVITED: "bg-blue-100 text-blue-700",
  ONBOARDING_IN_PROGRESS: "bg-yellow-100 text-yellow-700",
  DOCUMENTS_PENDING: "bg-orange-100 text-orange-700",
  VERIFICATION_IN_PROGRESS: "bg-purple-100 text-purple-700",
  COMMITTEE_READY: "bg-indigo-100 text-indigo-700",
  COMMITTEE_IN_REVIEW: "bg-indigo-100 text-indigo-700",
  APPROVED: "bg-green-100 text-green-700",
  DENIED: "bg-red-100 text-red-700",
  DEFERRED: "bg-yellow-100 text-yellow-700",
  INACTIVE: "bg-gray-100 text-gray-500",
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
};

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

export default async function UserDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab = tabParam ?? "overview";

  let user;
  try {
    user = await api.admin.getUser({ id });
  } catch {
    notFound();
  }

  const completedTaskCount = user.completedTasks.length;
  const openTaskCount = user.assignedTasks.length;

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/users" className="hover:text-blue-600 transition-colors">Users</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{user.displayName}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-blue-600 flex items-center justify-center">
              <span className="text-lg font-bold text-white">
                {user.displayName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
              {user.isActive ? "Active" : "Inactive"}
            </span>
            {user.azureAdOid && (
              <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-blue-50 text-blue-600">
                Azure AD Linked
              </span>
            )}
          </div>
        </div>
        <UserDetailActions
          user={{
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            isActive: user.isActive,
          }}
        />
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-6 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "providers", label: `Assigned Providers (${user.assignedProviders.length})` },
            { id: "tasks", label: `Tasks (${openTaskCount})` },
            { id: "enrollments", label: `Enrollments (${user.enrollmentAssignments.length})` },
            { id: "activity", label: "Activity Log" },
          ].map((t) => (
            <a
              key={t.id}
              href={`?tab=${t.id}`}
              className={`py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div>
        {tab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Info Card */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">User Information</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Email</dt>
                  <dd className="text-sm font-medium">{user.email}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Role</dt>
                  <dd>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                      {ROLE_LABELS[user.role] ?? user.role}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Status</dt>
                  <dd>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                      {user.isActive ? "Active" : "Inactive"}
                    </span>
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Azure AD</dt>
                  <dd className="text-sm font-medium">{user.azureAdOid ? "Linked" : "Not linked"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">User ID</dt>
                  <dd className="text-xs font-mono text-gray-400">{user.id}</dd>
                </div>
              </dl>
            </div>

            {/* Dates Card */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Account Timeline</h3>
              <dl className="space-y-3">
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Created</dt>
                  <dd className="text-sm font-medium">{format(new Date(user.createdAt), "MMM d, yyyy 'at' h:mm a")}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last Login</dt>
                  <dd className="text-sm font-medium">
                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy 'at' h:mm a") : "Never"}
                  </dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-sm text-gray-500">Last Updated</dt>
                  <dd className="text-sm font-medium">{format(new Date(user.updatedAt), "MMM d, yyyy 'at' h:mm a")}</dd>
                </div>
              </dl>
            </div>

            {/* Summary Stats Card */}
            <div className="bg-white rounded-lg border p-6 space-y-4">
              <h3 className="font-semibold text-gray-900">Workload Summary</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-blue-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-700">{user.assignedProviders.length}</div>
                  <div className="text-xs text-blue-600">Assigned Providers</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-yellow-700">{openTaskCount}</div>
                  <div className="text-xs text-yellow-600">Open Tasks</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-700">{completedTaskCount}</div>
                  <div className="text-xs text-green-600">Completed Tasks</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-purple-700">{user.enrollmentAssignments.length}</div>
                  <div className="text-xs text-purple-600">Enrollments</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "providers" && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Assigned Providers</h3>
              <p className="text-sm text-gray-500 mt-0.5">Providers this user is responsible for credentialing</p>
            </div>
            {user.assignedProviders.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No providers currently assigned to this user.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Provider Name</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">NPI</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {user.assignedProviders.map((p: any) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/providers/${p.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {p.legalFirstName} {p.legalLastName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-sm text-gray-500">{p.npi ?? "—"}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {p.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "tasks" && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg border overflow-hidden">
              <div className="p-4 border-b">
                <h3 className="font-semibold text-gray-900">Open Tasks ({openTaskCount})</h3>
                <p className="text-sm text-gray-500 mt-0.5">Active tasks assigned to this user</p>
              </div>
              {user.assignedTasks.length === 0 ? (
                <div className="p-8 text-center text-gray-500">No open tasks assigned.</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Task</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Priority</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Due Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {user.assignedTasks.map((t: any) => {
                      const isOverdue = t.dueDate && new Date(t.dueDate) < new Date();
                      return (
                        <tr key={t.id} className={`hover:bg-gray-50 ${isOverdue ? "bg-red-50" : ""}`}>
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900">{t.title}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLORS[t.priority] ?? "bg-gray-100 text-gray-600"}`}>
                              {t.priority}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-sm text-gray-500">{t.status.replace(/_/g, " ")}</td>
                          <td className={`px-4 py-2.5 text-sm ${isOverdue ? "text-red-600 font-medium" : "text-gray-500"}`}>
                            {t.dueDate ? format(new Date(t.dueDate), "MMM d, yyyy") : "—"}
                            {isOverdue && " (Overdue)"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <p className="text-sm text-gray-400">{completedTaskCount} task{completedTaskCount !== 1 ? "s" : ""} completed all-time</p>
          </div>
        )}

        {tab === "enrollments" && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Assigned Enrollments</h3>
              <p className="text-sm text-gray-500 mt-0.5">Enrollment records assigned to this user for follow-up</p>
            </div>
            {user.enrollmentAssignments.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No enrollments assigned.</div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Payer</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {user.enrollmentAssignments.map((e: any) => (
                    <tr key={e.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5">
                        <Link href={`/enrollments/${e.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                          {e.payerName}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          e.status === "ENROLLED" ? "bg-green-100 text-green-700" :
                          e.status === "DENIED" ? "bg-red-100 text-red-700" :
                          "bg-yellow-100 text-yellow-700"
                        }`}>
                          {e.status.replace(/_/g, " ")}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "activity" && (
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
              <p className="text-sm text-gray-500 mt-0.5">Last 25 actions performed by this user</p>
            </div>
            {user.auditLogsAsActor.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No activity recorded yet.</div>
            ) : (
              <div className="divide-y">
                {user.auditLogsAsActor.map((log: any) => (
                  <div key={log.id} className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        {log.action.replace(/\./g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                      </span>
                      <span className="text-sm text-gray-500 ml-2">
                        on {log.entityType}
                      </span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {format(new Date(log.createdAt), "MMM d, yyyy 'at' h:mm a")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
