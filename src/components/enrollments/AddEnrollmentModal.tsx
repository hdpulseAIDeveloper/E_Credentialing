"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

type EnrollmentType = "DELEGATED" | "FACILITY_BTC" | "DIRECT";
type SubmissionMethod = "PORTAL_MPP" | "PORTAL_AVAILITY" | "PORTAL_VERITY" | "PORTAL_EYEMED" | "PORTAL_VNS" | "EMAIL" | "FTP";

const SUBMISSION_METHOD_LABELS: Record<SubmissionMethod, string> = {
  PORTAL_MPP: "Portal — My Practice Profile (UHC/Optum)",
  PORTAL_AVAILITY: "Portal — Availity (Anthem/Carelon)",
  PORTAL_VERITY: "Portal — Verity (Archcare)",
  PORTAL_EYEMED: "Portal — EyeMed",
  PORTAL_VNS: "Portal — VNS",
  EMAIL: "Email",
  FTP: "FTP",
};

interface Staff {
  id: string;
  displayName: string;
}

interface Props {
  providerId: string;
  staffUsers: Staff[];
}

const TABS = ["Payer Info", "Submission", "Assignment"];

export function AddEnrollmentModal({ providerId, staffUsers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState({
    payerName: "",
    enrollmentType: "DELEGATED" as EnrollmentType,
    submissionMethod: "PORTAL_AVAILITY" as SubmissionMethod,
    portalName: "",
    assignedToId: "",
    followUpCadenceDays: "14",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createEnrollment = api.enrollment.create.useMutation({
    onSuccess: () => {
      setOpen(false);
      resetForm();
      router.refresh();
    },
  });

  const resetForm = () => {
    setForm({
      payerName: "",
      enrollmentType: "DELEGATED",
      submissionMethod: "PORTAL_AVAILITY",
      portalName: "",
      assignedToId: "",
      followUpCadenceDays: "14",
    });
    setErrors({});
    setActiveTab(0);
  };

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.payerName.trim()) errs.payerName = "Payer name is required.";
    const cadence = parseInt(form.followUpCadenceDays);
    if (isNaN(cadence) || cadence < 1) errs.followUpCadenceDays = "Must be at least 1 day.";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.payerName) setActiveTab(0);
      else if (errs.followUpCadenceDays) setActiveTab(2);
      return;
    }
    createEnrollment.mutate({
      providerId,
      payerName: form.payerName.trim(),
      enrollmentType: form.enrollmentType,
      submissionMethod: form.submissionMethod,
      portalName: form.portalName.trim() || undefined,
      assignedToId: form.assignedToId || undefined,
      followUpCadenceDays: parseInt(form.followUpCadenceDays),
    });
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        + Add Enrollment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add Enrollment</h2>
              <button onClick={() => { setOpen(false); resetForm(); }} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            {/* Tabs */}
            <div className="flex border-b px-6">
              {TABS.map((tab, i) => (
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

            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 space-y-4 min-h-[200px]">
                {createEnrollment.error && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                    {createEnrollment.error.message}
                  </p>
                )}

                {/* Tab 0: Payer Info */}
                {activeTab === 0 && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Payer Name <span className="text-red-500">*</span></label>
                      <input
                        type="text"
                        value={form.payerName}
                        onChange={(e) => { setForm((p) => ({ ...p, payerName: e.target.value })); setErrors((p) => ({ ...p, payerName: "" })); }}
                        placeholder="e.g. Medicaid, UnitedHealthcare, Anthem"
                        className={`w-full border ${errors.payerName ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.payerName && <p className="text-xs text-red-600 mt-0.5">{errors.payerName}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Enrollment Type</label>
                      <select
                        value={form.enrollmentType}
                        onChange={(e) => setForm((p) => ({ ...p, enrollmentType: e.target.value as EnrollmentType }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="DELEGATED">Delegated</option>
                        <option value="FACILITY_BTC">Facility / BTC</option>
                        <option value="DIRECT">Direct</option>
                      </select>
                    </div>
                  </>
                )}

                {/* Tab 1: Submission */}
                {activeTab === 1 && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Submission Method</label>
                      <select
                        value={form.submissionMethod}
                        onChange={(e) => setForm((p) => ({ ...p, submissionMethod: e.target.value as SubmissionMethod }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {(Object.entries(SUBMISSION_METHOD_LABELS) as [SubmissionMethod, string][]).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Portal / Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                      <input
                        type="text"
                        value={form.portalName}
                        onChange={(e) => setForm((p) => ({ ...p, portalName: e.target.value }))}
                        placeholder="Portal name or additional submission notes"
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </>
                )}

                {/* Tab 2: Assignment */}
                {activeTab === 2 && (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Assign To <span className="text-gray-400 font-normal">(optional)</span></label>
                      <select
                        value={form.assignedToId}
                        onChange={(e) => setForm((p) => ({ ...p, assignedToId: e.target.value }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">— Unassigned —</option>
                        {staffUsers.map((u) => (
                          <option key={u.id} value={u.id}>{u.displayName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Follow-Up Cadence (days)</label>
                      <input
                        type="number"
                        min={1}
                        value={form.followUpCadenceDays}
                        onChange={(e) => { setForm((p) => ({ ...p, followUpCadenceDays: e.target.value })); setErrors((p) => ({ ...p, followUpCadenceDays: "" })); }}
                        className={`w-full border ${errors.followUpCadenceDays ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
                      />
                      {errors.followUpCadenceDays && <p className="text-xs text-red-600 mt-0.5">{errors.followUpCadenceDays}</p>}
                      <p className="text-xs text-gray-400 mt-1">How often to follow up with the payer (default: 14 days).</p>
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
                {activeTab < TABS.length - 1 ? (
                  <button type="button" onClick={() => setActiveTab((t) => t + 1)} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                    Next: {TABS[activeTab + 1]}
                  </button>
                ) : (
                  <button type="submit" disabled={createEnrollment.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                    {createEnrollment.isPending ? "Creating…" : "Create Enrollment"}
                  </button>
                )}
                <button type="button" onClick={() => { setOpen(false); resetForm(); }} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
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
