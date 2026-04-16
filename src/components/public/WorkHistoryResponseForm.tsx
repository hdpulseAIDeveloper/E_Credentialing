"use client";

import { api } from "@/trpc/react";
import { useState } from "react";

export function WorkHistoryResponseForm({ token }: { token: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const mutation = api.workHistory.submitResponse.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(e.message),
  });

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-gray-900">Thank You!</h2>
        <p className="text-gray-500 mt-2">Your response has been recorded. You may close this page.</p>
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
          verified: form.get("verified") === "true",
          employerConfirmedName: (form.get("employerConfirmedName") as string) || undefined,
          employerConfirmedPosition: (form.get("employerConfirmedPosition") as string) || undefined,
          startDate: (form.get("startDate") as string) ? new Date(form.get("startDate") as string) : undefined,
          endDate: (form.get("endDate") as string) ? new Date(form.get("endDate") as string) : undefined,
          additionalComments: (form.get("additionalComments") as string) || undefined,
        });
      }}
      className="space-y-6"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Can you confirm this person was employed at your organization? *
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2">
            <input type="radio" name="verified" value="true" required className="text-blue-600" />
            <span className="text-sm">Yes, I confirm</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="verified" value="false" className="text-blue-600" />
            <span className="text-sm">No / Unable to confirm</span>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Your Name / Title</label>
          <input name="employerConfirmedName" type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Position Held</label>
          <input name="employerConfirmedPosition" type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
          <input name="startDate" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
          <input name="endDate" type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Comments</label>
        <textarea name="additionalComments" rows={3} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting..." : "Submit Verification"}
      </button>
    </form>
  );
}
