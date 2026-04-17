"use client";

import { api } from "@/trpc/react";
import { useState } from "react";

export function CarrierResponseForm({ token }: { token: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<string[]>([]);
  const [thresholdMet, setThresholdMet] = useState<boolean | null>(null);

  const facilities = api.malpractice.listFacilityMinimums.useQuery(undefined, {
    // The carrier-facing form is on a public route so this query will fail
    // for unauthenticated callers. Hide errors silently.
    retry: false,
    refetchOnWindowFocus: false,
  });

  const mutation = api.malpractice.submitResponse.useMutation({
    onSuccess: (data) => {
      setSubmitted(true);
      setThresholdMet(data.thresholdMet);
      setIssues(data.issues ?? []);
    },
    onError: (e) => setError(e.message),
  });

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div
          className={`text-4xl mb-4 ${thresholdMet ? "text-green-600" : "text-amber-600"}`}
        >
          {thresholdMet ? "✓" : "!"}
        </div>
        <h2 className="text-xl font-bold text-gray-900">
          {thresholdMet
            ? "Thank you — coverage confirmed"
            : "Submitted — flagged for review"}
        </h2>
        <p className="text-gray-500 mt-2">
          Your response has been recorded. You may close this page.
        </p>
        {!thresholdMet && issues.length > 0 && (
          <div className="mt-4 text-left bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-3 text-sm">
            <p className="font-medium mb-1">
              Items the credentialing team will review:
            </p>
            <ul className="list-disc pl-5 space-y-0.5">
              {issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        mutation.mutate({
          token,
          perOccurrenceUsd: Number(form.get("perOccurrenceUsd") || 0),
          aggregateUsd: Number(form.get("aggregateUsd") || 0),
          effectiveDate: new Date(form.get("effectiveDate") as string),
          expirationDate: new Date(form.get("expirationDate") as string),
          claimsHistory: (form.get("claimsHistory") as string) || undefined,
          confirmedByName: (form.get("confirmedByName") as string) || "",
          confirmedByTitle:
            (form.get("confirmedByTitle") as string) || undefined,
          additionalComments:
            (form.get("additionalComments") as string) || undefined,
          facilityName: (form.get("facilityName") as string) || undefined,
        });
      }}
      className="space-y-6"
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Per-Occurrence Limit (USD) *
          </label>
          <input
            name="perOccurrenceUsd"
            type="number"
            min="0"
            step="1"
            required
            placeholder="1000000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Aggregate Limit (USD) *
          </label>
          <input
            name="aggregateUsd"
            type="number"
            min="0"
            step="1"
            required
            placeholder="3000000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Effective Date *
          </label>
          <input
            name="effectiveDate"
            type="date"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Expiration Date *
          </label>
          <input
            name="expirationDate"
            type="date"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Facility this coverage is being verified for (optional)
        </label>
        <select
          name="facilityName"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          defaultValue=""
        >
          <option value="">— Use Essen default minimum —</option>
          {(facilities.data ?? []).map((f) => (
            <option key={f.id} value={f.facilityName}>
              {f.facilityName} ({f.minPerOccurrenceLabel} /{" "}
              {f.minAggregateLabel} minimum)
            </option>
          ))}
        </select>
        <p className="text-[11px] text-gray-500 mt-1">
          We compare reported limits against this facility&apos;s required
          minimum.
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Claims History (last 5 years)
        </label>
        <textarea
          name="claimsHistory"
          rows={3}
          placeholder="None / List any claims, settlements, or open cases…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Name *
          </label>
          <input
            name="confirmedByName"
            type="text"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Your Title
          </label>
          <input
            name="confirmedByTitle"
            type="text"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Additional Comments
        </label>
        <textarea
          name="additionalComments"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting…" : "Submit Coverage Verification"}
      </button>
    </form>
  );
}
