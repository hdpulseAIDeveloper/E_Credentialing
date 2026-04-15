"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

interface Props {
  enrollments: Array<{
    id: string;
    payerName: string;
    enrollmentType: string;
    status: string;
    provider?: { legalFirstName: string; legalLastName: string };
  }>;
}

export function RosterGenerationPanel({ enrollments }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [generatedCsv, setGeneratedCsv] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>("");

  const generateRoster = api.enrollment.generateRoster.useMutation({
    onSuccess: (data) => {
      setGeneratedCsv(data.csv);
      setFilename(data.filename);
    },
  });

  const uploadSftp = api.enrollment.uploadRosterSftp.useMutation();
  const pushEcw = api.enrollment.pushToEcw.useMutation();

  const toggleSelection = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const enrolledItems = enrollments.filter((e) => e.status === "ENROLLED");

  const handleDownload = () => {
    if (!generatedCsv) return;
    const blob = new Blob([generatedCsv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Roster Generation</h3>
        <span className="text-xs text-gray-400">{selected.size} selected</span>
      </div>

      <div className="max-h-48 overflow-y-auto space-y-1">
        {enrolledItems.length === 0 ? (
          <p className="text-sm text-gray-400">No enrolled records to generate roster from.</p>
        ) : (
          enrolledItems.map((e) => (
            <label key={e.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggleSelection(e.id)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <span className="font-medium">{e.payerName}</span>
              <span className="text-gray-400">({e.enrollmentType})</span>
            </label>
          ))
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => generateRoster.mutate({ enrollmentIds: Array.from(selected) })}
          disabled={selected.size === 0 || generateRoster.isPending}
          className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
        >
          {generateRoster.isPending ? "Generating..." : "Generate CSV"}
        </button>

        {generatedCsv && (
          <>
            <button onClick={handleDownload} className="text-xs bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700">
              Download {filename}
            </button>
            <button
              onClick={() => uploadSftp.mutate({ csv: generatedCsv, filename, payerName: "Delegated" })}
              disabled={uploadSftp.isPending}
              className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded hover:bg-purple-700 disabled:opacity-50"
            >
              {uploadSftp.isPending ? "Uploading..." : "Upload SFTP"}
            </button>
          </>
        )}
      </div>

      {uploadSftp.data && (
        <div className="text-xs text-green-600">{uploadSftp.data.message}</div>
      )}

      <div className="border-t pt-3 mt-3">
        <h4 className="text-xs font-medium text-gray-500 mb-2">eCW/RCM Push</h4>
        <div className="space-y-1">
          {enrolledItems.slice(0, 5).map((e) => (
            <div key={e.id} className="flex items-center justify-between text-xs">
              <span>{e.payerName}</span>
              <button
                onClick={() => pushEcw.mutate({ enrollmentId: e.id })}
                className="text-blue-600 hover:underline"
              >
                Push to eCW
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
