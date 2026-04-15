"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import Link from "next/link";
import { EtinConfirmationModal } from "./EtinConfirmationModal";

const PATH_LABELS: Record<string, string> = {
  NEW_PSP: "New Enrollment (PSP)",
  REINSTATEMENT: "Reinstatement",
  AFFILIATION_UPDATE: "Affiliation Update",
};

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  IN_PROCESS: "bg-blue-100 text-blue-700",
  ENROLLED: "bg-green-100 text-green-700",
  REVALIDATION_DUE: "bg-orange-100 text-orange-700",
  EXPIRED: "bg-red-100 text-red-700",
};

interface Props {
  enrollment: any;
}

const STEPS_BY_PATH: Record<string, Array<{ key: string; label: string }>> = {
  NEW_PSP: [
    { key: "psp_register", label: "Provider Registers for PSP" },
    { key: "psp_login", label: "PSP Login Provided to Essen" },
    { key: "submission", label: "Enrollment Submitted via PSP" },
    { key: "followup", label: "Follow-Up with eMedNY" },
    { key: "enrolled", label: "Enrollment Complete" },
    { key: "group_affiliation", label: "Group Affiliation Updated" },
    { key: "etin", label: "ETIN Affiliation Confirmed" },
  ],
  REINSTATEMENT: [
    { key: "application", label: "Reinstatement Request Populated" },
    { key: "mailed", label: "Mailed to Provider for Signature" },
    { key: "signature", label: "Provider Signed & Returned" },
    { key: "submission", label: "Submitted to State" },
    { key: "followup", label: "Follow-Up with eMedNY" },
    { key: "enrolled", label: "Enrollment Complete" },
    { key: "etin", label: "ETIN Affiliation Confirmed" },
  ],
  AFFILIATION_UPDATE: [
    { key: "group_affiliation", label: "Group Affiliation Updated via PE Maintenance Portal" },
    { key: "etin", label: "ETIN Affiliation Process" },
    { key: "confirmed", label: "ETIN Confirmed & Tracked" },
  ],
};

function getCompletedSteps(enrollment: any): Set<string> {
  const completed = new Set<string>();
  const e = enrollment;

  if (e.pspRegistered) completed.add("psp_register");
  if (e.pspLoginProvided) completed.add("psp_login");
  if (e.applicationPopulatedAt) completed.add("application");
  if (e.providerSignatureRequired && e.providerSignatureReceivedAt) {
    completed.add("signature");
    completed.add("mailed");
  }
  if (e.submissionDate) { completed.add("submission"); completed.add("mailed"); }
  if (e.lastFollowUpDate) completed.add("followup");
  if (e.affiliationStatus === "ENROLLED" || e.enrollmentEffectiveDate) completed.add("enrolled");
  if (e.groupAffiliationUpdated) completed.add("group_affiliation");
  if (e.etinConfirmedDate) { completed.add("etin"); completed.add("confirmed"); }

  return completed;
}

export function MedicaidEnrollmentDetail({ enrollment: initialData }: Props) {
  const router = useRouter();
  const [showEtinModal, setShowEtinModal] = useState(false);
  const [followUpNote, setFollowUpNote] = useState("");

  const enrollment = initialData;
  const path = enrollment.enrollmentPath ?? "NEW_PSP";
  const steps = STEPS_BY_PATH[path] ?? STEPS_BY_PATH.NEW_PSP!;
  const completedSteps = getCompletedSteps(enrollment);

  const updatePsp = api.medicaid.updatePsp.useMutation({ onSuccess: () => router.refresh() });
  const recordSignature = api.medicaid.recordSignature.useMutation({ onSuccess: () => router.refresh() });
  const recordSubmission = api.medicaid.recordSubmission.useMutation({ onSuccess: () => router.refresh() });
  const addFollowUp = api.medicaid.addFollowUp.useMutation({ onSuccess: () => { setFollowUpNote(""); router.refresh(); } });
  const updateGroupAff = api.medicaid.updateGroupAffiliation.useMutation({ onSuccess: () => router.refresh() });
  const updateStatus = api.medicaid.updateStatus.useMutation({ onSuccess: () => router.refresh() });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/medicaid" className="text-sm text-blue-600 hover:underline">&larr; Back to NY Medicaid</Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">
            {enrollment.provider.legalFirstName} {enrollment.provider.legalLastName}
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-gray-500">{enrollment.provider.providerType?.name}</span>
            <span className="text-sm text-gray-400">NPI: {enrollment.provider.npi ?? "N/A"}</span>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[enrollment.affiliationStatus] ?? "bg-gray-100"}`}>
              {enrollment.affiliationStatus.replace(/_/g, " ")}
            </span>
          </div>
        </div>
        <div className="text-right text-sm">
          <div className="font-medium text-gray-700">{PATH_LABELS[path] ?? path}</div>
          {enrollment.etinNumber && <div className="text-gray-500 mt-1">ETIN: {enrollment.etinNumber}</div>}
        </div>
      </div>

      {/* Progress Tracker */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Enrollment Progress</h3>
        <div className="space-y-3">
          {steps.map((s, i) => {
            const done = completedSteps.has(s.key);
            const isCurrent = !done && (i === 0 || completedSteps.has(steps[i - 1]!.key));
            return (
              <div key={s.key} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  done ? "bg-green-500 text-white" : isCurrent ? "bg-blue-600 text-white ring-2 ring-blue-200" : "bg-gray-200 text-gray-400"
                }`}>
                  {done ? "\u2713" : i + 1}
                </div>
                <span className={`text-sm ${done ? "text-green-700 font-medium" : isCurrent ? "text-gray-900 font-medium" : "text-gray-400"}`}>
                  {s.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Panels */}
      <div className="grid grid-cols-2 gap-6">
        {/* Path-specific actions */}
        <div className="bg-white rounded-lg border p-6 space-y-4">
          <h3 className="font-semibold text-gray-900">Actions</h3>

          {path === "NEW_PSP" && !enrollment.pspRegistered && (
            <button onClick={() => updatePsp.mutate({ id: enrollment.id, pspRegistered: true })} className="w-full text-left bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm hover:bg-yellow-100">
              <div className="font-medium text-yellow-800">Mark PSP Registered</div>
              <div className="text-yellow-600 text-xs mt-1">Provider has registered for the Provider Services Portal</div>
            </button>
          )}

          {path === "NEW_PSP" && enrollment.pspRegistered && !enrollment.pspLoginProvided && (
            <button onClick={() => updatePsp.mutate({ id: enrollment.id, pspLoginProvided: true })} className="w-full text-left bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm hover:bg-yellow-100">
              <div className="font-medium text-yellow-800">Mark PSP Login Provided</div>
              <div className="text-yellow-600 text-xs mt-1">Provider has shared PSP credentials with Essen</div>
            </button>
          )}

          {path === "REINSTATEMENT" && !enrollment.providerSignatureReceivedAt && (
            <button onClick={() => recordSignature.mutate({ id: enrollment.id, signatureReceived: true })} className="w-full text-left bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm hover:bg-orange-100">
              <div className="font-medium text-orange-800">Mark Signature Received</div>
              <div className="text-orange-600 text-xs mt-1">Provider has signed and returned the reinstatement request</div>
            </button>
          )}

          {!enrollment.submissionDate && (
            <button onClick={() => recordSubmission.mutate({ id: enrollment.id })} className="w-full text-left bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm hover:bg-blue-100">
              <div className="font-medium text-blue-800">Record Submission</div>
              <div className="text-blue-600 text-xs mt-1">Mark enrollment as submitted to eMedNY</div>
            </button>
          )}

          {!enrollment.groupAffiliationUpdated && (
            <button onClick={() => updateGroupAff.mutate({ id: enrollment.id, groupAffiliationUpdated: true })} className="w-full text-left bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm hover:bg-purple-100">
              <div className="font-medium text-purple-800">Mark Group Affiliation Updated</div>
              <div className="text-purple-600 text-xs mt-1">Group affiliation has been updated via PE Maintenance Portal</div>
            </button>
          )}

          {!enrollment.etinConfirmedDate && (
            <button onClick={() => setShowEtinModal(true)} className="w-full text-left bg-green-50 border border-green-200 rounded-lg p-3 text-sm hover:bg-green-100">
              <div className="font-medium text-green-800">Confirm ETIN Affiliation</div>
              <div className="text-green-600 text-xs mt-1">Record ETIN number, expiration, and upload confirmation</div>
            </button>
          )}

          {enrollment.affiliationStatus !== "ENROLLED" && enrollment.etinConfirmedDate && (
            <button onClick={() => updateStatus.mutate({ id: enrollment.id, affiliationStatus: "ENROLLED" })} className="w-full text-left bg-green-50 border border-green-200 rounded-lg p-3 text-sm hover:bg-green-100">
              <div className="font-medium text-green-800">Mark as Enrolled</div>
            </button>
          )}
        </div>

        {/* Details & Follow-Up */}
        <div className="space-y-4">
          <div className="bg-white rounded-lg border p-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-gray-500">Subtype</dt><dd>{enrollment.enrollmentSubtype}</dd></div>
              <div className="flex justify-between"><dt className="text-gray-500">Payer</dt><dd>{enrollment.payer}</dd></div>
              {enrollment.submissionDate && <div className="flex justify-between"><dt className="text-gray-500">Submitted</dt><dd>{new Date(enrollment.submissionDate).toLocaleDateString()}</dd></div>}
              {enrollment.enrollmentEffectiveDate && <div className="flex justify-between"><dt className="text-gray-500">Effective</dt><dd>{new Date(enrollment.enrollmentEffectiveDate).toLocaleDateString()}</dd></div>}
              {enrollment.revalidationDueDate && <div className="flex justify-between"><dt className="text-gray-500">Revalidation Due</dt><dd>{new Date(enrollment.revalidationDueDate).toLocaleDateString()}</dd></div>}
              {enrollment.etinNumber && <div className="flex justify-between"><dt className="text-gray-500">ETIN</dt><dd className="font-mono">{enrollment.etinNumber}</dd></div>}
              {enrollment.etinExpirationDate && <div className="flex justify-between"><dt className="text-gray-500">ETIN Expires</dt><dd>{new Date(enrollment.etinExpirationDate).toLocaleDateString()}</dd></div>}
            </dl>
          </div>

          <div className="bg-white rounded-lg border p-6 space-y-3">
            <h3 className="font-semibold text-gray-900">Follow-Up</h3>
            <div className="flex gap-2">
              <input
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="Add follow-up note..."
                className="flex-1 border rounded px-3 py-1.5 text-sm"
              />
              <button
                onClick={() => followUpNote && addFollowUp.mutate({ id: enrollment.id, notes: followUpNote })}
                disabled={!followUpNote}
                className="bg-gray-800 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
              >
                Add
              </button>
            </div>
            {enrollment.notes && (
              <pre className="text-xs text-gray-600 bg-gray-50 rounded p-3 whitespace-pre-wrap max-h-48 overflow-y-auto">{enrollment.notes}</pre>
            )}
          </div>
        </div>
      </div>

      {showEtinModal && (
        <EtinConfirmationModal
          enrollmentId={enrollment.id}
          onClose={() => setShowEtinModal(false)}
          onSuccess={() => { setShowEtinModal(false); router.refresh(); }}
        />
      )}
    </div>
  );
}
