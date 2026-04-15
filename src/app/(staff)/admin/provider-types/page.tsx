import { api } from "@/trpc/server";
import { ProviderTypeActions, AddProviderTypeButton } from "@/components/admin/ProviderTypeActions";

export default async function AdminProviderTypesPage() {
  const providerTypes = await api.admin.listProviderTypes();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Provider Types</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            Configure the types of providers your organization credentials
          </p>
        </div>
        <AddProviderTypeButton />
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Code</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Requires DEA</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Requires Boards</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Requires ECFMG</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Board Type</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Req. Docs</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {providerTypes.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-gray-500">
                    No provider types configured. Click &quot;Add Provider Type&quot; to create one.
                  </td>
                </tr>
              ) : (
                providerTypes.map((pt) => (
                  <tr key={pt.id} className="hover:bg-gray-50">
                    <td className="px-3 py-1.5 font-medium text-gray-900 text-sm">{pt.name}</td>
                    <td className="px-3 py-1.5 text-sm font-mono text-gray-600">{pt.abbreviation}</td>
                    <td className="px-3 py-1.5 text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pt.requiresDea ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {pt.requiresDea ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pt.requiresBoards ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {pt.requiresBoards ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-sm">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${pt.requiresEcfmg ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {pt.requiresEcfmg ? "Yes" : "No"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{pt.boardType ?? "—"}</td>
                    <td className="px-3 py-1.5 text-sm text-gray-500">{pt.documentRequirements.length}</td>
                    <td className="px-3 py-1.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pt.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                        {pt.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">
                      <ProviderTypeActions
                        providerType={{
                          id: pt.id,
                          name: pt.name,
                          abbreviation: pt.abbreviation,
                          isActive: pt.isActive,
                          requiresDea: pt.requiresDea,
                          requiresBoards: pt.requiresBoards,
                          requiresEcfmg: pt.requiresEcfmg,
                          boardType: pt.boardType,
                        }}
                      />
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
