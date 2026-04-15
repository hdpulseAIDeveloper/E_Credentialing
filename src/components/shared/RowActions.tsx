"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2, Bot } from "lucide-react";

interface RowActionsProps {
  viewHref?: string;
  editHref?: string;
  botsHref?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteLabel?: string;
  deleteConfirmMessage?: string;
  isDeleting?: boolean;
}

export function RowActions({
  viewHref,
  editHref,
  botsHref,
  onEdit,
  onDelete,
  deleteLabel = "Delete",
  deleteConfirmMessage = "Are you sure? This action cannot be undone.",
  isDeleting = false,
}: RowActionsProps) {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-1">
        {viewHref && (
          <button
            onClick={() => router.push(viewHref)}
            title="View"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        )}
        {(editHref || onEdit) && (
          <button
            onClick={() => {
              if (onEdit) onEdit();
              else if (editHref) router.push(editHref);
            }}
            title="Edit"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        {botsHref && (
          <button
            onClick={() => router.push(botsHref)}
            title="Bots"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <Bot className="h-3.5 w-3.5" />
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => setConfirmOpen(true)}
            title={deleteLabel}
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Confirm {deleteLabel}</h3>
            <p className="text-sm text-gray-600 mb-6">{deleteConfirmMessage}</p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onDelete?.();
                  setConfirmOpen(false);
                }}
                disabled={isDeleting}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {isDeleting ? "Processing…" : deleteLabel}
              </button>
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
