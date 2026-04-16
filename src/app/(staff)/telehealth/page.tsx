import { auth } from "@/server/auth";
import { db } from "@/server/db";
import Link from "next/link";

function formatDate(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function TelehealthPage() {
  const session = await auth();
  if (!session?.user) return null;

  const providers = await db.provider.findMany({
    where: { status: { notIn: ["DENIED", "INACTIVE"] } },
    select: {
      id: true,
      legalFirstName: true,
      legalLastName: true,
      status: true,
      providerType: { select: { abbreviation: true } },
      profile: {
        select: {
          teleHealthPlatform: true,
          teleHealthTrainingDate: true,
          teleHealthCertified: true,
          teleHealthStates: true,
        },
      },
      licenses: {
        select: { state: true, status: true, expirationDate: true },
        where: { status: "ACTIVE" },
      },
    },
    orderBy: { legalLastName: "asc" },
  });

  const telehealthProviders = providers.filter(
    (p) =>
      p.profile?.teleHealthPlatform ||
      p.profile?.teleHealthCertified ||
      (p.profile?.teleHealthStates && p.profile.teleHealthStates.length > 0)
  );

  const totalTelehealth = telehealthProviders.length;
  const certified = telehealthProviders.filter((p) => p.profile?.teleHealthCertified).length;
  const pendingTraining = telehealthProviders.filter(
    (p) => !p.profile?.teleHealthCertified && p.profile?.teleHealthPlatform
  ).length;
  const multiState = telehealthProviders.filter(
    (p) => p.profile?.teleHealthStates && p.profile.teleHealthStates.length > 1
  ).length;

  const statCards = [
    { label: "Total Telehealth Providers", value: totalTelehealth, bg: "bg-blue-50", border: "border-blue-200", text: "text-blue-700" },
    { label: "Certified", value: certified, bg: "bg-green-50", border: "border-green-200", text: "text-green-700" },
    { label: "Pending Training", value: pendingTraining, bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700" },
    { label: "Multi-State Licensed", value: multiState, bg: "bg-violet-50", border: "border-violet-200", text: "text-violet-700" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Telehealth Credentialing</h1>
        <p className="text-gray-500 text-sm mt-0.5">Manage telehealth certifications and multi-state licensing</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`${card.bg} rounded-lg border ${card.border} px-4 py-3`}>
            <div className={`text-2xl font-bold ${card.text}`}>{card.value}</div>
            <div className="text-xs text-gray-600 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Providers Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">Telehealth Providers</h2>
        </div>
        {telehealthProviders.length === 0 ? (
          <div className="px-4 py-12 text-center text-sm text-gray-400">
            No providers with telehealth credentials configured.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Provider</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Platform</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Training Date</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Certified</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Telehealth States</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">License Coverage</th>
                  <th className="text-left px-4 py-2 font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {telehealthProviders.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">
                      <Link href={`/providers/${p.id}`} className="font-medium text-blue-600 hover:underline">
                        {p.legalLastName}, {p.legalFirstName}
                      </Link>
                      <span className="ml-1.5 text-xs text-gray-400">{p.providerType.abbreviation}</span>
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {p.profile?.teleHealthPlatform || "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700">
                      {formatDate(p.profile?.teleHealthTrainingDate ?? null)}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.profile?.teleHealthCertified ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                          Certified
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                          Pending
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {p.profile?.teleHealthStates && p.profile.teleHealthStates.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {p.profile.teleHealthStates.map((state) => {
                            const licensedStates = (p as any).licenses?.map((l: any) => l.state) || [];
                            const hasLicense = licensedStates.includes(state);
                            return (
                              <span
                                key={state}
                                className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                                  hasLicense ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                                }`}
                              >
                                {state}{!hasLicense && " ⚠"}
                              </span>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {(() => {
                        const teleStates = p.profile?.teleHealthStates || [];
                        if (teleStates.length === 0) return <span className="text-gray-400">—</span>;
                        const licensedStates = (p as any).licenses?.map((l: any) => l.state) || [];
                        const uncoveredStates = teleStates.filter((s: string) => !licensedStates.includes(s));
                        if (uncoveredStates.length === 0) {
                          return (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">
                              All covered
                            </span>
                          );
                        }
                        return (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            Missing: {uncoveredStates.join(", ")}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/providers/${p.id}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        View Profile
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
