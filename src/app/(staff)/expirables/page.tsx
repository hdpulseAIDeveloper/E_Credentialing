import { db } from "@/server/db";

export default async function ExpirablesPage() {
  const expirables = await db.expirable.findMany({
    where: { status: { not: "RENEWED" } },
    include: {
      provider: {
        select: { id: true, legalFirstName: true, legalLastName: true, providerType: true },
      },
    },
    orderBy: { expirationDate: "asc" },
    take: 200,
  });

  const now = new Date();

  const colorClass = (daysLeft: number): string => {
    if (daysLeft < 0) return "bg-red-100 text-red-800";
    if (daysLeft <= 7) return "bg-red-100 text-red-700";
    if (daysLeft <= 30) return "bg-orange-100 text-orange-700";
    if (daysLeft <= 60) return "bg-yellow-100 text-yellow-700";
    return "bg-blue-50 text-blue-600";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Expirables Tracking</h1>
        <p className="text-gray-500 mt-1">Monitor credential expirations across all providers</p>
      </div>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Provider</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Credential Type</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Expires</th>
                <th className="text-left p-3 text-sm font-medium text-gray-600">Days Left</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {expirables.map((e) => {
                const daysLeft = Math.floor((e.expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <a href={`/providers/${e.provider.id}`} className="text-blue-600 hover:underline font-medium">
                        {e.provider.legalFirstName} {e.provider.legalLastName}
                      </a>
                      <div className="text-xs text-gray-400">{e.provider.providerType.abbreviation}</div>
                    </td>
                    <td className="p-3 text-sm">{e.expirableType}</td>
                    <td className="p-3">
                      <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600">{e.status}</span>
                    </td>
                    <td className="p-3 text-sm">{e.expirationDate.toLocaleDateString()}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${colorClass(daysLeft)}`}>
                        {daysLeft < 0 ? "EXPIRED" : `${daysLeft} days`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
