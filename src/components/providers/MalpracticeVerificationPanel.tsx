"use client";

/**
 * Staff-facing panel for the malpractice carrier verification workflow.
 *
 * Lets credentialing specialists:
 *   • Initiate a new verification request to a carrier
 *   • Send / resend / remind via SendGrid
 *   • See live status (PENDING → SENT → REMINDER_SENT → RECEIVED)
 *   • View the carrier's reported coverage and threshold-comparison result
 */

import { useState } from "react";
import { api } from "@/trpc/react";

interface Props {
  providerId: string;
}

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  SENT: "bg-blue-100 text-blue-700",
  REMINDER_SENT: "bg-amber-100 text-amber-800",
  RECEIVED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-700",
  DECLINED: "bg-red-100 text-red-700",
};

export function MalpracticeVerificationPanel({ providerId }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [carrierName, setCarrierName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [expectedExpDate, setExpectedExpDate] = useState("");

  const utils = api.useUtils();
  const list = api.malpractice.listByProvider.useQuery({ providerId });

  const createMutation = api.malpractice.create.useMutation({
    onSuccess: async () => {
      setShowCreate(false);
      setCarrierName("");
      setContactName("");
      setContactEmail("");
      setPolicyNumber("");
      setExpectedExpDate("");
      await utils.malpractice.listByProvider.invalidate({ providerId });
    },
  });
  const sendMutation = api.malpractice.sendRequest.useMutation({
    onSuccess: () => utils.malpractice.listByProvider.invalidate({ providerId }),
  });
  const reminderMutation = api.malpractice.sendReminder.useMutation({
    onSuccess: () => utils.malpractice.listByProvider.invalidate({ providerId }),
  });
  const deleteMutation = api.malpractice.delete.useMutation({
    onSuccess: () => utils.malpractice.listByProvider.invalidate({ providerId }),
  });

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">
            Malpractice Coverage Verification
          </h3>
          <p className="text-[11px] text-gray-500">
            Carrier outreach + facility-minimum threshold check
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700"
          >
            + New verification
          </button>
        )}
      </div>

      {showCreate && (
        <div className="border rounded p-3 bg-gray-50 space-y-2">
          <input
            type="text"
            value={carrierName}
            onChange={(e) => setCarrierName(e.target.value)}
            placeholder="Carrier name (e.g., MLMIC, ProAssurance)"
            className="w-full border rounded px-2 py-1.5 text-sm"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Contact name"
              className="border rounded px-2 py-1.5 text-sm"
            />
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="Contact email"
              className="border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={policyNumber}
              onChange={(e) => setPolicyNumber(e.target.value)}
              placeholder="Policy number (if known)"
              className="border rounded px-2 py-1.5 text-sm"
            />
            <input
              type="date"
              value={expectedExpDate}
              onChange={(e) => setExpectedExpDate(e.target.value)}
              className="border rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                createMutation.mutate({
                  providerId,
                  carrierName,
                  contactName: contactName || undefined,
                  contactEmail: contactEmail || undefined,
                  policyNumber: policyNumber || undefined,
                  expectedExpDate: expectedExpDate
                    ? new Date(expectedExpDate)
                    : undefined,
                })
              }
              disabled={!carrierName || createMutation.isPending}
              className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {createMutation.isPending ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="text-xs text-gray-500 px-3 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {list.isLoading && (
          <p className="text-xs text-gray-500">Loading…</p>
        )}
        {list.data && list.data.length === 0 && !showCreate && (
          <p className="text-xs text-gray-500 italic">
            No carrier verifications yet.
          </p>
        )}
        {list.data?.map((row) => (
          <div
            key={row.id}
            className="border rounded p-2.5 text-sm space-y-1.5"
          >
            <div className="flex items-center justify-between">
              <div className="font-medium text-gray-900">{row.carrierName}</div>
              <span
                className={`text-[10px] uppercase tracking-wide font-medium px-2 py-0.5 rounded-full ${
                  STATUS_BADGE[row.status] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {row.status}
              </span>
            </div>
            <div className="text-xs text-gray-600 space-y-0.5">
              {row.contactEmail && <div>Contact: {row.contactEmail}</div>}
              {row.policyNumber && <div>Policy #: {row.policyNumber}</div>}
              {row.requestSentAt && (
                <div>
                  Sent: {new Date(row.requestSentAt).toLocaleDateString()}
                  {row.reminderCount > 0
                    ? ` · ${row.reminderCount} reminder(s)`
                    : ""}
                </div>
              )}
              {row.status === "RECEIVED" && (
                <div className="mt-1.5 p-2 rounded bg-gray-50 border text-[11px] space-y-0.5">
                  <div>
                    <span className="text-gray-500">Per-occurrence:</span>{" "}
                    <span className="font-medium">
                      {row.reportedPerOccurrenceLabel}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Aggregate:</span>{" "}
                    <span className="font-medium">
                      {row.reportedAggregateLabel}
                    </span>
                  </div>
                  {row.reportedExpirationDate && (
                    <div>
                      <span className="text-gray-500">Expires:</span>{" "}
                      <span className="font-medium">
                        {new Date(
                          row.reportedExpirationDate
                        ).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="pt-1">
                    Threshold:{" "}
                    {row.thresholdMet ? (
                      <span className="text-green-700 font-medium">
                        ✓ Meets minimum
                      </span>
                    ) : (
                      <span className="text-red-700 font-medium">
                        ✗ Below minimum / flagged
                      </span>
                    )}
                  </div>
                  {row.thresholdNotes && (
                    <div className="text-amber-700 whitespace-pre-line">
                      {row.thresholdNotes}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 pt-1">
              {row.status === "PENDING" && row.contactEmail && (
                <button
                  type="button"
                  onClick={() => sendMutation.mutate({ id: row.id })}
                  disabled={sendMutation.isPending}
                  className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Send request
                </button>
              )}
              {(row.status === "SENT" || row.status === "REMINDER_SENT") && (
                <button
                  type="button"
                  onClick={() => reminderMutation.mutate({ id: row.id })}
                  disabled={reminderMutation.isPending}
                  className="text-xs bg-amber-600 text-white px-2.5 py-1 rounded hover:bg-amber-700 disabled:opacity-50"
                >
                  Send reminder
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  if (
                    confirm(
                      `Delete carrier verification for ${row.carrierName}?`
                    )
                  ) {
                    deleteMutation.mutate({ id: row.id });
                  }
                }}
                className="text-xs text-red-600 hover:text-red-800 ml-auto"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
