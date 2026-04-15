import { api } from "@/trpc/server";
import { AdminUserRowActions, InviteUserButton } from "@/components/admin/AdminUserActions";
import { UserSearch } from "@/components/admin/UserSearch";
import { format } from "date-fns";

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

interface Props {
  searchParams: Promise<{ search?: string; role?: string; status?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const { users, total } = await api.admin.listUsers({
    search: params.search || undefined,
    role: params.role || undefined,
    isActive: params.status === "active" ? true : params.status === "inactive" ? false : undefined,
    limit: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Staff Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} user{total !== 1 ? "s" : ""} total
            {params.search || params.role || params.status ? `, ${users.length} matching filters` : ""}
          </p>
        </div>
        <InviteUserButton />
      </div>

      <UserSearch currentSearch={params.search} currentRole={params.role} currentStatus={params.status} />

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">
                    {params.search || params.role || params.status
                      ? "No users match your filters."
                      : "No users found. Click \"+ Invite User\" to create one."}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium text-gray-900 text-sm">{user.displayName}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{user.email}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">
                      {user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="px-3 py-1.5">
                      <AdminUserRowActions user={{ id: user.id, displayName: user.displayName, email: user.email, role: user.role, isActive: user.isActive }} />
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
