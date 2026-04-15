"use client";

import { useState } from "react";
import type { CommitteeDecision } from "@prisma/client";

interface Props {
  entryId: string;
  providerName: string;
  currentDecision?: CommitteeDecision | null;
  onDecision: (decision: {
    decision: CommitteeDecision;
    denialReason?: string;
    conditionalItems?: string;
    committeeNotes?: string;
  }) => void;
}

const DECISIONS: { value: CommitteeDecision; label: string; className: string }[] = [
  { value: "APPROVED", label: "Approve", className: "bg-green-600 hover:bg-green-700 text-white" },
  { value: "DENIED", label: "Deny", className: "bg-red-600 hover:bg-red-700 text-white" },
  { value: "DEFERRED", label: "Defer", className: "bg-yellow-500 hover:bg-yellow-600 text-white" },
  { value: "CONDITIONAL", label: "Conditional", className: "bg-blue-600 hover:bg-blue-700 text-white" },
];

export function DecisionPanel({ entryId, providerName, currentDecision, onDecision }: Props) {
  const [selectedDecision, setSelectedDecision] = useState<CommitteeDecision | null>(currentDecision ?? null);
  const [denialReason, setDenialReason] = useState("");
  const [conditionalItems, setConditionalItems] = useState("");
  const [committeeNotes, setCommitteeNotes] = useState("");

  const handleSubmit = () => {
    if (!selectedDecision) return;
    onDecision({
      decision: selectedDecision,
      denialReason: denialReason || undefined,
      conditionalItems: conditionalItems || undefined,
      committeeNotes: committeeNotes || undefined,
    });
  };

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <h3 className="font-semibold text-gray-900">Committee Decision — {providerName}</h3>

      {currentDecision && (
        <div className="text-sm text-gray-500 bg-gray-50 px-3 py-2 rounded">
          Current decision: <span className="font-medium">{currentDecision}</span>
        </div>
      )}

      {/* Decision Buttons */}
      <div className="flex gap-2">
        {DECISIONS.map((d) => (
          <button
            key={d.value}
            onClick={() => setSelectedDecision(d.value)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedDecision === d.value
                ? d.className + " ring-2 ring-offset-2 ring-current"
                : "border border-gray-300 text-gray-600 hover:bg-gray-50"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Conditional fields */}
      {(selectedDecision === "DENIED" || selectedDecision === "DEFERRED") && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {selectedDecision === "DENIED" ? "Reason for Denial" : "Reason for Deferral"} *
          </label>
          <textarea
            value={denialReason}
            onChange={(e) => setDenialReason(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="Provide reason..."
          />
        </div>
      )}

      {selectedDecision === "CONDITIONAL" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Outstanding Conditions *</label>
          <textarea
            value={conditionalItems}
            onChange={(e) => setConditionalItems(e.target.value)}
            rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm"
            placeholder="List conditions that must be met..."
          />
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Committee Notes</label>
        <textarea
          value={committeeNotes}
          onChange={(e) => setCommitteeNotes(e.target.value)}
          rows={2}
          className="w-full border rounded-lg px-3 py-2 text-sm"
          placeholder="Optional notes..."
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selectedDecision}
        className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        Record Decision
      </button>
    </div>
  );
}
