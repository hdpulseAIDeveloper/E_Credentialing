import { db } from "@/server/db";

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function ApiKeysPage() {
  const apiKeys = await db.apiKey.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
          <p className="text-gray-500 mt-1">
            Manage API keys for external integrations — {apiKeys.length} key{apiKeys.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Created</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Last Used</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {apiKeys.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-gray-500">
                    No API keys created yet.
                  </td>
                </tr>
              ) : (
                apiKeys.map((key) => {
                  const isExpired = key.expiresAt && key.expiresAt < new Date();
                  return (
                    <tr key={key.id} className="hover:bg-gray-50">
                      <td className="px-3 py-1.5 text-sm font-medium text-gray-900">{key.name}</td>
                      <td className="px-3 py-1.5">
                        {key.isActive && !isExpired ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">Active</span>
                        ) : isExpired ? (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-yellow-100 text-yellow-700">Expired</span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Revoked</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(key.createdAt)}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(key.lastUsedAt)}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-500">{fmt(key.expiresAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
