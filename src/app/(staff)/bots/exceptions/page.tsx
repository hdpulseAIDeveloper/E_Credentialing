/**
 * Staff: Bot Exceptions queue — P3 Gap #20.
 *
 * Lists every orchestrator verdict awaiting human review, plus recent
 * AUTO_EXECUTED / ACCEPTED / OVERRIDDEN ones for traceability.
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

const ACTION_COLORS: Record<string, string> = {
  RETRY_NOW: "bg-blue-100 text-blue-700",
  RETRY_LATER: "bg-amber-100 text-amber-800",
  ESCALATE_TO_STAFF: "bg-red-100 text-red-700",
  MARK_REQUIRES_MANUAL: "bg-purple-100 text-purple-700",
  RAISE_ALERT: "bg-orange-100 text-orange-800",
  DEFER_NO_ACTION: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-800",
  AUTO_EXECUTED: "bg-blue-100 text-blue-700",
  ACCEPTED: "bg-green-100 text-green-700",
  OVERRIDDEN: "bg-red-100 text-red-700",
  RESOLVED: "bg-gray-100 text-gray-600",
};

export default async function BotExceptionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const [pending, recent, counts] = await Promise.all([
    db.botExceptionVerdict.findMany({
      where: { status: { in: ["PENDING_REVIEW"] } },
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true },
        },
        botRun: {
          select: {
            id: true,
            botType: true,
            status: true,
            attemptCount: true,
            errorMessage: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.botExceptionVerdict.findMany({
      where: { status: { in: ["AUTO_EXECUTED", "ACCEPTED", "OVERRIDDEN"] } },
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true },
        },
        botRun: { select: { id: true, botType: true } },
        resolvedBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    Promise.all([
      db.botExceptionVerdict.count({ where: { status: "PENDING_REVIEW" } }),
      db.botExceptionVerdict.count({ where: { status: "AUTO_EXECUTED" } }),
      db.botExceptionVerdict.count({ where: { status: "ACCEPTED" } }),
      db.botExceptionVerdict.count({ where: { status: "OVERRIDDEN" } }),
    ]),
  ]);
  const [cPending, cAuto, cAccepted, cOverridden] = counts;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Bot Exceptions</h1>
        <p className="text-sm text-gray-600 mt-1">
          Autonomous orchestrator verdicts for failed, manual, or flagged PSV
          bot runs. Review the AI&rsquo;s recommendation, accept it, or
          override with your own decision.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <Stat
          label="Pending review"
          value={cPending}
          color={cPending > 0 ? "text-amber-700" : "text-gray-600"}
        />
        <Stat label="Auto-executed" value={cAuto} color="text-blue-700" />
        <Stat label="Accepted" value={cAccepted} color="text-green-700" />
        <Stat label="Overridden" value={cOverridden} color="text-red-700" />
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Pending review ({pending.length})
          </h2>
        </header>
        {pending.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            Nothing waiting — every recent bot exception has been triaged.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Bot</th>
                <th className="px-4 py-2 text-left">Trigger</th>
                <th className="px-4 py-2 text-left">AI recommendation</th>
                <th className="px-4 py-2 text-left">Confidence</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {v.createdAt.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Link
                      href={`/providers/${v.provider.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {v.provider.legalLastName}, {v.provider.legalFirstName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {v.botRun.botType}
                    <div className="text-[10px] text-gray-500">
                      attempt {v.botRun.attemptCount} · {v.botRun.status}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {v.triggerReason}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ACTION_COLORS[v.recommendedAction] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {v.recommendedAction.replace(/_/g, " ")}
                    </span>
                    <p className="text-xs text-gray-600 mt-1 max-w-md">
                      {v.rationale}
                    </p>
                    <p className="text-[10px] text-gray-500 mt-1">
                      source: {v.source}
                      {v.modelUsed ? ` (${v.modelUsed})` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {Math.round(v.confidence * 100)}%
                  </td>
                  <td className="px-4 py-2">
                    <Link
                      href={`/bots/exceptions/${v.id}`}
                      className="text-xs px-2 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700"
                    >
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent triage activity
          </h2>
        </header>
        {recent.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">No history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Bot</th>
                <th className="px-4 py-2 text-left">Action</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Resolved by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recent.map((v) => (
                <tr key={v.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {(v.resolvedAt ?? v.createdAt).toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    <Link
                      href={`/providers/${v.provider.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {v.provider.legalLastName}, {v.provider.legalFirstName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {v.botRun.botType}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        ACTION_COLORS[v.recommendedAction] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {v.recommendedAction.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[v.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {v.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {v.resolvedBy?.displayName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
