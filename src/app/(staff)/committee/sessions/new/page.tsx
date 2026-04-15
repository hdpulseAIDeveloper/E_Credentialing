"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";

export default function NewCommitteeSessionPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    sessionDate: "",
    sessionTime: "",
    location: "",
  });
  const [errors, setErrors] = useState<{ sessionDate?: string; general?: string }>({});
  const [loading, setLoading] = useState(false);

  const createSession = api.committee.createSession.useMutation({
    onSuccess: (session) => {
      router.push(`/committee/sessions/${session.id}`);
    },
    onError: (err) => {
      setErrors({ general: err.message });
      setLoading(false);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.sessionDate) {
      setErrors({ sessionDate: "Session date is required." });
      return;
    }

    setErrors({});
    setLoading(true);

    createSession.mutate({
      sessionDate: form.sessionDate,
      sessionTime: form.sessionTime || undefined,
      location: form.location || undefined,
      committeeMemberIds: [],
    });
  };

  const inputClass = (hasError?: boolean) =>
    `block w-full px-3 py-2 border ${
      hasError ? "border-red-500" : "border-gray-300"
    } rounded-md shadow-sm text-sm bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/committee" className="text-blue-600 text-sm hover:underline">
          ← Committee Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Committee Session</h1>
        <p className="text-gray-500 mt-1">Schedule a new credentialing committee review session.</p>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border p-6 shadow-sm">
        {errors.general && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm font-medium text-red-800">{errors.general}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Date */}
          <div>
            <label htmlFor="sessionDate" className="block text-sm font-medium text-gray-700 mb-1">
              Session Date <span className="text-red-500">*</span>
            </label>
            <input
              id="sessionDate"
              type="date"
              value={form.sessionDate}
              onChange={(e) => {
                setForm((p) => ({ ...p, sessionDate: e.target.value }));
                if (errors.sessionDate) setErrors((p) => ({ ...p, sessionDate: undefined }));
              }}
              className={inputClass(!!errors.sessionDate)}
              min={new Date().toISOString().split("T")[0]}
            />
            {errors.sessionDate && (
              <p className="mt-1 text-xs font-medium text-red-800">{errors.sessionDate}</p>
            )}
          </div>

          {/* Time */}
          <div>
            <label htmlFor="sessionTime" className="block text-sm font-medium text-gray-700 mb-1">
              Session Time
            </label>
            <input
              id="sessionTime"
              type="time"
              value={form.sessionTime}
              onChange={(e) => setForm((p) => ({ ...p, sessionTime: e.target.value }))}
              className={inputClass()}
            />
            <p className="mt-1 text-xs text-gray-500">Leave blank if time is TBD.</p>
          </div>

          {/* Location */}
          <div>
            <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
              Location / Meeting Link
            </label>
            <input
              id="location"
              type="text"
              value={form.location}
              onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
              placeholder="e.g. Conference Room B, 4th Floor or Microsoft Teams"
              className={inputClass()}
            />
          </div>

          {/* Info box */}
          <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">After creating the session</p>
            <p className="text-blue-700">
              You can add providers from the Committee Ready queue to this session&apos;s agenda on the session detail page.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Creating session…" : "Create Session"}
            </button>
            <Link
              href="/committee"
              className="flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
