/**
 * Admin: AI governance dashboard — P2 Gap #19.
 *
 * Lists all AI model cards, their vendor/contract posture, recent decision
 * logs, and a summary of compliance gaps. NCQA / ONC HTI-1 reviewers can
 * download this to see which AI is in use and how it has been governed.
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { getGovernanceSummary } from "@/lib/ai/governance";

const RISK_COLORS: Record<string, string> = {
  LOW: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-800",
  HIGH: "bg-red-100 text-red-700",
  PROHIBITED: "bg-red-200 text-red-800",
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  PILOT: "bg-blue-100 text-blue-700",
  RETIRED: "bg-gray-100 text-gray-600",
};

const DECISION_COLORS: Record<string, string> = {
  ACCEPTED: "bg-green-100 text-green-700",
  MODIFIED: "bg-amber-100 text-amber-800",
  REJECTED: "bg-red-100 text-red-700",
  PENDING: "bg-blue-100 text-blue-700",
};

function fmt(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AiGovernancePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const [cards, recentDecisions, summary] = await Promise.all([
    db.aiModelCard.findMany({
      include: { _count: { select: { decisions: true } } },
      orderBy: [{ status: "asc" }, { vendor: "asc" }, { name: "asc" }],
    }),
    db.aiDecisionLog.findMany({
      include: {
        modelCard: { select: { name: true } },
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
        humanDecisionBy: { select: { displayName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    getGovernanceSummary(db),
  ]);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">AI Governance</h1>
        <p className="text-sm text-gray-600 mt-1">
          NCQA / ONC HTI-1 — model cards, vendor contract posture, and
          per-decision audit trail for every AI feature in this platform.
        </p>
      </header>

      <section className="grid grid-cols-4 gap-4">
        <Stat label="Active models" value={summary.modelsActive} color="text-blue-700" />
        <Stat
          label="Decisions logged"
          value={summary.totalLogs}
          color="text-indigo-700"
        />
        <Stat
          label="Pending human review"
          value={summary.pending}
          color={summary.pending > 0 ? "text-amber-700" : "text-gray-600"}
        />
        <Stat
          label="Vendors w/o no-train clause"
          value={summary.vendorsWithoutNoTrainingClause}
          color={
            summary.vendorsWithoutNoTrainingClause > 0
              ? "text-red-700"
              : "text-green-700"
          }
        />
      </section>

      {summary.modelsRequiringContractReview > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          <strong>{summary.modelsRequiringContractReview}</strong> model card(s) need a
          contract review (no review date set, or review past due).
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900">
            Model Card Catalog ({cards.length})
          </h2>
        </header>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left">Model</th>
              <th className="px-4 py-2 text-left">Vendor</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Risk</th>
              <th className="px-4 py-2 text-left">No-train clause</th>
              <th className="px-4 py-2 text-left">Last reviewed</th>
              <th className="px-4 py-2 text-right">Logged decisions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {cards.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-2">
                  <Link
                    href={`/admin/ai-governance/${c.id}`}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    {c.name}
                  </Link>
                  <div className="text-xs text-gray-500 mt-0.5">
                    v{c.version} · {c.modality}
                  </div>
                </td>
                <td className="px-4 py-2 text-gray-700">{c.vendor}</td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      RISK_COLORS[c.riskLevel] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {c.riskLevel}
                  </span>
                </td>
                <td className="px-4 py-2 text-xs">
                  {c.noTrainingOnCustomerData ? (
                    <span className="text-green-700 font-medium">Confirmed</span>
                  ) : (
                    <span className="text-red-700 font-medium">Missing</span>
                  )}
                </td>
                <td className="px-4 py-2 text-xs text-gray-700">
                  {fmt(c.lastReviewedAt)}
                </td>
                <td className="px-4 py-2 text-right">{c._count.decisions}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Recent AI decisions (last 25)
          </h2>
        </header>
        {recentDecisions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No AI decisions have been logged yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Feature</th>
                <th className="px-4 py-2 text-left">Model</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Suggested action</th>
                <th className="px-4 py-2 text-left">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {recentDecisions.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2 text-xs text-gray-600">
                    {d.createdAt.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {d.feature}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {d.modelCard?.name ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {d.provider ? (
                      <Link
                        href={`/providers/${d.provider.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {d.provider.legalLastName}, {d.provider.legalFirstName}
                      </Link>
                    ) : (
                      <span className="text-gray-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700 max-w-md truncate">
                    {d.suggestedAction ?? "—"}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        DECISION_COLORS[d.humanDecision] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {d.humanDecision}
                    </span>
                    {d.humanDecisionBy?.displayName && (
                      <div className="text-[10px] text-gray-500 mt-0.5">
                        by {d.humanDecisionBy.displayName}
                      </div>
                    )}
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

function Stat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{value}</div>
    </div>
  );
}
