"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface Provider {
  id: string;
  name: string;
  type: string;
  npi: string;
}

interface Props {
  providers: Provider[];
}

type Step = "provider" | "prior" | "active" | "confirm";
type Path = "NEW_PSP" | "REINSTATEMENT" | "AFFILIATION_UPDATE";

export function NewMedicaidEnrollmentWizard({ providers }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("provider");
  const [selectedProvider, setSelectedProvider] = useState<string>("");
  const [hasPriorEnrollment, setHasPriorEnrollment] = useState<boolean | null>(null);
  const [isPriorActive, setIsPriorActive] = useState<boolean | null>(null);
  const [subtype, setSubtype] = useState<"INDIVIDUAL" | "GROUP">("INDIVIDUAL");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const createMutation = api.medicaid.create.useMutation({
    onSuccess: (data) => {
      router.push(`/medicaid/${data.id}`);
    },
  });

  const determinedPath: Path | null =
    hasPriorEnrollment === false
      ? "NEW_PSP"
      : hasPriorEnrollment === true && isPriorActive === false
        ? "REINSTATEMENT"
        : hasPriorEnrollment === true && isPriorActive === true
          ? "AFFILIATION_UPDATE"
          : null;

  const pathDescriptions: Record<Path, { label: string; description: string }> = {
    NEW_PSP: {
      label: "New Enrollment (PSP)",
      description: "Provider has never enrolled in NY Medicaid. They must register for the Provider Services Portal (PSP), then Essen submits through the new PSP.",
    },
    REINSTATEMENT: {
      label: "Reinstatement / Reactivation",
      description: "Provider was previously enrolled but enrollment is inactive. A reinstatement request (physical paper) will be generated, mailed to the provider for signature, then submitted to the state.",
    },
    AFFILIATION_UPDATE: {
      label: "Affiliation Update",
      description: "Provider has an active NY Medicaid enrollment. Group affiliation will be updated via the NY PE Maintenance Portal, then ETIN affiliation process begins.",
    },
  };

  const handleSubmit = async () => {
    if (!selectedProvider || !determinedPath) return;
    setSubmitting(true);
    try {
      await createMutation.mutateAsync({
        providerId: selectedProvider,
        enrollmentSubtype: subtype,
        enrollmentPath: determinedPath,
        payer: "NY Medicaid",
        priorEnrollmentActive: isPriorActive ?? undefined,
        notes: notes || undefined,
      });
    } catch {
      setSubmitting(false);
    }
  };

  const selectedProviderObj = providers.find((p) => p.id === selectedProvider);

  return (
    <div className="bg-white rounded-lg border">
      {/* Progress Steps */}
      <div className="px-6 py-4 border-b">
        <div className="flex items-center gap-3 text-sm">
          {["Select Provider", "Prior Enrollment?", "Active?", "Confirm"].map((label, i) => {
            const stepNames: Step[] = ["provider", "prior", "active", "confirm"];
            const currentIdx = stepNames.indexOf(step);
            const isActive = i === currentIdx;
            const isComplete = i < currentIdx;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  isActive ? "bg-blue-600 text-white" : isComplete ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                }`}>
                  {isComplete ? "\u2713" : i + 1}
                </div>
                <span className={isActive ? "font-medium text-gray-900" : "text-gray-400"}>{label}</span>
                {i < 3 && <span className="text-gray-300 mx-1">&rarr;</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-6">
        {/* Step 1: Select Provider */}
        {step === "provider" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Select Provider</h3>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              <option value="">Choose a provider...</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.type}) — NPI: {p.npi || "N/A"}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700">Enrollment Subtype:</label>
              <select value={subtype} onChange={(e) => setSubtype(e.target.value as "INDIVIDUAL" | "GROUP")} className="border rounded px-2 py-1 text-sm">
                <option value="INDIVIDUAL">Individual</option>
                <option value="GROUP">Group</option>
              </select>
            </div>
            <button
              onClick={() => setStep("prior")}
              disabled={!selectedProvider}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next &rarr;
            </button>
          </div>
        )}

        {/* Step 2: Has Provider Enrolled in NY Medicaid Prior? */}
        {step === "prior" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Has this provider enrolled in NY Medicaid before?</h3>
            <p className="text-sm text-gray-500">
              Check eMedNY records or ask the provider if they have ever been enrolled in New York Medicaid.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => { setHasPriorEnrollment(true); setStep("active"); }}
                className="flex-1 border-2 rounded-lg p-4 text-left hover:border-blue-500 transition-colors"
              >
                <div className="font-semibold text-green-700">Yes</div>
                <div className="text-sm text-gray-500 mt-1">Provider has been enrolled in NY Medicaid previously</div>
              </button>
              <button
                onClick={() => { setHasPriorEnrollment(false); setIsPriorActive(null); setStep("confirm"); }}
                className="flex-1 border-2 rounded-lg p-4 text-left hover:border-blue-500 transition-colors"
              >
                <div className="font-semibold text-red-700">No</div>
                <div className="text-sm text-gray-500 mt-1">This is a brand new NY Medicaid enrollment</div>
              </button>
            </div>
            <button onClick={() => { setStep("provider"); setHasPriorEnrollment(null); }} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back</button>
          </div>
        )}

        {/* Step 3: Is the enrollment active? */}
        {step === "active" && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Is the NY Medicaid enrollment currently active?</h3>
            <p className="text-sm text-gray-500">
              Check eMedNY to determine if the provider&apos;s Medicaid enrollment is still active or has been deactivated/expired.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => { setIsPriorActive(true); setStep("confirm"); }}
                className="flex-1 border-2 rounded-lg p-4 text-left hover:border-blue-500 transition-colors"
              >
                <div className="font-semibold text-green-700">Yes, Active</div>
                <div className="text-sm text-gray-500 mt-1">Update group affiliation via PE Maintenance Portal</div>
              </button>
              <button
                onClick={() => { setIsPriorActive(false); setStep("confirm"); }}
                className="flex-1 border-2 rounded-lg p-4 text-left hover:border-blue-500 transition-colors"
              >
                <div className="font-semibold text-orange-700">No, Inactive</div>
                <div className="text-sm text-gray-500 mt-1">Reinstatement / reactivation request required</div>
              </button>
            </div>
            <button onClick={() => { setStep("prior"); setIsPriorActive(null); }} className="text-sm text-gray-500 hover:text-gray-700">&larr; Back</button>
          </div>
        )}

        {/* Step 4: Confirm */}
        {step === "confirm" && determinedPath && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Confirm Enrollment</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="font-semibold text-blue-800">{pathDescriptions[determinedPath].label}</div>
              <div className="text-sm text-blue-700 mt-1">{pathDescriptions[determinedPath].description}</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
              <div><span className="font-medium text-gray-700">Provider:</span> {selectedProviderObj?.name} ({selectedProviderObj?.type})</div>
              <div><span className="font-medium text-gray-700">NPI:</span> {selectedProviderObj?.npi || "N/A"}</div>
              <div><span className="font-medium text-gray-700">Subtype:</span> {subtype}</div>
              <div><span className="font-medium text-gray-700">Path:</span> {determinedPath}</div>
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes..."
              className="w-full border rounded-lg px-3 py-2 text-sm"
              rows={3}
            />
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setStep(hasPriorEnrollment ? "active" : "prior"); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                &larr; Back
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {submitting ? "Creating..." : "Create Enrollment"}
              </button>
            </div>
            {createMutation.error && (
              <div className="text-sm text-red-600">{createMutation.error.message}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
