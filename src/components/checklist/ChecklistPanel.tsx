"use client";

import type { ChecklistItem, Document } from "@prisma/client";
import { cn } from "@/lib/utils";

interface ChecklistItemWithDoc extends ChecklistItem {
  document: Document | null;
}

interface Props {
  providerId: string;
  providerTypeId: string;
  checklistItems: ChecklistItemWithDoc[];
}

const STATUS_CONFIG = {
  RECEIVED: { label: "Received", icon: "✓", className: "text-green-600 bg-green-50 border-green-200" },
  PENDING: { label: "Pending", icon: "○", className: "text-gray-400 bg-gray-50 border-gray-200" },
  NEEDS_ATTENTION: { label: "Needs Attention", icon: "!", className: "text-red-600 bg-red-50 border-red-200" },
};

export function ChecklistPanel({ providerId, checklistItems }: Props) {
  const received = checklistItems.filter((i) => i.status === "RECEIVED").length;
  const total = checklistItems.length;
  const pct = total > 0 ? Math.round((received / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-white rounded-lg border p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Document Checklist</span>
          <span className="text-gray-500">{received} / {total} received ({pct}%)</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full">
          <div
            className="h-2 bg-blue-600 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-white rounded-lg border divide-y">
        {checklistItems.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No checklist items configured</div>
        ) : (
          checklistItems.map((item) => {
            const config = STATUS_CONFIG[item.status];
            return (
              <div key={item.id} className={cn("flex items-center justify-between p-4 border-l-4", config.className)}>
                <div className="flex items-center gap-3">
                  <span className="text-lg">{config.icon}</span>
                  <div>
                    <div className="font-medium text-sm text-gray-900">
                      {item.documentType.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase())}
                    </div>
                    {item.flagReason && (
                      <div className="text-xs text-red-600 mt-0.5">{item.flagReason}</div>
                    )}
                    {item.document && (
                      <div className="text-xs text-gray-400 mt-0.5">
                        {item.document.originalFilename}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", config.className)}>
                    {config.label}
                  </span>
                  {item.document?.blobUrl && (
                    <a
                      href={item.document.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:underline"
                    >
                      View
                    </a>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
