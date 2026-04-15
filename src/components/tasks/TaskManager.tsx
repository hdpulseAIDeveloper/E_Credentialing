"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import type { Task, User } from "@prisma/client";

type TaskWithUser = Task & {
  assignedTo: Pick<User, "id" | "displayName"> | null;
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

const TASK_TABS = ["Task Details", "Assignment & Schedule"];

interface TaskFormState {
  title: string;
  description: string;
  assignedToId: string;
  priority: "HIGH" | "MEDIUM" | "LOW";
  status: "OPEN" | "IN_PROGRESS" | "BLOCKED";
  dueDate: string;
}

interface TaskFormModalProps {
  title: string;
  initialForm: TaskFormState;
  staffUsers: Staff[];
  isPending: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (form: TaskFormState) => void;
  onClose: () => void;
  showStatus?: boolean;
}

function TaskFormModal({ title, initialForm, staffUsers, isPending, error, submitLabel, onSubmit, onClose, showStatus }: TaskFormModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [form, setForm] = useState<TaskFormState>(initialForm);
  const [errors, setErrors] = useState<{ title?: string; assignedTo?: string }>({});

  const validate = () => {
    const errs: typeof errors = {};
    if (!form.title.trim()) errs.title = "Title is required.";
    if (!form.assignedToId) errs.assignedTo = "Assignee is required.";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      if (errs.title) setActiveTab(0);
      else if (errs.assignedTo) setActiveTab(1);
      return;
    }
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>

        {/* Tabs */}
        <div className="flex border-b px-6">
          {TASK_TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={`py-2 px-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === i ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4 min-h-[200px]">
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">{error}</p>
            )}

            {/* Tab 0: Task Details */}
            {activeTab === 0 && (
              <>
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
                    rows={3}
                    placeholder="Optional details about this task…"
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </>
            )}

            {/* Tab 1: Assignment & Schedule */}
            {activeTab === 1 && (
              <>
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
                <div className="grid grid-cols-2 gap-3">
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
                  {showStatus && (
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                      <select
                        value={form.status}
                        onChange={(e) => setForm((p) => ({ ...p, status: e.target.value as "OPEN" | "IN_PROGRESS" | "BLOCKED" }))}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="OPEN">Open</option>
                        <option value="IN_PROGRESS">In Progress</option>
                        <option value="BLOCKED">Blocked</option>
                      </select>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Due Date <span className="text-gray-400 font-normal">(optional)</span></label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </>
            )}
          </div>

          <div className="px-6 pb-5 flex gap-3">
            {activeTab > 0 && (
              <button type="button" onClick={() => setActiveTab((t) => t - 1)} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                Back
              </button>
            )}
            {activeTab < TASK_TABS.length - 1 ? (
              <button type="button" onClick={() => setActiveTab((t) => t + 1)} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors">
                Next: {TASK_TABS[activeTab + 1]}
              </button>
            ) : (
              <button type="submit" disabled={isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {isPending ? "Saving…" : submitLabel}
              </button>
            )}
            <button type="button" onClick={onClose} className="px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TaskManager({ providerId, tasks, staffUsers }: Props) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskWithUser | null>(null);

  const createTask = api.task.create.useMutation({
    onSuccess: () => {
      setAddOpen(false);
      router.refresh();
    },
  });

  const updateTask = api.task.update.useMutation({
    onSuccess: () => {
      setEditingTask(null);
      router.refresh();
    },
  });

  const completeTask = api.task.update.useMutation({
    onSuccess: () => router.refresh(),
  });

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
                  {task.assignedTo?.displayName ?? "Unassigned"}
                  {task.dueDate && (
                    <span className={new Date(task.dueDate) < new Date() ? " · text-red-600 font-medium" : ""}>
                      {" · Due: "}{new Date(task.dueDate).toLocaleDateString()}
                    </span>
                  )}
                  {task.status !== "OPEN" && (
                    <span className="ml-2 text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{task.status.replace("_", " ")}</span>
                  )}
                </div>
                {task.description && (
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{task.description}</p>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setEditingTask(task)}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Edit
                </button>
                <button
                  onClick={() => completeTask.mutate({ id: task.id, status: "COMPLETED" })}
                  disabled={completeTask.isPending}
                  className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50"
                >
                  Complete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Task Modal */}
      {addOpen && (
        <TaskFormModal
          title="Add Task"
          initialForm={{
            title: "",
            description: "",
            assignedToId: staffUsers[0]?.id ?? "",
            priority: "MEDIUM",
            status: "OPEN",
            dueDate: "",
          }}
          staffUsers={staffUsers}
          isPending={createTask.isPending}
          error={createTask.error?.message ?? null}
          submitLabel="Create Task"
          showStatus={false}
          onSubmit={(form) => {
            createTask.mutate({
              providerId,
              title: form.title.trim(),
              description: form.description.trim() || undefined,
              assignedToId: form.assignedToId,
              priority: form.priority,
              dueDate: form.dueDate || undefined,
            });
          }}
          onClose={() => setAddOpen(false)}
        />
      )}

      {/* Edit Task Modal */}
      {editingTask && (
        <TaskFormModal
          title="Edit Task"
          initialForm={{
            title: editingTask.title,
            description: editingTask.description ?? "",
            assignedToId: editingTask.assignedTo?.id ?? "",
            priority: editingTask.priority as "HIGH" | "MEDIUM" | "LOW",
            status: editingTask.status as "OPEN" | "IN_PROGRESS" | "BLOCKED",
            dueDate: editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split("T")[0]! : "",
          }}
          staffUsers={staffUsers}
          isPending={updateTask.isPending}
          error={updateTask.error?.message ?? null}
          submitLabel="Save Changes"
          showStatus={true}
          onSubmit={(form) => {
            updateTask.mutate({
              id: editingTask.id,
              title: form.title.trim(),
              description: form.description.trim() || undefined,
              assignedToId: form.assignedToId || undefined,
              priority: form.priority,
              status: form.status,
              dueDate: form.dueDate || undefined,
            });
          }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  );
}
