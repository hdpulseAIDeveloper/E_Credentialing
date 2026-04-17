/**
 * Peer-review meeting detail — captures per-case minutes and outcomes.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { AddMinuteForm } from "./AddMinuteForm";
import { CompleteMeetingButton } from "./CompleteMeetingButton";

const OUTCOME_COLORS: Record<string, string> = {
  NO_ACTION: "bg-green-100 text-green-700",
  CONTINUED_REVIEW: "bg-blue-100 text-blue-700",
  FOCUSED_REVIEW_REQUIRED: "bg-orange-100 text-orange-700",
  PRIVILEGE_RESTRICTED: "bg-amber-100 text-amber-800",
  PRIVILEGE_SUSPENDED: "bg-red-100 text-red-700",
  PRIVILEGE_REVOKED: "bg-red-200 text-red-800",
  REFER_TO_MEC: "bg-purple-100 text-purple-700",
  EXTERNAL_REVIEW_ORDERED: "bg-purple-200 text-purple-800",
};

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function PeerReviewMeetingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const meeting = await db.peerReviewMeeting.findUnique({
    where: { id },
    include: {
      chair: { select: { displayName: true, email: true } },
      minutes: {
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
          authoredBy: { select: { displayName: true } },
          evaluation: {
            select: { id: true, evaluationType: true, status: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!meeting) notFound();

  const providers = await db.provider.findMany({
    where: { status: { in: ["APPROVED", "VERIFICATION_IN_PROGRESS"] } },
    select: { id: true, legalFirstName: true, legalLastName: true },
    orderBy: { legalLastName: "asc" },
    take: 500,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <Link
        href="/peer-review"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Back to peer review
      </Link>

      <header className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Peer Review — {meeting.meetingDate.toLocaleString("en-US")}
          </h1>
          <p className="text-sm text-gray-600 mt-1">
            {meeting.facilityName ?? "All facilities"} · Chair:{" "}
            {meeting.chair?.displayName ?? "—"} · Status:{" "}
            <span className="font-medium">{meeting.status}</span>
          </p>
        </div>
        {meeting.status !== "COMPLETED" && (
          <CompleteMeetingButton meetingId={meeting.id} />
        )}
      </header>

      {meeting.notes && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">
            {meeting.notes}
          </p>
        </section>
      )}

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-sm font-semibold text-gray-900">
            Case Minutes ({meeting.minutes.length})
          </h2>
        </header>
        {meeting.minutes.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No cases have been recorded for this meeting yet.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Provider</th>
                <th className="px-4 py-2 text-left">Case ref</th>
                <th className="px-4 py-2 text-left">Case date</th>
                <th className="px-4 py-2 text-left">Outcome</th>
                <th className="px-4 py-2 text-left">FPPE</th>
                <th className="px-4 py-2 text-left">Authored by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meeting.minutes.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    {m.isProviderBlinded ? (
                      <span className="text-gray-500 italic">[blinded]</span>
                    ) : (
                      <Link
                        href={`/providers/${m.provider.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {m.provider.legalFirstName} {m.provider.legalLastName}
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-700">
                    {m.caseRefNumber ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-gray-700">{fmt(m.caseDate)}</td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        OUTCOME_COLORS[m.outcome] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {m.outcome.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {m.evaluation ? (
                      <Link
                        href={`/evaluations`}
                        className="text-blue-600 hover:underline"
                      >
                        {m.evaluation.evaluationType} ·{" "}
                        {m.evaluation.status}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {m.authoredBy?.displayName ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <AddMinuteForm meetingId={meeting.id} providers={providers} />
    </div>
  );
}
