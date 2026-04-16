"use client";

import { api } from "@/trpc/react";
import { useState } from "react";

const RATING_LABELS = ["Poor", "Below Average", "Average", "Good", "Excellent"];

function RatingField({
  name,
  label,
}: {
  name: string;
  label: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label} *</label>
      <div className="flex gap-3">
        {[1, 2, 3, 4, 5].map((value) => (
          <label key={value} className="flex flex-col items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={value}
              required
              className="text-blue-600"
            />
            <span className="text-xs text-gray-500">{value}</span>
            <span className="text-[10px] text-gray-400">{RATING_LABELS[value - 1]}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ReferenceResponseForm({ token }: { token: string }) {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const mutation = api.reference.submitResponse.useMutation({
    onSuccess: () => setSubmitted(true),
    onError: (e) => setError(e.message),
  });

  if (submitted) {
    return (
      <div className="text-center py-8">
        <div className="text-green-600 text-4xl mb-4">✓</div>
        <h2 className="text-xl font-bold text-gray-900">Thank You!</h2>
        <p className="text-gray-500 mt-2">Your reference has been recorded. You may close this page.</p>
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
          rating: Number(form.get("rating")),
          clinicalCompetence: Number(form.get("clinicalCompetence")),
          professionalism: Number(form.get("professionalism")),
          recommendation: form.get("recommendation") as "highly_recommend" | "recommend" | "do_not_recommend",
          comments: (form.get("comments") as string) || undefined,
        });
      }}
      className="space-y-6"
    >
      <RatingField name="rating" label="Overall Rating" />
      <RatingField name="clinicalCompetence" label="Clinical Competence" />
      <RatingField name="professionalism" label="Professionalism" />

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Recommendation *</label>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <input type="radio" name="recommendation" value="highly_recommend" required className="text-blue-600" />
            <span className="text-sm">Highly Recommend</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="recommendation" value="recommend" className="text-blue-600" />
            <span className="text-sm">Recommend</span>
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="recommendation" value="do_not_recommend" className="text-blue-600" />
            <span className="text-sm">Do Not Recommend</span>
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Additional Comments</label>
        <textarea name="comments" rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" placeholder="Please share any additional context about your experience working with this provider..." />
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}
      <button
        type="submit"
        disabled={mutation.isPending}
        className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
      >
        {mutation.isPending ? "Submitting..." : "Submit Reference"}
      </button>
    </form>
  );
}
