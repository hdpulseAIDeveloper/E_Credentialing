"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import type { MonitoringAlertStatus } from "@prisma/client";

export function MonitoringAlertActions({
  alertId,
  status,
}: {
  alertId: string;
  status: MonitoringAlertStatus;
}) {
  const router = useRouter();
  const [showResolve, setShowResolve] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const ack = api.monitoring.acknowledge.useMutation({
    onSuccess: () => router.refresh(),
  });
  const resolve = api.monitoring.resolve.useMutation({
    onSuccess: () => {
      setShowResolve(false);
      setNotes("");
      router.refresh();
    },
  });

  if (status === "RESOLVED" || status === "DISMISSED") {
    return <span className="text-xs text-gray-400">—</span>;
  }

  return (
    <div className="inline-flex items-center gap-1">
      {status === "OPEN" && (
        <button
          type="button"
          disabled={busy || ack.isPending}
          className="text-xs px-2 py-0.5 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              await ack.mutateAsync({ id: alertId });
            } finally {
              setBusy(false);
            }
          }}
        >
          {ack.isPending ? "…" : "Acknowledge"}
        </button>
      )}
      <button
        type="button"
        className="text-xs px-2 py-0.5 rounded bg-green-100 text-green-800 hover:bg-green-200"
        onClick={() => setShowResolve((v) => !v)}
      >
        Resolve
      </button>

      {showResolve && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-4 space-y-3">
            <h3 className="font-semibold text-gray-900">Resolve alert</h3>
            <p className="text-sm text-gray-600">
              Add a brief resolution note describing what action was taken
              (e.g., {`"verified license is now active after admin error"`}).
            </p>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full border rounded px-2 py-1 text-sm"
              placeholder="Resolution notes…"
            />
            <div className="flex justify-end gap-2 text-sm">
              <button
                type="button"
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
                onClick={() => {
                  setShowResolve(false);
                  setNotes("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={notes.trim().length < 1 || resolve.isPending}
                className="px-3 py-1 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-50"
                onClick={() =>
                  resolve.mutate({
                    id: alertId,
                    resolutionNotes: notes,
                    dismiss: true,
                  })
                }
              >
                Dismiss
              </button>
              <button
                type="button"
                disabled={notes.trim().length < 1 || resolve.isPending}
                className="px-3 py-1 rounded bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                onClick={() =>
                  resolve.mutate({
                    id: alertId,
                    resolutionNotes: notes,
                    dismiss: false,
                  })
                }
              >
                {resolve.isPending ? "Saving…" : "Resolve"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
