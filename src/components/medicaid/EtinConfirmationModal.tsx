"use client";

import { useState } from "react";
import { api } from "@/trpc/react";

interface Props {
  enrollmentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function EtinConfirmationModal({ enrollmentId, onClose, onSuccess }: Props) {
  const [etinNumber, setEtinNumber] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [docUrl, setDocUrl] = useState("");

  const confirmEtin = api.medicaid.confirmEtin.useMutation({
    onSuccess: () => onSuccess(),
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b">
          <h3 className="font-semibold text-lg">Confirm ETIN Affiliation</h3>
          <p className="text-sm text-gray-500 mt-1">Enter the ETIN details. This will also create an expirable tracking record.</p>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">ETIN Number</label>
            <input
              value={etinNumber}
              onChange={(e) => setEtinNumber(e.target.value)}
              placeholder="e.g., 123456"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Expiration Date</label>
            <input
              type="date"
              value={expirationDate}
              onChange={(e) => setExpirationDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmation Document URL (optional)</label>
            <input
              value={docUrl}
              onChange={(e) => setDocUrl(e.target.value)}
              placeholder="Blob storage URL or leave blank"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {confirmEtin.error && (
            <div className="text-sm text-red-600">{confirmEtin.error.message}</div>
          )}
        </div>
        <div className="px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
          <button
            onClick={() => {
              if (etinNumber && expirationDate) {
                confirmEtin.mutate({
                  id: enrollmentId,
                  etinNumber,
                  etinExpirationDate: expirationDate,
                  etinConfirmationDocUrl: docUrl || undefined,
                });
              }
            }}
            disabled={!etinNumber || !expirationDate || confirmEtin.isPending}
            className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
          >
            {confirmEtin.isPending ? "Confirming..." : "Confirm ETIN"}
          </button>
        </div>
      </div>
    </div>
  );
}
