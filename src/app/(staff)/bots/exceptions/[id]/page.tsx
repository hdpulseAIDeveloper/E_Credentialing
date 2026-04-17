/**
 * Staff: Bot exception verdict detail — P3 Gap #20.
 *
 * Shows the AI verdict, full bot run context (error message, attempts),
 * and accept/override actions for managers.
 */

import Link from "next/link";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect, notFound } from "next/navigation";
import { VerdictActions } from "./VerdictActions";

export default async function VerdictDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const verdict = await db.botExceptionVerdict.findUnique({
    where: { id: params.id },
    include: {
      provider: {
        select: { id: true, legalFirstName: true, legalLastName: true },
      },
      botRun: true,
      resolvedBy: { select: { displayName: true } },
    },
  });
  if (!verdict) notFound();

  const evidence = verdict.evidence as Record<string, unknown>;
  const isManager =
    session.user.role === "MANAGER" || session.user.role === "ADMIN";
  const open = verdict.status === "PENDING_REVIEW";

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/bots/exceptions"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to Bot Exceptions
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900">
          {verdict.botRun.botType.replace(/_/g, " ")} — verdict
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          For{" "}
          <Link
            href={`/providers/${verdict.provider.id}`}
            className="text-blue-600 hover:underline"
          >
            {verdict.provider.legalLastName}, {verdict.provider.legalFirstName}
          </Link>
          {" · "}
          run {verdict.botRunId.slice(0, 8)} · attempt{" "}
          {verdict.botRun.attemptCount}
        </p>
      </header>

      <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-3">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            AI recommendation
          </h2>
          <span className="text-xs text-gray-500">
            confidence {Math.round(verdict.confidence * 100)}% ·{" "}
            {verdict.source}
            {verdict.modelUsed ? ` (${verdict.modelUsed})` : ""}
          </span>
        </div>
        <div className="text-base font-semibold text-blue-700">
          {verdict.recommendedAction.replace(/_/g, " ")}
        </div>
        <p className="text-sm text-gray-800 whitespace-pre-wrap">
          {verdict.rationale}
        </p>
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Bot run context
        </h2>
        <dl className="text-sm grid grid-cols-2 gap-y-1">
          <dt className="text-gray-500">Trigger reason</dt>
          <dd className="text-gray-900">{verdict.triggerReason}</dd>
          <dt className="text-gray-500">Bot status</dt>
          <dd className="text-gray-900">{verdict.botRun.status}</dd>
          <dt className="text-gray-500">Attempts</dt>
          <dd className="text-gray-900">{verdict.botRun.attemptCount}</dd>
          <dt className="text-gray-500">Started</dt>
          <dd className="text-gray-900">
            {verdict.botRun.startedAt?.toLocaleString("en-US") ?? "—"}
          </dd>
          <dt className="text-gray-500">Completed</dt>
          <dd className="text-gray-900">
            {verdict.botRun.completedAt?.toLocaleString("en-US") ?? "—"}
          </dd>
        </dl>
        {verdict.botRun.errorMessage && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">Error message</div>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-48 whitespace-pre-wrap">
              {verdict.botRun.errorMessage}
            </pre>
          </div>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-gray-900 mb-2">
          Evidence considered
        </h2>
        <pre className="text-xs bg-gray-50 border border-gray-200 rounded p-2 overflow-auto max-h-48">
          {JSON.stringify(evidence, null, 2)}
        </pre>
      </section>

      {open ? (
        isManager ? (
          <VerdictActions
            id={verdict.id}
            recommendedAction={verdict.recommendedAction}
          />
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
            Manager+ role is required to accept or override this verdict.
          </div>
        )
      ) : (
        <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-2">
            Resolution
          </h2>
          <dl className="text-sm grid grid-cols-2 gap-y-1">
            <dt className="text-gray-500">Status</dt>
            <dd className="text-gray-900">{verdict.status}</dd>
            <dt className="text-gray-500">Resolved at</dt>
            <dd className="text-gray-900">
              {verdict.resolvedAt?.toLocaleString("en-US") ?? "—"}
            </dd>
            <dt className="text-gray-500">Resolved by</dt>
            <dd className="text-gray-900">
              {verdict.resolvedBy?.displayName ?? "—"}
            </dd>
          </dl>
          {verdict.resolutionNote && (
            <p className="mt-2 text-sm text-gray-800 whitespace-pre-wrap">
              {verdict.resolutionNote}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
