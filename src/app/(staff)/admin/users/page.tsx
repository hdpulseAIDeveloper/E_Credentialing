import { api } from "@/trpc/server";
import { AdminUserRowActions, InviteUserButton } from "@/components/admin/AdminUserActions";
import { UserSearch } from "@/components/admin/UserSearch";
import { format } from "date-fns";
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

interface Props {
  searchParams: Promise<{ search?: string; role?: string; status?: string; page?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10) || 1);
  const pageSize = 25;

  const { users, total } = await api.admin.listUsers({
    search: params.search || undefined,
    role: params.role || undefined,
    isActive: params.status === "active" ? true : params.status === "inactive" ? false : undefined,
    page: currentPage,
    limit: pageSize,
  });

  const totalPages = Math.ceil(total / pageSize);
  const hasFilters = params.search || params.role || params.status;

  function buildPageUrl(page: number) {
    const p = new URLSearchParams();
    if (params.search) p.set("search", params.search);
    if (params.role) p.set("role", params.role);
    if (params.status) p.set("status", params.status);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Staff Users</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {total} user{total !== 1 ? "s" : ""} total
            {hasFilters ? `, ${users.length} matching filters` : ""}
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
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Login</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                    {hasFilters
                      ? "No users match your filters."
                      : "No users found. Click \"+ Invite User\" to create one."}
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 group">
                    <td className="px-3 py-2">
                      <Link href={`/admin/users/${user.id}`} className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline">
                        {user.displayName}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">{user.email}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[user.role] ?? "bg-gray-100 text-gray-600"}`}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {user.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {format(new Date(user.createdAt), "MMM d, yyyy")}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {user.lastLoginAt ? format(new Date(user.lastLoginAt), "MMM d, yyyy") : "Never"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-xs text-gray-500 hover:text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                        <AdminUserRowActions user={{ id: user.id, displayName: user.displayName, email: user.email, role: user.role, isActive: user.isActive }} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-sm text-gray-500">
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            {currentPage > 1 && (
              <Link
                href={buildPageUrl(currentPage - 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Previous
              </Link>
            )}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .map((p, idx, arr) => (
                <span key={p}>
                  {idx > 0 && arr[idx - 1] !== p - 1 && (
                    <span className="px-1 text-gray-400">…</span>
                  )}
                  <Link
                    href={buildPageUrl(p)}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      p === currentPage
                        ? "bg-blue-600 text-white"
                        : "border border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {p}
                  </Link>
                </span>
              ))}
            {currentPage < totalPages && (
              <Link
                href={buildPageUrl(currentPage + 1)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
