"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function IcimsImportButton() {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [icimsId, setIcimsId] = useState("");

  const importMutation = api.provider.importFromIcims.useMutation({
    onSuccess: (data) => {
      setShowModal(false);
      router.push(`/providers/${data.id}`);
    },
  });

  return (
    <>
      <button onClick={() => setShowModal(true)} className="border border-gray-300 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-50">
        Import from iCIMS
      </button>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="px-6 py-4 border-b">
              <h3 className="font-semibold">Import Provider from iCIMS</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">iCIMS Person ID</label>
                <input value={icimsId} onChange={(e) => setIcimsId(e.target.value)} placeholder="e.g., IC-12345" className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              {importMutation.error && <div className="text-sm text-red-600">{importMutation.error.message}</div>}
            </div>
            <div className="px-6 py-4 border-t flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button
                onClick={() => icimsId && importMutation.mutate({ icimsId })}
                disabled={!icimsId || importMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {importMutation.isPending ? "Importing..." : "Import"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
