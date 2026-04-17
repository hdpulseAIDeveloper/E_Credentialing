"use client";

/**
 * P3 Gap #23 — client actions for a compliance control.
 *
 * Lets staff update status / maturity, mark the control reviewed today,
 * attach evidence, and log new gaps without leaving the page.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import {
  ComplianceControlStatus,
  ComplianceControlMaturity,
  ComplianceEvidenceType,
  ComplianceGapSeverity,
} from "@prisma/client";

interface Props {
  control: {
    id: string;
    status: ComplianceControlStatus;
    maturity: ComplianceControlMaturity;
    notes: string;
  };
}

export function ControlActions({ control }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(control.status);
  const [maturity, setMaturity] = useState(control.maturity);
  const [notes, setNotes] = useState(control.notes);
  const [evidenceTitle, setEvidenceTitle] = useState("");
  const [evidenceType, setEvidenceType] = useState<ComplianceEvidenceType>("POLICY");
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [gapDesc, setGapDesc] = useState("");
  const [gapSeverity, setGapSeverity] = useState<ComplianceGapSeverity>("MODERATE");

  const updateControl = api.compliance.updateControl.useMutation({
    onSuccess: () => router.refresh(),
  });
  const addEvidence = api.compliance.addEvidence.useMutation({
    onSuccess: () => {
      setEvidenceTitle("");
      setEvidenceUrl("");
      router.refresh();
    },
  });
  const createGap = api.compliance.createGap.useMutation({
    onSuccess: () => {
      setGapDesc("");
      router.refresh();
    },
  });

  return (
    <section className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Manage</h2>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <label className="space-y-1">
          <div className="text-gray-600">Status</div>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as ComplianceControlStatus)}
          >
            {Object.values(ComplianceControlStatus).map((s) => (
              <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <div className="text-gray-600">Maturity</div>
          <select
            className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
            value={maturity}
            onChange={(e) => setMaturity(e.target.value as ComplianceControlMaturity)}
          >
            {Object.values(ComplianceControlMaturity).map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-xs space-y-1">
        <div className="text-gray-600">Notes</div>
        <textarea
          className="w-full border border-gray-300 rounded px-2 py-1 text-sm"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={updateControl.isPending}
          onClick={() =>
            updateControl.mutate({
              id: control.id,
              status,
              maturity,
              notes,
            })
          }
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {updateControl.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          disabled={updateControl.isPending}
          onClick={() =>
            updateControl.mutate({ id: control.id, markReviewed: true })
          }
          className="px-3 py-1.5 text-sm bg-gray-100 text-gray-800 rounded hover:bg-gray-200 disabled:opacity-50"
        >
          Mark reviewed today
        </button>
      </div>

      <hr className="border-gray-200" />

      <h3 className="text-xs font-semibold text-gray-700 uppercase">Add evidence</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={evidenceType}
          onChange={(e) => setEvidenceType(e.target.value as ComplianceEvidenceType)}
        >
          {Object.values(ComplianceEvidenceType).map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Title"
          value={evidenceTitle}
          onChange={(e) => setEvidenceTitle(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
        <input
          type="url"
          placeholder="https://… (optional)"
          value={evidenceUrl}
          onChange={(e) => setEvidenceUrl(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </div>
      <button
        type="button"
        disabled={addEvidence.isPending || !evidenceTitle}
        onClick={() =>
          addEvidence.mutate({
            controlId: control.id,
            type: evidenceType,
            title: evidenceTitle,
            url: evidenceUrl || undefined,
          })
        }
        className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
      >
        {addEvidence.isPending ? "Adding…" : "Add evidence"}
      </button>

      <hr className="border-gray-200" />

      <h3 className="text-xs font-semibold text-gray-700 uppercase">Log gap</h3>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <select
          className="border border-gray-300 rounded px-2 py-1 text-sm"
          value={gapSeverity}
          onChange={(e) => setGapSeverity(e.target.value as ComplianceGapSeverity)}
        >
          {Object.values(ComplianceGapSeverity).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Description"
          value={gapDesc}
          onChange={(e) => setGapDesc(e.target.value)}
          className="border border-gray-300 rounded px-2 py-1 text-sm col-span-2"
        />
      </div>
      <button
        type="button"
        disabled={createGap.isPending || gapDesc.length < 2}
        onClick={() =>
          createGap.mutate({
            controlId: control.id,
            description: gapDesc,
            severity: gapSeverity,
          })
        }
        className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
      >
        {createGap.isPending ? "Logging…" : "Log gap"}
      </button>
    </section>
  );
}
