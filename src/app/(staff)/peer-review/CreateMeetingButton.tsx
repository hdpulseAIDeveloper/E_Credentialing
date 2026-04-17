"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function CreateMeetingButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [meetingDate, setMeetingDate] = useState(() => {
    const d = new Date();
    d.setHours(15, 0, 0, 0);
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 16);
  });
  const [facilityName, setFacilityName] = useState("");
  const [agendaUrl, setAgendaUrl] = useState("");
  const [notes, setNotes] = useState("");

  const create = api.peerReview.createMeeting.useMutation({
    onSuccess: (m: { id: string }) => {
      setOpen(false);
      router.push(`/peer-review/${m.id}`);
      router.refresh();
    },
  });

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded shadow-sm"
      >
        Schedule meeting
      </button>
    );
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm w-96 space-y-3">
      <h3 className="font-semibold text-sm">Schedule peer-review meeting</h3>
      <label className="block text-xs text-gray-600">
        Meeting date / time
        <input
          type="datetime-local"
          value={meetingDate}
          onChange={(e) => setMeetingDate(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Facility (optional)
        <input
          type="text"
          value={facilityName}
          onChange={(e) => setFacilityName(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Agenda URL (optional)
        <input
          type="url"
          value={agendaUrl}
          onChange={(e) => setAgendaUrl(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
        />
      </label>
      <label className="block text-xs text-gray-600">
        Notes (optional)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-sm"
          rows={3}
        />
      </label>
      {create.error && (
        <p className="text-xs text-red-600">{create.error.message}</p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="text-xs text-gray-600 px-2 py-1"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={create.isPending}
          onClick={() =>
            create.mutate({
              meetingDate: new Date(meetingDate).toISOString(),
              facilityName: facilityName || null,
              agendaUrl: agendaUrl || null,
              notes: notes || null,
            })
          }
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded disabled:opacity-50"
        >
          {create.isPending ? "Saving…" : "Schedule"}
        </button>
      </div>
    </div>
  );
}
