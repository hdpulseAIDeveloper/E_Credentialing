"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

const MEETING_STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-700" },
  SCHEDULED: { label: "Scheduled", color: "bg-blue-100 text-blue-700" },
  COMPLETED: { label: "Completed", color: "bg-green-100 text-green-700" },
};

interface Props {
  providerId: string;
  meetingStatus: string | null;
  meetingDate: string | null;
  meetingNotes: string | null;
}

export function OnsiteMeetingPanel({ providerId, meetingStatus, meetingDate, meetingNotes }: Props) {
  const router = useRouter();
  const [date, setDate] = useState(meetingDate?.split("T")[0] ?? "");
  const [notes, setNotes] = useState(meetingNotes ?? "");

  const updateMeeting = api.provider.updateOnsiteMeeting.useMutation({
    onSuccess: () => router.refresh(),
  });

  const config = MEETING_STATUS_CONFIG[meetingStatus ?? ""] ?? null;

  const handleSchedule = () => {
    updateMeeting.mutate({
      providerId,
      onsiteMeetingStatus: "SCHEDULED",
      onsiteMeetingDate: date || undefined,
      onsiteMeetingNotes: notes || undefined,
    });
  };

  const handleComplete = () => {
    updateMeeting.mutate({
      providerId,
      onsiteMeetingStatus: "COMPLETED",
      onsiteMeetingNotes: notes || undefined,
    });
  };

  const handleInitiate = () => {
    updateMeeting.mutate({
      providerId,
      onsiteMeetingStatus: "PENDING",
    });
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Onsite Meeting</h3>
        {config && (
          <span className={`text-xs font-medium px-2 py-1 rounded-full ${config.color}`}>{config.label}</span>
        )}
      </div>

      {!meetingStatus ? (
        <div>
          <p className="text-sm text-gray-500 mb-2">No onsite meeting scheduled.</p>
          <button onClick={handleInitiate} className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700">
            Schedule Meeting
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Meeting Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="border rounded px-2 py-1 text-sm w-full" rows={2} placeholder="Meeting notes..." />
          </div>
          <div className="flex gap-2">
            {meetingStatus === "PENDING" && (
              <button onClick={handleSchedule} disabled={updateMeeting.isPending} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50">
                {date ? "Confirm Schedule" : "Save Notes"}
              </button>
            )}
            {meetingStatus === "SCHEDULED" && (
              <button onClick={handleComplete} disabled={updateMeeting.isPending} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 disabled:opacity-50">
                Mark Completed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
