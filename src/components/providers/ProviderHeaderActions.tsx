"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import type { ProviderStatus } from "@prisma/client";

const STATUS_TRANSITIONS: Record<ProviderStatus, { status: ProviderStatus; label: string; color: string }[]> = {
  INVITED: [{ status: "ONBOARDING_IN_PROGRESS", label: "Start Onboarding", color: "blue" }],
  ONBOARDING_IN_PROGRESS: [{ status: "DOCUMENTS_PENDING", label: "Mark Docs Pending", color: "yellow" }],
  DOCUMENTS_PENDING: [{ status: "VERIFICATION_IN_PROGRESS", label: "Start Verification", color: "purple" }],
  VERIFICATION_IN_PROGRESS: [{ status: "COMMITTEE_READY", label: "Mark Committee Ready", color: "indigo" }],
  COMMITTEE_READY: [{ status: "COMMITTEE_IN_REVIEW", label: "Begin Review", color: "indigo" }],
  COMMITTEE_IN_REVIEW: [
    { status: "APPROVED", label: "Approve", color: "green" },
    { status: "DENIED", label: "Deny", color: "red" },
    { status: "DEFERRED", label: "Defer", color: "orange" },
  ],
  APPROVED: [{ status: "INACTIVE", label: "Mark Inactive", color: "gray" }],
  DENIED: [{ status: "INVITED", label: "Re-invite", color: "blue" }],
  DEFERRED: [{ status: "COMMITTEE_READY", label: "Return to Queue", color: "indigo" }],
  INACTIVE: [{ status: "INVITED", label: "Re-activate", color: "blue" }],
};

const BUTTON_COLORS: Record<string, string> = {
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  yellow: "bg-yellow-500 hover:bg-yellow-600 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
  green: "bg-green-600 hover:bg-green-700 text-white",
  red: "bg-red-600 hover:bg-red-700 text-white",
  orange: "bg-orange-500 hover:bg-orange-600 text-white",
  gray: "bg-gray-500 hover:bg-gray-600 text-white",
};

interface Staff {
  id: string;
  displayName: string;
}

interface Props {
  providerId: string;
  currentStatus: ProviderStatus;
  currentNpi: string | null;
  currentDea: string | null;
  currentCaqh: string | null;
  currentIcims: string | null;
  currentNotes: string | null;
  currentSpecialistId: string | null;
  staffUsers: Staff[];
}

export function ProviderHeaderActions({
  providerId,
  currentStatus,
  currentNpi,
  currentDea,
  currentCaqh,
  currentIcims,
  currentNotes,
  currentSpecialistId,
  staffUsers,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<ProviderStatus | null>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState({
    npi: currentNpi ?? "",
    deaNumber: currentDea ?? "",
    caqhId: currentCaqh ?? "",
    icimsId: currentIcims ?? "",
    notes: currentNotes ?? "",
    assignedSpecialistId: currentSpecialistId ?? "",
  });

  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];

  const transitionMutation = api.provider.transitionStatus.useMutation({
    onSuccess: () => {
      setReasonOpen(null);
      setReason("");
      router.refresh();
    },
  });

  const updateMutation = api.provider.update.useMutation({
    onSuccess: () => {
      setEditOpen(false);
      router.refresh();
    },
  });

  const handleTransition = (newStatus: ProviderStatus) => {
    if (newStatus === "DENIED" || newStatus === "DEFERRED") {
      setReasonOpen(newStatus);
    } else {
      transitionMutation.mutate({ id: providerId, newStatus });
    }
  };

  const handleTransitionWithReason = () => {
    if (!reasonOpen) return;
    transitionMutation.mutate({ id: providerId, newStatus: reasonOpen, reason: reason || undefined });
  };

  const handleUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      id: providerId,
      npi: form.npi || undefined,
      deaNumber: form.deaNumber || undefined,
      caqhId: form.caqhId || undefined,
      icimsId: form.icimsId || undefined,
      notes: form.notes || undefined,
      assignedSpecialistId: form.assignedSpecialistId || null,
    });
  };

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Edit button */}
        <button
          onClick={() => setEditOpen(true)}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Edit Info
        </button>

        {/* Status transition buttons */}
        {transitions.map((t) => (
          <button
            key={t.status}
            onClick={() => handleTransition(t.status)}
            disabled={transitionMutation.isPending}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${BUTTON_COLORS[t.color]}`}
          >
            {transitionMutation.isPending ? "Saving…" : t.label}
          </button>
        ))}
      </div>

      {/* Edit Info Modal */}
      {editOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Edit Provider Info</h2>
              <button onClick={() => setEditOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleUpdate} className="px-6 py-4 space-y-4">
              {updateMutation.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {updateMutation.error.message}
                </p>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">NPI</label>
                  <input
                    type="text"
                    value={form.npi}
                    onChange={(e) => setForm((p) => ({ ...p, npi: e.target.value }))}
                    placeholder="10-digit NPI"
                    maxLength={10}
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">DEA Number</label>
                  <input
                    type="text"
                    value={form.deaNumber}
                    onChange={(e) => setForm((p) => ({ ...p, deaNumber: e.target.value }))}
                    placeholder="DEA number"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">CAQH ID</label>
                  <input
                    type="text"
                    value={form.caqhId}
                    onChange={(e) => setForm((p) => ({ ...p, caqhId: e.target.value }))}
                    placeholder="CAQH ID"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">iCIMS ID</label>
                  <input
                    type="text"
                    value={form.icimsId}
                    onChange={(e) => setForm((p) => ({ ...p, icimsId: e.target.value }))}
                    placeholder="iCIMS ID"
                    className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Specialist</label>
                <select
                  value={form.assignedSpecialistId}
                  onChange={(e) => setForm((p) => ({ ...p, assignedSpecialistId: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Unassigned —</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  placeholder="Internal notes visible to staff only"
                  className="w-full border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={updateMutation.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {updateMutation.isPending ? "Saving…" : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditOpen(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reason Modal (for Deny / Defer) */}
      {reasonOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">
                {reasonOpen === "DENIED" ? "Deny Provider" : "Defer Provider"}
              </h2>
              <button onClick={() => setReasonOpen(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {transitionMutation.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {transitionMutation.error.message}
                </p>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  placeholder="Briefly describe the reason for this decision…"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleTransitionWithReason}
                  disabled={transitionMutation.isPending}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg disabled:opacity-50 transition-colors text-white ${
                    reasonOpen === "DENIED" ? "bg-red-600 hover:bg-red-700" : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {transitionMutation.isPending ? "Saving…" : reasonOpen === "DENIED" ? "Confirm Deny" : "Confirm Defer"}
                </button>
                <button
                  onClick={() => setReasonOpen(null)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
