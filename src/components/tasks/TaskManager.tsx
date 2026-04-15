"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import type { Task, User } from "@prisma/client";

type TaskWithUser = Task & {
  assignedTo: Pick<User, "id" | "displayName">;
};

interface Staff {
  id: string;
  displayName: string;
}

interface Props {
  providerId: string;
  tasks: TaskWithUser[];
  staffUsers: Staff[];
}

const PRIORITY_STYLES: Record<string, string> = {
  HIGH: "bg-red-100 text-red-700",
  MEDIUM: "bg-yellow-100 text-yellow-700",
  LOW: "bg-gray-100 text-gray-600",
};

export function TaskManager({ providerId, tasks, staffUsers }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    assignedToId: staffUsers[0]?.id ?? "",
    priority: "MEDIUM" as "HIGH" | "MEDIUM" | "LOW",
    dueDate: "",
  });
  const [errors, setErrors] = useState<{ title?: string; assignedTo?: string }>({});

  const createTask = api.task.create.useMutation({
    onSuccess: () => {
      setAddOpen(false);
      setForm({ title: "", description: "", assignedToId: staffUsers[0]?.id ?? "", priority: "MEDIUM", dueDate: "" });
      router.refresh();
    },
  });

  const completeTask = api.task.update.useMutation({
    onSuccess: () => router.refresh(),
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (!form.assignedToId) errs.assignedTo = "Assignee is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    createTask.mutate({
      providerId,
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assignedToId: form.assignedToId,
      priority: form.priority,
      dueDate: form.dueDate || undefined,
    });
  };

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="font-semibold">Open Tasks</h3>
        <button
          onClick={() => setAddOpen(true)}
          className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Add Task
        </button>
      </div>

      <div className="divide-y">
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-gray-500">No open tasks</div>
        ) : (
          tasks.map((task) => (
            <div key={task.id} className="p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${PRIORITY_STYLES[task.priority]}`}>
                    {task.priority}
                  </span>
                  <span className="font-medium text-gray-900 truncate">{task.title}</span>
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {task.assignedTo.displayName}
                  {task.dueDate && (
                    <span className={task.dueDate < new Date() ? " · Due: text-red-600 font-medium" : ""}>
                      {" · Due: "}{new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
                )}
              </div>
              <button
                onClick={() => completeTask.mutate({ id: task.id, status: "COMPLETED" })}
                disabled={completeTask.isPending}
                className="flex-shrink-0 px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
              >
                Complete
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Task Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex justify-between items-center px-6 py-4 border-b">
              <h2 className="text-lg font-semibold text-gray-900">Add Task</h2>
              <button onClick={() => setAddOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>
            <form onSubmit={handleCreate} className="px-6 py-4 space-y-4">
              {createTask.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {createTask.error.message}
                </p>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => { setForm((p) => ({ ...p, title: e.target.value })); setErrors((p) => ({ ...p, title: undefined })); }}
                  placeholder="Task title"
                  className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.title ? "border-red-400" : "border-gray-300"}`}
                />
                {errors.title && <p className="text-xs text-red-600 mt-0.5">{errors.title}</p>}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={2}
                  placeholder="Optional details"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Assign To <span className="text-red-500">*</span></label>
                  <select
                    value={form.assignedToId}
                    onChange={(e) => { setForm((p) => ({ ...p, assignedToId: e.target.value })); setErrors((p) => ({ ...p, assignedTo: undefined })); }}
                    className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.assignedTo ? "border-red-400" : "border-gray-300"}`}
                  >
                    <option value="">— Select —</option>
                    {staffUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.displayName}</option>
                    ))}
                  </select>
                  {errors.assignedTo && <p className="text-xs text-red-600 mt-0.5">{errors.assignedTo}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as "HIGH" | "MEDIUM" | "LOW" }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="LOW">Low</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={createTask.isPending}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {createTask.isPending ? "Creating…" : "Create Task"}
                </button>
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
