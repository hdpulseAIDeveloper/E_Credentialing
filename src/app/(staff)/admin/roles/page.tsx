import { Fragment } from "react";
import { Shield, Check, X, Minus } from "lucide-react";

const ROLES = [
  { key: "ADMIN", label: "Admin", description: "Full system access. Can manage users, settings, and all platform features." },
  { key: "MANAGER", label: "Manager", description: "Can manage providers, enrollments, committee sessions, and view admin dashboard. Cannot manage system settings or users." },
  { key: "COMMITTEE_MEMBER", label: "Committee Member", description: "Can participate in committee sessions and vote on provider decisions. Read-only access to provider data." },
  { key: "SPECIALIST", label: "Specialist", description: "Day-to-day credentialing work. Can manage assigned providers, enrollments, and expirables." },
  { key: "PROVIDER", label: "Provider (External)", description: "External provider filling out their own application. No access to staff features." },
];

const PERMISSIONS = [
  { category: "Providers", items: [
    { label: "View providers", roles: ["ADMIN", "MANAGER", "COMMITTEE_MEMBER", "SPECIALIST"] },
    { label: "Create providers", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Edit providers", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Deactivate providers", roles: ["ADMIN", "MANAGER"] },
  ]},
  { category: "Enrollments", items: [
    { label: "View enrollments", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Create enrollments", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Edit enrollments", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Withdraw enrollments", roles: ["ADMIN", "MANAGER"] },
  ]},
  { category: "Committee", items: [
    { label: "View sessions", roles: ["ADMIN", "MANAGER", "COMMITTEE_MEMBER"] },
    { label: "Create sessions", roles: ["ADMIN", "MANAGER"] },
    { label: "Vote on providers", roles: ["ADMIN", "MANAGER", "COMMITTEE_MEMBER"] },
    { label: "Manage sessions", roles: ["ADMIN", "MANAGER"] },
  ]},
  { category: "Expirables", items: [
    { label: "View expirables", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Edit expirables", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Delete expirables", roles: ["ADMIN", "MANAGER"] },
  ]},
  { category: "Bots & Verification", items: [
    { label: "View bot runs", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Trigger bot runs", roles: ["ADMIN", "MANAGER", "SPECIALIST"] },
    { label: "Configure bots", roles: ["ADMIN"] },
  ]},
  { category: "Administration", items: [
    { label: "View admin dashboard", roles: ["ADMIN", "MANAGER"] },
    { label: "Manage users", roles: ["ADMIN"] },
    { label: "Manage settings", roles: ["ADMIN"] },
    { label: "View audit logs", roles: ["ADMIN", "MANAGER"] },
    { label: "Manage provider types", roles: ["ADMIN"] },
  ]},
];

const ROLE_KEYS = ["ADMIN", "MANAGER", "COMMITTEE_MEMBER", "SPECIALIST", "PROVIDER"];

export default function AdminRolesPage() {
  return (
    <div className="space-y-8">
      {/* Role Descriptions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ROLES.map((role) => (
          <div key={role.key} className="bg-white rounded-lg border p-5">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="h-4 w-4 text-blue-600" />
              <h3 className="font-semibold text-gray-900">{role.label}</h3>
            </div>
            <p className="text-sm text-gray-600">{role.description}</p>
          </div>
        ))}
      </div>

      {/* Permissions Matrix */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            Permissions Matrix
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase tracking-wide min-w-48">Permission</th>
                {ROLE_KEYS.map((role) => (
                  <th key={role} className="text-center p-3 text-xs font-medium text-gray-500 uppercase tracking-wide w-28">
                    {role.replace("_", " ")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSIONS.map((group) => (
                <Fragment key={group.category}>
                  <tr className="bg-gray-50/50">
                    <td colSpan={ROLE_KEYS.length + 1} className="px-3 py-2 text-xs font-bold text-gray-700 uppercase tracking-wider">
                      {group.category}
                    </td>
                  </tr>
                  {group.items.map((perm) => (
                    <tr key={perm.label} className="hover:bg-gray-50 border-t border-gray-100">
                      <td className="p-3 text-sm text-gray-700">{perm.label}</td>
                      {ROLE_KEYS.map((role) => (
                        <td key={role} className="p-3 text-center">
                          {perm.roles.includes(role) ? (
                            <Check className="h-4 w-4 text-green-600 mx-auto" />
                          ) : role === "PROVIDER" ? (
                            <Minus className="h-4 w-4 text-gray-300 mx-auto" />
                          ) : (
                            <X className="h-4 w-4 text-red-400 mx-auto" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
