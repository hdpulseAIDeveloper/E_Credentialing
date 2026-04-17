/**
 * Admin: per-model card detail page — P2 Gap #19.
 *
 * Shows the full model card (purpose, intended use, contract posture,
 * fairness notes), recent decisions made by this model, and an
 * "Attest review" action that admins fire annually.
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { AttestReviewButton } from "./AttestReviewButton";

export default async function ModelCardPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    redirect("/dashboard");
  }

  const card = await db.aiModelCard.findUnique({
    where: { id: params.id },
    include: {
      lastReviewedBy: { select: { displayName: true } },
      decisions: {
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
          humanDecisionBy: { select: { displayName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
      _count: { select: { decisions: true } },
    },
  });
  if (!card) notFound();

  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "—";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <Link
        href="/admin/ai-governance"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to AI Governance
      </Link>

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{card.name}</h1>
          <p className="text-sm text-gray-600 mt-1">
            v{card.version} · {card.modality} · {card.vendor}
          </p>
        </div>
        <AttestReviewButton cardId={card.id} />
      </header>

      <div className="grid grid-cols-3 gap-4">
        <Field label="Status" value={card.status} />
        <Field label="Risk level" value={card.riskLevel} />
        <Field
          label="Human review required"
          value={card.humanReviewRequired ? "Yes" : "No"}
        />
        <Field label="Hosting environment" value={card.hostingEnvironment ?? "—"} />
        <Field label="Data residency" value={card.dataResidency ?? "—"} />
        <Field
          label="No-train on customer data"
          value={card.noTrainingOnCustomerData ? "Confirmed" : "Missing"}
          warn={!card.noTrainingOnCustomerData}
        />
        <Field
          label="Contract effective"
          value={fmt(card.contractEffectiveDate)}
        />
        <Field
          label="Contract review due"
          value={fmt(card.contractReviewDueDate)}
          warn={
            !!card.contractReviewDueDate &&
            card.contractReviewDueDate.getTime() < Date.now()
          }
        />
        <Field
          label="Last reviewed"
          value={
            card.lastReviewedAt
              ? `${fmt(card.lastReviewedAt)}${
                  card.lastReviewedBy?.displayName
                    ? ` · ${card.lastReviewedBy.displayName}`
                    : ""
                }`
              : "Never"
          }
        />
      </div>

      <Section title="Purpose">{card.purpose}</Section>
      <Section title="Intended use">{card.intendedUse}</Section>
      {card.outOfScopeUse && (
        <Section title="Out-of-scope use">{card.outOfScopeUse}</Section>
      )}
      {card.knownLimitations && (
        <Section title="Known limitations">{card.knownLimitations}</Section>
      )}
      {card.fairnessNotes && (
        <Section title="Fairness / bias notes">{card.fairnessNotes}</Section>
      )}
      {card.trainingDataPolicy && (
        <Section title="Training-data policy">{card.trainingDataPolicy}</Section>
      )}
      {card.contractClauseRef && (
        <Section title="Contract clause reference">
          {card.contractClauseRef}
        </Section>
      )}
      {card.documentationUrl && (
        <Section title="Documentation">
          <a
            href={card.documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline"
          >
            {card.documentationUrl}
          </a>
        </Section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Decisions by this model — most recent 50 of {card._count.decisions}
          </h2>
        </header>
        {card.decisions.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No decisions logged for this model yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">When</th>
                <th className="px-4 py-2 text-left">Feature</th>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Suggestion</th>
                <th className="px-4 py-2 text-left">Confidence</th>
                <th className="px-4 py-2 text-left">Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {card.decisions.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50 align-top">
                  <td className="px-4 py-2 text-xs text-gray-600 whitespace-nowrap">
                    {d.createdAt.toLocaleString("en-US")}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {d.feature}
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
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700 max-w-md truncate">
                    {d.suggestedAction ?? d.responseSummary?.slice(0, 80) ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {d.confidenceScore != null
                      ? `${Math.round(d.confidenceScore * 100)}%`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {d.humanDecision}
                    {d.humanDecisionBy?.displayName && (
                      <div className="text-[10px] text-gray-500">
                        {d.humanDecisionBy.displayName}
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

function Field({
  label,
  value,
  warn,
}: {
  label: string;
  value: string;
  warn?: boolean;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3">
      <div className="text-xs uppercase text-gray-500">{label}</div>
      <div
        className={`text-sm font-medium mt-1 ${
          warn ? "text-red-700" : "text-gray-900"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h3 className="text-xs uppercase text-gray-500 mb-2">{title}</h3>
      <div className="text-sm text-gray-900 whitespace-pre-wrap">
        {children}
      </div>
    </section>
  );
}
