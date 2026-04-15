import { db } from "@/server/db";
import { formatDistanceToNow } from "date-fns";

export default async function CommitteeDashboardPage() {
  const [queue, activeSessions] = await Promise.all([
    db.provider.findMany({
      where: { status: "COMMITTEE_READY" },
      include: { providerType: true },
      orderBy: { committeeReadyAt: "asc" },
    }),
    db.committeeSession.findMany({
      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      include: {
        providers: {
          include: { provider: { select: { id: true, legalFirstName: true, legalLastName: true } } },
        },
      },
      orderBy: { sessionDate: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Committee Dashboard</h1>
          <p className="text-gray-500 mt-1">Review and schedule credentialing committee sessions</p>
        </div>
        <a
          href="/committee/sessions/new"
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          Create Session
        </a>
      </div>

      {/* Active Sessions */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Active Sessions ({activeSessions.length})</h2>
        </div>
        <div className="divide-y">
          {activeSessions.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No active sessions</div>
          ) : (
            activeSessions.map((s) => (
              <a key={s.id} href={`/committee/sessions/${s.id}`} className="block p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{s.sessionDate.toLocaleDateString()}</div>
                    <div className="text-sm text-gray-500">
                      {s.providers.length} providers · {s.location ?? "Location TBD"}
                    </div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full h-fit ${
                    s.status === "IN_PROGRESS" ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                  }`}>
                    {s.status}
                  </span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>

      {/* Committee Queue */}
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Ready for Committee ({queue.length})</h2>
        </div>
        <div className="divide-y">
          {queue.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No providers waiting for committee review</div>
          ) : (
            queue.map((p) => (
              <div key={p.id} className="p-4 flex items-center justify-between">
                <div>
                  <a href={`/providers/${p.id}`} className="font-medium hover:underline text-blue-600">
                    {p.legalFirstName} {p.legalLastName}
                  </a>
                  <div className="text-sm text-gray-500">{p.providerType.name}</div>
                </div>
                <div className="text-sm text-gray-400">
                  {p.committeeReadyAt
                    ? formatDistanceToNow(p.committeeReadyAt, { addSuffix: true })
                    : "—"}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
