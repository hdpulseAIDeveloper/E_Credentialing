"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { Plus, Trash2, Copy, Pencil } from "lucide-react";

const CATEGORIES = [
  "general",
  "onboarding",
  "committee",
  "enrollment",
  "bots",
  "expirables",
  "sanctions",
  "medicaid",
  "npdb",
  "privileges",
] as const;

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
}

function CreateWorkflowModal({ open, onClose }: CreateModalProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const createMutation = api.admin.createWorkflow.useMutation({
    onSuccess: (data) => {
      router.push(`/admin/workflows/${data.id}`);
      router.refresh();
    },
  });

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Create Workflow</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g. Provider Onboarding Flow"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Optional description…"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim() || createMutation.isPending}
            onClick={() => createMutation.mutate({ name: name.trim(), description: description.trim() || undefined, category })}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {createMutation.isPending ? "Creating…" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateWorkflowButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
      >
        <Plus className="h-4 w-4" /> New Workflow
      </button>
      <CreateWorkflowModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

interface WorkflowCardActionsProps {
  workflowId: string;
  workflowName: string;
  isAdmin: boolean;
}

export function WorkflowCardActions({ workflowId, workflowName, isAdmin }: WorkflowCardActionsProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const deleteMutation = api.admin.deleteWorkflow.useMutation({
    onSuccess: () => router.refresh(),
  });

  const duplicateMutation = api.admin.createWorkflow.useMutation({
    onSuccess: (data) => {
      router.push(`/admin/workflows/${data.id}`);
      router.refresh();
    },
  });

  if (!isAdmin) return null;

  return (
    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => router.push(`/admin/workflows/${workflowId}`)}
        title="Edit"
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-blue-600"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => duplicateMutation.mutate({ name: `${workflowName} (copy)`, category: "general" })}
        title="Duplicate"
        className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-purple-600"
        disabled={duplicateMutation.isPending}
      >
        <Copy className="h-3.5 w-3.5" />
      </button>

      {confirmDelete ? (
        <span className="flex items-center gap-1 text-xs">
          <button
            onClick={() => deleteMutation.mutate({ id: workflowId })}
            className="rounded bg-red-600 px-2 py-0.5 text-white hover:bg-red-700"
            disabled={deleteMutation.isPending}
          >
            Confirm
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded border px-2 py-0.5 text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
        </span>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          title="Delete"
          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
