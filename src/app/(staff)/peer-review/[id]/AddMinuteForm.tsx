"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { PeerReviewMinuteOutcome } from "@prisma/client";

const OUTCOMES: { value: PeerReviewMinuteOutcome; label: string }[] = [
  { value: "NO_ACTION", label: "No action" },
  { value: "CONTINUED_REVIEW", label: "Continued review" },
  { value: "FOCUSED_REVIEW_REQUIRED", label: "Focused review required (auto-FPPE)" },
  { value: "PRIVILEGE_RESTRICTED", label: "Privilege restricted" },
  { value: "PRIVILEGE_SUSPENDED", label: "Privilege suspended" },
  { value: "PRIVILEGE_REVOKED", label: "Privilege revoked" },
  { value: "REFER_TO_MEC", label: "Refer to MEC" },
  { value: "EXTERNAL_REVIEW_ORDERED", label: "External review ordered" },
];

interface ProviderRef {
  id: string;
  legalFirstName: string;
  legalLastName: string;
}

export function AddMinuteForm({
  meetingId,
  providers,
}: {
  meetingId: string;
  providers: ProviderRef[];
}) {
  const router = useRouter();
  const [providerId, setProviderId] = useState("");
  const [caseSummary, setCaseSummary] = useState("");
  const [caseDate, setCaseDate] = useState("");
  const [caseRefNumber, setCaseRefNumber] = useState("");
  const [outcome, setOutcome] = useState<PeerReviewMinuteOutcome>("NO_ACTION");
  const [rationale, setRationale] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [followUpDueDate, setFollowUpDueDate] = useState("");
  const [isProviderBlinded, setIsProviderBlinded] = useState(false);

  const add = api.peerReview.addMinute.useMutation({
    onSuccess: () => {
      setCaseSummary("");
      setCaseDate("");
      setCaseRefNumber("");
      setRationale("");
      setOutcome("NO_ACTION");
      setFollowUpRequired(false);
      setFollowUpDueDate("");
      setIsProviderBlinded(false);
      router.refresh();
    },
  });

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-900 mb-3">
        Record case minute
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-gray-600">
          Provider
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            <option value="">Select provider…</option>
            {providers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.legalLastName}, {p.legalFirstName}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600">
          Case ref number
          <input
            type="text"
            value={caseRefNumber}
            onChange={(e) => setCaseRefNumber(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          Case date
          <input
            type="date"
            value={caseDate}
            onChange={(e) => setCaseDate(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600">
          Outcome
          <select
            value={outcome}
            onChange={(e) =>
              setOutcome(e.target.value as PeerReviewMinuteOutcome)
            }
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          >
            {OUTCOMES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs text-gray-600 col-span-2">
          Case summary
          <textarea
            value={caseSummary}
            onChange={(e) => setCaseSummary(e.target.value)}
            rows={3}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="block text-xs text-gray-600 col-span-2">
          Rationale / committee discussion
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={3}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-700">
          <input
            type="checkbox"
            checked={followUpRequired}
            onChange={(e) => setFollowUpRequired(e.target.checked)}
          />
          Follow-up required
        </label>
        <label className="block text-xs text-gray-600">
          Follow-up due
          <input
            type="date"
            value={followUpDueDate}
            disabled={!followUpRequired}
            onChange={(e) => setFollowUpDueDate(e.target.value)}
            className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm disabled:bg-gray-100"
          />
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-700 col-span-2">
          <input
            type="checkbox"
            checked={isProviderBlinded}
            onChange={(e) => setIsProviderBlinded(e.target.checked)}
          />
          Blind provider identity in this minute (display as [blinded] in
          listings)
        </label>
      </div>

      {add.error && (
        <p className="text-xs text-red-600 mt-2">{add.error.message}</p>
      )}

      <div className="flex justify-end mt-3">
        <button
          type="button"
          disabled={add.isPending || !providerId || !caseSummary}
          onClick={() =>
            add.mutate({
              meetingId,
              providerId,
              caseSummary,
              caseDate: caseDate
                ? new Date(`${caseDate}T00:00:00Z`).toISOString()
                : null,
              caseRefNumber: caseRefNumber || null,
              outcome,
              rationale: rationale || null,
              followUpRequired,
              followUpDueDate:
                followUpRequired && followUpDueDate
                  ? new Date(`${followUpDueDate}T00:00:00Z`).toISOString()
                  : null,
              isProviderBlinded,
            })
          }
          className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded disabled:opacity-50"
        >
          {add.isPending ? "Saving…" : "Add case minute"}
        </button>
      </div>
    </section>
  );
}
