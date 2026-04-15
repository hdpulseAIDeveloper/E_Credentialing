"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

type EnrollmentStatus = "DRAFT" | "SUBMITTED" | "PENDING_PAYER" | "ENROLLED" | "DENIED" | "ERROR" | "WITHDRAWN";

const STATUS_OPTIONS: { value: EnrollmentStatus; label: string }[] = [
  { value: "DRAFT", label: "Draft" },
  { value: "SUBMITTED", label: "Submitted" },
  { value: "PENDING_PAYER", label: "Pending Payer" },
  { value: "ENROLLED", label: "Enrolled" },
  { value: "DENIED", label: "Denied" },
  { value: "ERROR", label: "Error" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

interface Props {
  enrollmentId: string;
  currentStatus: EnrollmentStatus;
  currentFollowUpDue: string | null;
}

export function EnrollmentActions({ enrollmentId, currentStatus, currentFollowUpDue }: Props) {
  const router = useRouter();
  const [statusOpen, setStatusOpen] = useState(false);
  const [followUpOpen, setFollowUpOpen] = useState(false);

  const [statusForm, setStatusForm] = useState({
    status: currentStatus,
    payerConfirmationNumber: "",
    effectiveDate: "",
    payerResponseNotes: "",
    denialReason: "",
    followUpDueDate: currentFollowUpDue ?? "",
  });

  const [followUpForm, setFollowUpForm] = useState({
    outcome: "",
    nextFollowUpDate: "",
  });
  const [followUpError, setFollowUpError] = useState("");

  const updateStatus = api.enrollment.updateStatus.useMutation({
    onSuccess: () => {
      setStatusOpen(false);
      router.refresh();
    },
  });

  const addFollowUp = api.enrollment.addFollowUp.useMutation({
    onSuccess: () => {
      setFollowUpOpen(false);
      setFollowUpForm({ outcome: "", nextFollowUpDate: "" });
      router.refresh();
    },
  });

  const handleFollowUp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!followUpForm.outcome.trim()) {
      setFollowUpError("Outcome notes are required.");
      return;
    }
    setFollowUpError("");
    addFollowUp.mutate({
      enrollmentId,
      outcome: followUpForm.outcome.trim(),
      nextFollowUpDate: followUpForm.nextFollowUpDate || undefined,
    });
  };

  return (
    <>
      <div className="flex gap-2">
        <button
          onClick={() => setStatusOpen(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Update Status
        </button>
        <button
          onClick={() => setFollowUpOpen(true)}
          className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Log Follow-Up
        </button>
      </div>

      {/* Update Status Modal */}
      {statusOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Update Enrollment Status</h2>
              <button onClick={() => setStatusOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateStatus.mutate({
                  id: enrollmentId,
                  status: statusForm.status,
                  payerConfirmationNumber: statusForm.payerConfirmationNumber || undefined,
                  effectiveDate: statusForm.effectiveDate || undefined,
                  payerResponseNotes: statusForm.payerResponseNotes || undefined,
                  denialReason: statusForm.denialReason || undefined,
                  followUpDueDate: statusForm.followUpDueDate || undefined,
                });
              }}
              className="px-6 py-4 space-y-4"
            >
              {updateStatus.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {updateStatus.error.message}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select
                  value={statusForm.status}
                  onChange={(e) => setStatusForm((p) => ({ ...p, status: e.target.value as EnrollmentStatus }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              {(statusForm.status === "ENROLLED") && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Confirmation #</label>
                    <input
                      type="text"
                      value={statusForm.payerConfirmationNumber}
                      onChange={(e) => setStatusForm((p) => ({ ...p, payerConfirmationNumber: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Effective Date</label>
                    <input
                      type="date"
                      value={statusForm.effectiveDate}
                      onChange={(e) => setStatusForm((p) => ({ ...p, effectiveDate: e.target.value }))}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
              {(statusForm.status === "DENIED") && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Denial Reason</label>
                  <textarea
                    value={statusForm.denialReason}
                    onChange={(e) => setStatusForm((p) => ({ ...p, denialReason: e.target.value }))}
                    rows={2}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Payer Response Notes</label>
                <textarea
                  value={statusForm.payerResponseNotes}
                  onChange={(e) => setStatusForm((p) => ({ ...p, payerResponseNotes: e.target.value }))}
                  rows={2}
                  placeholder="Any notes from the payer response"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Next Follow-Up Due</label>
                <input
                  type="date"
                  value={statusForm.followUpDueDate}
                  onChange={(e) => setStatusForm((p) => ({ ...p, followUpDueDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={updateStatus.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {updateStatus.isPending ? "Saving…" : "Save Status"}
                </button>
                <button type="button" onClick={() => setStatusOpen(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Log Follow-Up Modal */}
      {followUpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Log Follow-Up</h2>
              <button onClick={() => setFollowUpOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleFollowUp} className="px-6 py-4 space-y-4">
              {addFollowUp.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {addFollowUp.error.message}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Outcome / Notes <span className="text-red-500">*</span></label>
                <textarea
                  value={followUpForm.outcome}
                  onChange={(e) => { setFollowUpForm((p) => ({ ...p, outcome: e.target.value })); setFollowUpError(""); }}
                  rows={4}
                  placeholder="Describe what happened in this follow-up call / email…"
                  className={`w-full border ${followUpError ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                />
                {followUpError && <p className="text-xs text-red-600 mt-0.5">{followUpError}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Next Follow-Up Date <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="date"
                  value={followUpForm.nextFollowUpDate}
                  onChange={(e) => setFollowUpForm((p) => ({ ...p, nextFollowUpDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={addFollowUp.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {addFollowUp.isPending ? "Saving…" : "Log Follow-Up"}
                </button>
                <button type="button" onClick={() => setFollowUpOpen(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
