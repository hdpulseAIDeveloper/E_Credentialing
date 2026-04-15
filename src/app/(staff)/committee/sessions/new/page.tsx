"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/trpc/react";

const TABS = ["Session Details", "Committee Members"];

export default function NewCommitteeSessionPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState({
    sessionDate: "",
    sessionTime: "",
    location: "",
    notes: "",
  });
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [errors, setErrors] = useState<{ sessionDate?: string; general?: string }>({});

  // Fetch committee-eligible staff
  const { data: usersData } = api.admin.listUsers.useQuery({ limit: 100 });
  const staffUsers = (usersData?.users ?? []).filter(
    (u: { id: string; displayName: string; email: string; role: string; isActive: boolean }) =>
      u.isActive && ["COMMITTEE_MEMBER", "MANAGER", "ADMIN"].includes(u.role)
  );

  const createSession = api.committee.createSession.useMutation({
    onSuccess: (session) => {
      router.push(`/committee/sessions/${session.id}`);
    },
    onError: (err) => {
      setErrors({ general: err.message });
    },
  });

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sessionDate) {
      setErrors({ sessionDate: "Session date is required." });
      setActiveTab(0);
      return;
    }
    setErrors({});
    createSession.mutate({
      sessionDate: form.sessionDate,
      sessionTime: form.sessionTime || undefined,
      location: form.location || undefined,
      notes: form.notes || undefined,
      committeeMemberIds: selectedMemberIds,
    });
  };

  const inputClass = (hasError?: boolean) =>
    `block w-full px-3 py-2 border ${
      hasError ? "border-red-500" : "border-gray-300"
    } rounded-md shadow-sm text-sm bg-white text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500`;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/committee" className="text-blue-600 text-sm hover:underline">
          ← Committee Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Create Committee Session</h1>
        <p className="text-gray-500 mt-1">Schedule a new credentialing committee review session.</p>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        {/* Tabs */}
        <div className="flex border-b px-6">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`py-3 px-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === i ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
              {i === 1 && selectedMemberIds.length > 0 && (
                <span className="ml-1.5 text-xs bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full">
                  {selectedMemberIds.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5 min-h-[300px]">
            {errors.general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm font-medium text-red-800">{errors.general}</p>
              </div>
            )}

            {/* Tab 0: Session Details */}
            {activeTab === 0 && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Session Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={form.sessionDate}
                    onChange={(e) => { setForm((p) => ({ ...p, sessionDate: e.target.value })); setErrors((p) => ({ ...p, sessionDate: undefined })); }}
                    className={inputClass(!!errors.sessionDate)}
                    min={new Date().toISOString().split("T")[0]}
                  />
                  {errors.sessionDate && <p className="mt-1 text-xs font-medium text-red-800">{errors.sessionDate}</p>}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Time</label>
                  <input
                    type="time"
                    value={form.sessionTime}
                    onChange={(e) => setForm((p) => ({ ...p, sessionTime: e.target.value }))}
                    className={inputClass()}
                  />
                  <p className="mt-1 text-xs text-gray-500">Leave blank if time is TBD.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Location / Meeting Link</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                    placeholder="e.g. Conference Room B, 4th Floor or Microsoft Teams link"
                    className={inputClass()}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Session Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                    placeholder="Any agenda context, special items, or preparation notes…"
                    className={`${inputClass()} resize-none`}
                  />
                </div>
              </>
            )}

            {/* Tab 1: Committee Members */}
            {activeTab === 1 && (
              <>
                <p className="text-sm text-gray-600">
                  Select staff members who will attend this session. Committee Members, Managers, and Admins are eligible.
                </p>
                {staffUsers.length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No eligible committee members found.</p>
                ) : (
                  <div className="space-y-2">
                    {staffUsers.map((u: { id: string; displayName: string; email: string; role: string }) => (
                      <label key={u.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedMemberIds.includes(u.id)}
                          onChange={() => toggleMember(u.id)}
                          className="h-4 w-4 text-blue-600 rounded border-gray-300"
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{u.displayName}</div>
                          <div className="text-xs text-gray-500">{u.email} · {u.role.replace("_", " ")}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {selectedMemberIds.length > 0 && (
                  <p className="text-xs text-blue-600">{selectedMemberIds.length} member{selectedMemberIds.length !== 1 ? "s" : ""} selected</p>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 pb-6 flex gap-3">
            {activeTab > 0 && (
              <button type="button" onClick={() => setActiveTab((t) => t - 1)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Back
              </button>
            )}
            {activeTab < TABS.length - 1 ? (
              <button
                type="button"
                onClick={() => {
                  if (!form.sessionDate) {
                    setErrors({ sessionDate: "Session date is required." });
                    return;
                  }
                  setErrors({});
                  setActiveTab((t) => t + 1);
                }}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Next: {TABS[activeTab + 1]}
              </button>
            ) : (
              <button
                type="submit"
                disabled={createSession.isPending}
                className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {createSession.isPending ? "Creating session…" : "Create Session"}
              </button>
            )}
            <Link
              href="/committee"
              className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
