import { api } from "@/trpc/server";
import { AdminUserRowActions, InviteUserButton } from "@/components/admin/AdminUserActions";
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

export default async function AdminUsersPage() {
  const { users } = await api.admin.listUsers({});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff Users</h1>
          <p className="text-gray-500 mt-1">{users.length} user{users.length !== 1 ? "s" : ""}</p>
        </div>
        <InviteUserButton />
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Role</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-gray-500">No users found.</td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium text-gray-900">{user.displayName}</td>
                    <td className="p-3 text-sm text-gray-500">{user.email}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="p-3">
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
