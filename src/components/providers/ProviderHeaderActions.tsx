"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

type ProviderStatus =
  | "INVITED"
  | "ONBOARDING_IN_PROGRESS"
  | "DOCUMENTS_PENDING"
  | "VERIFICATION_IN_PROGRESS"
  | "COMMITTEE_READY"
  | "COMMITTEE_IN_REVIEW"
  | "APPROVED"
  | "DENIED"
  | "DEFERRED"
  | "INACTIVE";

const STATUS_TRANSITIONS: Record<
  ProviderStatus,
  { status: ProviderStatus; label: string; color: string }[]
> = {
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

const REASON_REQUIRED: Partial<Record<ProviderStatus, string>> = {
  DENIED: "Denial reason",
  DEFERRED: "Deferral reason",
  INACTIVE: "Reason for inactivation",
};

const BTN_COLORS: Record<string, string> = {
  green: "bg-green-600 hover:bg-green-700 text-white",
  red: "bg-red-600 hover:bg-red-700 text-white",
  orange: "bg-orange-500 hover:bg-orange-600 text-white",
  blue: "bg-blue-600 hover:bg-blue-700 text-white",
  indigo: "bg-indigo-600 hover:bg-indigo-700 text-white",
  purple: "bg-purple-600 hover:bg-purple-700 text-white",
  yellow: "bg-yellow-500 hover:bg-yellow-600 text-white",
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
  currentFirstName: string;
  currentLastName: string;
  currentMiddleName: string | null;
  currentMedicarePtan: string | null;
  currentMedicaidId: string | null;
  staffUsers: Staff[];
}

const EDIT_TABS = ["Name", "Identifiers", "Assignment & Notes"];

export function ProviderHeaderActions({
  providerId,
  currentStatus,
  currentNpi,
  currentDea,
  currentCaqh,
  currentIcims,
  currentNotes,
  currentSpecialistId,
  currentFirstName,
  currentLastName,
  currentMiddleName,
  currentMedicarePtan,
  currentMedicaidId,
  staffUsers,
}: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [reasonOpen, setReasonOpen] = useState(false);
  const [transitionTarget, setTransitionTarget] = useState<ProviderStatus | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [reasonError, setReasonError] = useState("");

  const [editForm, setEditForm] = useState({
    legalFirstName: currentFirstName,
    legalLastName: currentLastName,
    legalMiddleName: currentMiddleName ?? "",
    npi: currentNpi ?? "",
    deaNumber: currentDea ?? "",
    caqhId: currentCaqh ?? "",
    icimsId: currentIcims ?? "",
    medicarePtan: currentMedicarePtan ?? "",
    medicaidId: currentMedicaidId ?? "",
    assignedSpecialistId: currentSpecialistId ?? "",
    notes: currentNotes ?? "",
  });

  const updateProvider = api.provider.update.useMutation({
    onSuccess: () => {
      setEditOpen(false);
      router.refresh();
    },
  });

  const transitionStatus = api.provider.transitionStatus.useMutation({
    onSuccess: () => {
      setReasonOpen(false);
      setReasonText("");
      setTransitionTarget(null);
      router.refresh();
    },
  });

  const handleTransitionClick = (target: ProviderStatus) => {
    if (REASON_REQUIRED[target]) {
      setTransitionTarget(target);
      setReasonText("");
      setReasonError("");
      setReasonOpen(true);
    } else {
      transitionStatus.mutate({ id: providerId, newStatus: target, reason: undefined });
    }
  };

  const handleReasonSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reasonText.trim()) {
      setReasonError(`${REASON_REQUIRED[transitionTarget!]} is required.`);
      return;
    }
    transitionStatus.mutate({ id: providerId, newStatus: transitionTarget!, reason: reasonText.trim() });
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProvider.mutate({
      id: providerId,
      legalFirstName: editForm.legalFirstName.trim() || undefined,
      legalLastName: editForm.legalLastName.trim() || undefined,
      legalMiddleName: editForm.legalMiddleName.trim() || undefined,
      npi: editForm.npi.trim() || undefined,
      deaNumber: editForm.deaNumber.trim() || undefined,
      caqhId: editForm.caqhId.trim() || undefined,
      icimsId: editForm.icimsId.trim() || undefined,
      medicarePtan: editForm.medicarePtan.trim() || undefined,
      medicaidId: editForm.medicaidId.trim() || undefined,
      assignedSpecialistId: editForm.assignedSpecialistId || undefined,
      notes: editForm.notes.trim() || undefined,
    });
  };

  const transitions = STATUS_TRANSITIONS[currentStatus] ?? [];

  return (
    <>
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          onClick={() => { setEditOpen(true); setActiveTab(0); }}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Edit Info
        </button>
        {transitions.map((t) => (
          <button
            key={t.status}
            onClick={() => handleTransitionClick(t.status)}
            disabled={transitionStatus.isPending}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${BTN_COLORS[t.color] ?? BTN_COLORS.blue}`}
          >
            {t.label}
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

            {/* Tabs */}
            <div className="flex border-b px-6">
              {EDIT_TABS.map((tab, i) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`py-2 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    activeTab === i ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <form onSubmit={handleEditSubmit}>
              <div className="px-6 py-4 space-y-4 min-h-[220px]">
                {updateProvider.error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    {updateProvider.error.message}
                  </p>
                )}

                {/* Tab 0: Name */}
                {activeTab === 0 && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">First Name</label>
                        <input type="text" value={editForm.legalFirstName} onChange={(e) => setEditForm((p) => ({ ...p, legalFirstName: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Last Name</label>
                        <input type="text" value={editForm.legalLastName} onChange={(e) => setEditForm((p) => ({ ...p, legalLastName: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Middle Name</label>
                      <input type="text" value={editForm.legalMiddleName} onChange={(e) => setEditForm((p) => ({ ...p, legalMiddleName: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <p className="text-xs text-gray-400">Updates the provider&apos;s legal name as recorded in the system.</p>
                  </>
                )}

                {/* Tab 1: Identifiers */}
                {activeTab === 1 && (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">NPI</label>
                        <input type="text" value={editForm.npi} onChange={(e) => setEditForm((p) => ({ ...p, npi: e.target.value }))} maxLength={10} placeholder="10-digit NPI" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">DEA Number</label>
                        <input type="text" value={editForm.deaNumber} onChange={(e) => setEditForm((p) => ({ ...p, deaNumber: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">CAQH ID</label>
                        <input type="text" value={editForm.caqhId} onChange={(e) => setEditForm((p) => ({ ...p, caqhId: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">iCIMS ID</label>
                        <input type="text" value={editForm.icimsId} onChange={(e) => setEditForm((p) => ({ ...p, icimsId: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Medicare PTAN</label>
                        <input type="text" value={editForm.medicarePtan} onChange={(e) => setEditForm((p) => ({ ...p, medicarePtan: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Medicaid ID</label>
                        <input type="text" value={editForm.medicaidId} onChange={(e) => setEditForm((p) => ({ ...p, medicaidId: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      </div>
                    </div>
                  </>
                )}

                {/* Tab 2: Assignment & Notes */}
                {activeTab === 2 && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assigned Specialist</label>
                      <select value={editForm.assignedSpecialistId} onChange={(e) => setEditForm((p) => ({ ...p, assignedSpecialistId: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">— Unassigned —</option>
                        {staffUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Internal Notes</label>
                      <textarea value={editForm.notes} onChange={(e) => setEditForm((p) => ({ ...p, notes: e.target.value }))} rows={4} placeholder="Notes visible only to credentialing staff…" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 pb-5 flex gap-3">
                {activeTab > 0 && (
                  <button type="button" onClick={() => setActiveTab((t) => t - 1)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                    Back
                  </button>
                )}
                {activeTab < EDIT_TABS.length - 1 ? (
                  <button type="button" onClick={() => setActiveTab((t) => t + 1)} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Next: {EDIT_TABS[activeTab + 1]}
                  </button>
                ) : (
                  <button type="submit" disabled={updateProvider.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {updateProvider.isPending ? "Saving…" : "Save Changes"}
                  </button>
                )}
                <button type="button" onClick={() => setEditOpen(false)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Status Transition Reason Modal */}
      {reasonOpen && transitionTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">{REASON_REQUIRED[transitionTarget]}</h2>
            <p className="text-sm text-gray-500 mb-4">This reason will be recorded in the audit trail.</p>
            <form onSubmit={handleReasonSubmit} className="space-y-4">
              {transitionStatus.error && (
                <p className="text-sm text-red-600">{transitionStatus.error.message}</p>
              )}
              <div>
                <textarea
                  value={reasonText}
                  onChange={(e) => { setReasonText(e.target.value); setReasonError(""); }}
                  rows={3}
                  placeholder="Enter reason…"
                  className={`w-full border ${reasonError ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none`}
                />
                {reasonError && <p className="text-xs text-red-600 mt-0.5">{reasonError}</p>}
              </div>
              <div className="flex gap-3">
                <button type="submit" disabled={transitionStatus.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {transitionStatus.isPending ? "Saving…" : "Confirm"}
                </button>
                <button type="button" onClick={() => { setReasonOpen(false); setTransitionTarget(null); }} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
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
