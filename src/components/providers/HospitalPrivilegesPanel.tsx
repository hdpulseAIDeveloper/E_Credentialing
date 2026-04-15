"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

const STATUS_COLORS: Record<string, string> = {
  APPLIED: "bg-yellow-100 text-yellow-700",
  PENDING_REVIEW: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  DENIED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-500",
  REAPPOINTMENT_DUE: "bg-orange-100 text-orange-700",
};

interface HospitalPrivilege {
  id: string;
  facilityName: string;
  privilegeType: string;
  status: string;
  appliedDate: string | null;
  approvedDate: string | null;
  expirationDate: string | null;
  denialReason: string | null;
  notes: string | null;
}

interface Props {
  providerId: string;
  privileges: HospitalPrivilege[];
}

export function HospitalPrivilegesPanel({ providerId, privileges }: Props) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [msoNotes, setMsoNotes] = useState("");

  const updatePrivilege = api.provider.updateHospitalPrivilege.useMutation({
    onSuccess: () => { setEditingId(null); router.refresh(); },
  });

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Hospital Privileges</h3>
      </div>
      <div className="divide-y">
        {privileges.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No hospital privileges on file</div>
        ) : (
          privileges.map((hp) => (
            <div key={hp.id} className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-sm">{hp.facilityName}</div>
                  <div className="text-xs text-gray-500">{hp.privilegeType}</div>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${STATUS_COLORS[hp.status] ?? "bg-gray-100"}`}>
                  {hp.status.replace(/_/g, " ")}
                </span>
              </div>
              <div className="flex gap-4 text-xs text-gray-500">
                {hp.appliedDate && <span>Applied: {new Date(hp.appliedDate).toLocaleDateString()}</span>}
                {hp.approvedDate && <span>Approved: {new Date(hp.approvedDate).toLocaleDateString()}</span>}
                {hp.expirationDate && <span>Expires: {new Date(hp.expirationDate).toLocaleDateString()}</span>}
              </div>
              {hp.notes && <div className="text-xs text-gray-600 bg-gray-50 rounded p-2">{hp.notes}</div>}

              {editingId === hp.id ? (
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500">MSO Follow-Up Notes</label>
                    <input
                      value={msoNotes}
                      onChange={(e) => setMsoNotes(e.target.value)}
                      className="w-full border rounded px-2 py-1 text-xs"
                      placeholder="Contact details, follow-up date..."
                    />
                  </div>
                  <button
                    onClick={() => updatePrivilege.mutate({ id: hp.id, notes: msoNotes })}
                    className="text-xs bg-gray-800 text-white px-2 py-1 rounded"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-gray-400">Cancel</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  {hp.status === "APPLIED" && (
                    <button
                      onClick={() => updatePrivilege.mutate({ id: hp.id, status: "PENDING_REVIEW" })}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      Mark Under Review
                    </button>
                  )}
                  {hp.status === "PENDING_REVIEW" && (
                    <button
                      onClick={() => updatePrivilege.mutate({ id: hp.id, status: "APPROVED", approvedDate: new Date().toISOString() })}
                      className="text-xs text-green-600 hover:underline"
                    >
                      Mark Awarded
                    </button>
                  )}
                  <button
                    onClick={() => { setEditingId(hp.id); setMsoNotes(hp.notes ?? ""); }}
                    className="text-xs text-gray-500 hover:underline"
                  >
                    Add Follow-Up Note
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
