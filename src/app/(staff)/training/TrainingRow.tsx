"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface Props {
  assignmentId: string;
  contentUrl: string | null;
  status: string;
}

export function TrainingRow({ assignmentId, contentUrl, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [certificateUrl, setCertificateUrl] = useState("");
  const [scorePercent, setScorePercent] = useState<string>("");

  const record = api.training.recordCompletion.useMutation({
    onSuccess: () => {
      setOpen(false);
      setCertificateUrl("");
      setScorePercent("");
      router.refresh();
    },
  });

  if (status === "COMPLETED") {
    return (
      <span className="text-xs text-gray-500">Completed — see records</span>
    );
  }

  if (status === "WAIVED") {
    return <span className="text-xs text-gray-500">Waived by admin</span>;
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        {contentUrl && (
          <a
            href={contentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline px-2 py-1 border border-blue-200 rounded"
          >
            Open course
          </a>
        )}
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-2 py-1 rounded"
        >
          {open ? "Cancel" : "Mark complete"}
        </button>
      </div>
      {open && (
        <div className="bg-gray-50 border border-gray-200 rounded p-2 mt-1 w-72 space-y-2 text-left">
          <label className="block text-xs text-gray-600">
            Certificate URL (optional)
            <input
              type="url"
              value={certificateUrl}
              onChange={(e) => setCertificateUrl(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </label>
          <label className="block text-xs text-gray-600">
            Score % (optional)
            <input
              type="number"
              min={0}
              max={100}
              value={scorePercent}
              onChange={(e) => setScorePercent(e.target.value)}
              className="mt-1 w-full border border-gray-300 rounded px-2 py-1 text-xs"
            />
          </label>
          {record.error && (
            <p className="text-xs text-red-600">{record.error.message}</p>
          )}
          <button
            type="button"
            disabled={record.isPending}
            onClick={() =>
              record.mutate({
                assignmentId,
                certificateUrl: certificateUrl || null,
                scorePercent: scorePercent ? Number(scorePercent) : null,
              })
            }
            className="w-full text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded disabled:opacity-50"
          >
            {record.isPending ? "Saving…" : "Confirm completion"}
          </button>
        </div>
      )}
    </div>
  );
}
