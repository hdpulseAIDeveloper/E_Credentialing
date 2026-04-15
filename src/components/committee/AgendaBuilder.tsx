"use client";

import { useState } from "react";
import type { CommitteeProvider, Provider } from "@prisma/client";

type CommitteeProviderWithProvider = CommitteeProvider & {
  provider: Pick<Provider, "id" | "legalFirstName" | "legalLastName">;
};

interface Props {
  sessionId: string;
  entries: CommitteeProviderWithProvider[];
  onReorder: (entries: { entryId: string; agendaOrder: number }[]) => void;
}

export function AgendaBuilder({ sessionId, entries, onReorder }: Props) {
  const [localEntries, setLocalEntries] = useState(
    [...entries].sort((a, b) => a.agendaOrder - b.agendaOrder)
  );

  const moveUp = (index: number) => {
    if (index === 0) return;
    const newEntries = [...localEntries];
    [newEntries[index - 1], newEntries[index]] = [newEntries[index]!, newEntries[index - 1]!];
    setLocalEntries(newEntries);
    onReorder(newEntries.map((e, i) => ({ entryId: e.id, agendaOrder: i + 1 })));
  };

  const moveDown = (index: number) => {
    if (index === localEntries.length - 1) return;
    const newEntries = [...localEntries];
    [newEntries[index], newEntries[index + 1]] = [newEntries[index + 1]!, newEntries[index]!];
    setLocalEntries(newEntries);
    onReorder(newEntries.map((e, i) => ({ entryId: e.id, agendaOrder: i + 1 })));
  };

  return (
    <div className="space-y-2">
      {localEntries.map((entry, index) => (
        <div
          key={entry.id}
          className="flex items-center gap-3 bg-white rounded-lg border p-3"
        >
          <div className="text-sm font-bold text-gray-400 w-6">{index + 1}</div>
          <div className="flex-1">
            <div className="font-medium text-gray-900">
              {entry.provider.legalFirstName} {entry.provider.legalLastName}
            </div>
            {entry.decision && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                entry.decision === "APPROVED" ? "bg-green-100 text-green-700" :
                entry.decision === "DENIED" ? "bg-red-100 text-red-700" :
                "bg-yellow-100 text-yellow-700"
              }`}>
                {entry.decision}
              </span>
            )}
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => moveUp(index)}
              disabled={index === 0}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              ↑
            </button>
            <button
              onClick={() => moveDown(index)}
              disabled={index === localEntries.length - 1}
              className="p-1 rounded text-gray-400 hover:text-gray-600 disabled:opacity-30"
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
