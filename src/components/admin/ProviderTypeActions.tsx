"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface ProviderType {
  id: string;
  name: string;
  abbreviation: string;
  isActive: boolean;
  requiresDea: boolean;
  requiresBoards: boolean;
  requiresEcfmg: boolean;
  boardType: string | null;
}

interface EditModalProps {
  providerType: ProviderType;
  onClose: () => void;
}

function EditProviderTypeModal({ providerType, onClose }: EditModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: providerType.name,
    requiresDea: providerType.requiresDea,
    requiresBoards: providerType.requiresBoards,
    requiresEcfmg: providerType.requiresEcfmg,
    boardType: providerType.boardType ?? "",
  });

  const updatePt = api.admin.updateProviderType.useMutation({
    onSuccess: () => { onClose(); router.refresh(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Edit Provider Type</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updatePt.mutate({
              id: providerType.id,
              name: form.name || undefined,
              requiresDea: form.requiresDea,
              requiresBoards: form.requiresBoards,
              requiresEcfmg: form.requiresEcfmg,
              boardType: form.boardType || null,
            });
          }}
          className="px-6 py-4 space-y-4"
        >
          {updatePt.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{updatePt.error.message}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Board Type</label>
            <input type="text" value={form.boardType} onChange={(e) => setForm((p) => ({ ...p, boardType: e.target.value }))}
              placeholder="e.g. ABIM, ABFM, NCCPA"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresDea} onChange={(e) => setForm((p) => ({ ...p, requiresDea: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Requires DEA Number</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresBoards} onChange={(e) => setForm((p) => ({ ...p, requiresBoards: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Requires Board Certification</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresEcfmg} onChange={(e) => setForm((p) => ({ ...p, requiresEcfmg: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Requires ECFMG Certificate</span>
            </label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={updatePt.isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {updatePt.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AddProviderTypeModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    abbreviation: "",
    requiresDea: false,
    requiresBoards: false,
    requiresEcfmg: false,
    boardType: "",
  });

  const createPt = api.admin.createProviderType.useMutation({
    onSuccess: () => { onClose(); router.refresh(); },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Add Provider Type</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createPt.mutate({
              name: form.name,
              abbreviation: form.abbreviation,
              requiresDea: form.requiresDea,
              requiresBoards: form.requiresBoards,
              requiresEcfmg: form.requiresEcfmg,
              boardType: form.boardType || undefined,
            });
          }}
          className="px-6 py-4 space-y-4"
        >
          {createPt.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{createPt.error.message}</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Physician Assistant"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Abbreviation <span className="text-red-500">*</span></label>
            <input type="text" value={form.abbreviation} onChange={(e) => setForm((p) => ({ ...p, abbreviation: e.target.value }))}
              placeholder="e.g. PA"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Board Type</label>
            <input type="text" value={form.boardType} onChange={(e) => setForm((p) => ({ ...p, boardType: e.target.value }))}
              placeholder="e.g. NCCPA"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresDea} onChange={(e) => setForm((p) => ({ ...p, requiresDea: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Requires DEA Number</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresBoards} onChange={(e) => setForm((p) => ({ ...p, requiresBoards: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Requires Board Certification</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={form.requiresEcfmg} onChange={(e) => setForm((p) => ({ ...p, requiresEcfmg: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
              <span className="text-sm text-gray-700">Requires ECFMG Certificate</span>
            </label>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="submit" disabled={createPt.isPending || !form.name || !form.abbreviation}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {createPt.isPending ? "Creating…" : "Create"}
            </button>
            <button type="button" onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function ProviderTypeActions({ providerType }: { providerType: ProviderType }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);

  const toggleActive = api.admin.updateProviderType.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <>
      <div className="flex gap-2">
        <button onClick={() => setEditOpen(true)} className="text-xs text-blue-600 hover:underline">Edit</button>
        <button
          onClick={() => toggleActive.mutate({ id: providerType.id, isActive: !providerType.isActive })}
          disabled={toggleActive.isPending}
          className={`text-xs hover:underline disabled:opacity-50 ${providerType.isActive ? "text-red-600" : "text-green-600"}`}
        >
          {providerType.isActive ? "Deactivate" : "Activate"}
        </button>
      </div>
      {editOpen && <EditProviderTypeModal providerType={providerType} onClose={() => setEditOpen(false)} />}
    </>
  );
}

export function AddProviderTypeButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors">
        + Add Provider Type
      </button>
      {open && <AddProviderTypeModal onClose={() => setOpen(false)} />}
    </>
  );
}
