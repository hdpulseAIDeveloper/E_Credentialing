"use client";

import { useState } from "react";
import { api } from "@/trpc/react";
import { formatDate } from "@/lib/format-date";

interface Props {
  sessionId: string;
  providerIds: string[];
  agendaVersion: number | null;
  agendaSentAt: string | null;
}

export function CommitteePdfActions({ sessionId, providerIds, agendaVersion, agendaSentAt }: Props) {
  const [generatedHtml, setGeneratedHtml] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const generateAgenda = api.committee.generateAgenda.useMutation({
    onSuccess: (data) => {
      setGeneratedHtml(data.html);
      setShowPreview(true);
    },
  });

  const sendAgenda = api.committee.sendAgenda.useMutation();

  const generateSummary = api.committee.generateSummary.useMutation({
    onSuccess: (data) => {
      setGeneratedHtml(data.html);
      setShowPreview(true);
    },
  });

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-sm text-gray-700">PDF Generation</h3>

      <button
        onClick={() => generateAgenda.mutate({ sessionId })}
        disabled={generateAgenda.isPending}
        className="w-full text-left text-sm bg-blue-50 border border-blue-200 rounded px-3 py-2 hover:bg-blue-100 disabled:opacity-50"
      >
        {generateAgenda.isPending ? "Generating..." : "Generate Agenda PDF"}
        {agendaVersion && <span className="text-xs text-blue-500 ml-2">v{agendaVersion}</span>}
      </button>

      <button
        onClick={() => sendAgenda.mutate({ sessionId })}
        disabled={sendAgenda.isPending}
        className="w-full text-left text-sm bg-purple-50 border border-purple-200 rounded px-3 py-2 hover:bg-purple-100 disabled:opacity-50"
      >
        {sendAgenda.isPending ? "Sending..." : "Send Agenda to Committee"}
        {agendaSentAt && <span className="text-xs text-purple-500 ml-2">Last sent: {formatDate(agendaSentAt)}</span>}
      </button>

      {sendAgenda.data && (
        <div className="text-xs text-green-600">Agenda sent to {sendAgenda.data.sent} committee members</div>
      )}

      {providerIds.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-500 font-medium">Per-Provider Summary:</div>
          {providerIds.map((pid) => (
            <button
              key={pid}
              onClick={() => generateSummary.mutate({ providerId: pid, sessionId })}
              disabled={generateSummary.isPending}
              className="w-full text-left text-xs bg-gray-50 border rounded px-2 py-1 hover:bg-gray-100 disabled:opacity-50 truncate"
            >
              Generate Summary ({pid.slice(0, 8)}...)
            </button>
          ))}
        </div>
      )}

      {showPreview && generatedHtml && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <h3 className="font-semibold">Preview</h3>
              <button onClick={() => setShowPreview(false)} className="text-gray-400 hover:text-gray-600">Close</button>
            </div>
            <div className="overflow-auto p-6 flex-1" dangerouslySetInnerHTML={{ __html: generatedHtml }} />
          </div>
        </div>
      )}
    </div>
  );
}
