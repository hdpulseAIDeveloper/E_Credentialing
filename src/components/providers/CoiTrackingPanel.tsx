"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { formatDate } from "@/lib/format-date";

type CoiStatusValue = "PENDING_OUTREACH" | "INFO_REQUESTED" | "SENT_TO_BROKER" | "OBTAINED";

const COI_STATUS_CONFIG: Record<CoiStatusValue, { label: string; color: string; next?: CoiStatusValue; nextLabel?: string }> = {
  PENDING_OUTREACH: { label: "Pending Outreach", color: "bg-yellow-100 text-yellow-700", next: "INFO_REQUESTED", nextLabel: "Mark Info Requested" },
  INFO_REQUESTED: { label: "Info Requested", color: "bg-blue-100 text-blue-700", next: "SENT_TO_BROKER", nextLabel: "Mark Sent to Broker" },
  SENT_TO_BROKER: { label: "Sent to Broker", color: "bg-purple-100 text-purple-700", next: "OBTAINED", nextLabel: "Mark COI Obtained" },
  OBTAINED: { label: "COI Obtained", color: "bg-green-100 text-green-700" },
};

interface Props {
  providerId: string;
  coiStatus: string | null;
  coiBrokerName: string | null;
  coiRequestedDate: string | null;
  coiObtainedDate: string | null;
  coiExpirationDate: string | null;
}

export function CoiTrackingPanel({ providerId, coiStatus, coiBrokerName, coiRequestedDate, coiObtainedDate, coiExpirationDate }: Props) {
  const router = useRouter();
  const [brokerName, setBrokerName] = useState(coiBrokerName ?? "");
  const [editingBroker, setEditingBroker] = useState(false);

  const updateCoi = api.provider.updateCoi.useMutation({
    onSuccess: () => { router.refresh(); setEditingBroker(false); },
  });

  const currentStatus: CoiStatusValue =
    (coiStatus as CoiStatusValue | null) ?? "PENDING_OUTREACH";
  const config = COI_STATUS_CONFIG[currentStatus] ?? COI_STATUS_CONFIG.PENDING_OUTREACH;

  const handleAdvance = () => {
    if (config.next) {
      updateCoi.mutate({
        providerId,
        coiStatus: config.next,
        coiBrokerName: brokerName || undefined,
        coiObtainedDate: config.next === "OBTAINED" ? new Date().toISOString() : undefined,
      });
    }
  };

  const handleInitiate = () => {
    updateCoi.mutate({
      providerId,
      coiStatus: "PENDING_OUTREACH",
      coiRequestedDate: new Date().toISOString(),
    });
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">COI / Malpractice Insurance</h3>
        {coiStatus && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.color}`}>
            {config.label}
          </span>
        )}
      </div>

      {!coiStatus ? (
        <div>
          <p className="text-sm text-gray-500 mb-2">COI tracking has not been initiated for this provider.</p>
          <button onClick={handleInitiate} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            Start COI Process
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 w-28">Broker:</span>
              {editingBroker ? (
                <div className="flex gap-2 flex-1">
                  <input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} className="border rounded px-2 py-1 text-sm flex-1" placeholder="Broker name" />
                  <button onClick={() => updateCoi.mutate({ providerId, coiBrokerName: brokerName })} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">Save</button>
                  <button onClick={() => setEditingBroker(false)} className="text-xs text-gray-500">Cancel</button>
                </div>
              ) : (
                <span className="cursor-pointer hover:text-blue-600" onClick={() => setEditingBroker(true)}>{coiBrokerName || "Click to set"}</span>
              )}
            </div>
            {coiRequestedDate && <div className="flex"><span className="text-gray-500 w-28">Requested:</span><span>{formatDate(coiRequestedDate)}</span></div>}
            {coiObtainedDate && <div className="flex"><span className="text-gray-500 w-28">Obtained:</span><span>{formatDate(coiObtainedDate)}</span></div>}
            {coiExpirationDate && <div className="flex"><span className="text-gray-500 w-28">Expires:</span><span>{formatDate(coiExpirationDate)}</span></div>}
          </div>

          {config.next && (
            <button onClick={handleAdvance} disabled={updateCoi.isPending} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
              {updateCoi.isPending ? "Updating..." : config.nextLabel}
            </button>
          )}
        </>
      )}
    </div>
  );
}
