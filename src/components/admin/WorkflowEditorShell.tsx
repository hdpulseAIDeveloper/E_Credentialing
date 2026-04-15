"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { ExcalidrawEditor } from "@/components/admin/ExcalidrawEditor";
import { ArrowLeft, Check, X } from "lucide-react";

interface WorkflowData {
  id: string;
  name: string;
  description: string | null;
  category: string;
  sceneData: Record<string, unknown>;
  isPublished: boolean;
  updatedAt: string;
  creator: string;
}

interface WorkflowEditorShellProps {
  workflow: WorkflowData;
  isAdmin: boolean;
}

export function WorkflowEditorShell({ workflow, isAdmin }: WorkflowEditorShellProps) {
  const router = useRouter();
  const [name, setName] = useState(workflow.name);
  const [description, setDescription] = useState(workflow.description ?? "");
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);

  const saveMeta = api.admin.saveWorkflow.useMutation({
    onSuccess: () => router.refresh(),
  });

  const commitName = useCallback(() => {
    if (name.trim() && name !== workflow.name) {
      saveMeta.mutate({ id: workflow.id, name: name.trim() });
    }
    setEditingName(false);
  }, [name, workflow.id, workflow.name, saveMeta]);

  const commitDescription = useCallback(() => {
    const val = description.trim();
    if (val !== (workflow.description ?? "")) {
      saveMeta.mutate({ id: workflow.id, description: val || undefined });
    }
    setEditingDesc(false);
  }, [description, workflow.id, workflow.description, saveMeta]);

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col -mx-6 -mb-6">
      {/* Header */}
      <div className="flex items-center gap-3 border-b bg-white px-4 py-2">
        <button
          onClick={() => router.push("/admin/workflows")}
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          title="Back to workflows"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex-1 min-w-0">
          {editingName && isAdmin ? (
            <div className="flex items-center gap-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitName(); if (e.key === "Escape") { setName(workflow.name); setEditingName(false); } }}
                className="rounded border px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              <button onClick={commitName} className="rounded p-1 text-green-600 hover:bg-green-50"><Check className="h-4 w-4" /></button>
              <button onClick={() => { setName(workflow.name); setEditingName(false); }} className="rounded p-1 text-gray-400 hover:bg-gray-50"><X className="h-4 w-4" /></button>
            </div>
          ) : (
            <h2
              className={`text-sm font-semibold text-gray-900 truncate ${isAdmin ? "cursor-pointer hover:text-blue-600" : ""}`}
              onClick={() => isAdmin && setEditingName(true)}
              title={isAdmin ? "Click to rename" : undefined}
            >
              {name}
            </h2>
          )}

          {editingDesc && isAdmin ? (
            <div className="flex items-center gap-1 mt-0.5">
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") commitDescription(); if (e.key === "Escape") { setDescription(workflow.description ?? ""); setEditingDesc(false); } }}
                className="flex-1 rounded border px-2 py-0.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Add a description…"
                autoFocus
              />
              <button onClick={commitDescription} className="rounded p-0.5 text-green-600 hover:bg-green-50"><Check className="h-3.5 w-3.5" /></button>
              <button onClick={() => { setDescription(workflow.description ?? ""); setEditingDesc(false); }} className="rounded p-0.5 text-gray-400 hover:bg-gray-50"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <p
              className={`text-xs text-gray-500 truncate ${isAdmin ? "cursor-pointer hover:text-blue-600" : ""}`}
              onClick={() => isAdmin && setEditingDesc(true)}
              title={isAdmin ? "Click to edit description" : undefined}
            >
              {description || (isAdmin ? "Click to add description…" : "No description")}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span>by {workflow.creator}</span>
          <span>{new Date(workflow.updatedAt).toLocaleDateString()}</span>
          {!isAdmin && (
            <span className="rounded bg-yellow-100 px-2 py-0.5 text-yellow-700 font-medium">View Only</span>
          )}
        </div>
      </div>

      {/* Excalidraw Editor */}
      <div className="flex-1 min-h-0">
        <ExcalidrawEditor
          workflowId={workflow.id}
          initialData={workflow.sceneData}
          readOnly={!isAdmin}
        />
      </div>
    </div>
  );
}
