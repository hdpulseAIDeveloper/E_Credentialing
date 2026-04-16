"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

type UserRole = "SPECIALIST" | "MANAGER" | "COMMITTEE_MEMBER" | "ADMIN";

interface User {
  id: string;
  displayName: string;
  email: string;
  role: string;
  isActive: boolean;
}

interface Props {
  user: User;
}

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const router = useRouter();
  const [form, setForm] = useState({
    displayName: user.displayName,
    email: user.email,
    role: user.role as UserRole,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const updateUser = api.admin.updateUser.useMutation({
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.displayName.trim()) errs.displayName = "Name is required.";
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Invalid email address.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!validate()) return;
            updateUser.mutate({
              id: user.id,
              displayName: form.displayName.trim(),
              email: form.email.trim() !== user.email ? form.email.trim() : undefined,
              role: form.role,
            });
          }}
          className="px-6 py-5 space-y-4"
        >
          {updateUser.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {updateUser.error.message}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => { setForm((p) => ({ ...p, displayName: e.target.value })); setErrors((p) => ({ ...p, displayName: "" })); }}
              className={`w-full border ${errors.displayName ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.displayName && <p className="text-xs text-red-600 mt-0.5">{errors.displayName}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => ({ ...p, email: "" })); }}
              className={`w-full border ${errors.email ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.email && <p className="text-xs text-red-600 mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select
              value={form.role}
              onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="SPECIALIST">Specialist</option>
              <option value="MANAGER">Manager</option>
              <option value="COMMITTEE_MEMBER">Committee Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateUser.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function DeleteUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const router = useRouter();
  const [confirmText, setConfirmText] = useState("");

  const deleteUser = api.admin.deleteUser.useMutation({
    onSuccess: () => {
      router.push("/admin/users");
      router.refresh();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center px-6 py-4 border-b bg-red-50">
          <h2 className="text-lg font-semibold text-red-900">Permanently Delete User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800 font-medium">This action is irreversible.</p>
            <p className="text-sm text-red-700 mt-1">
              Permanently removing <strong>{user.displayName}</strong> ({user.email}) will delete their account record.
              Audit trail entries will be preserved but the user reference will show as deleted.
            </p>
          </div>
          <p className="text-sm text-gray-600">
            If the user has assigned providers, open tasks, or active enrollments, you must reassign them first.
            Consider <strong>deactivating</strong> instead if you want to preserve the record.
          </p>
          {deleteUser.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {deleteUser.error.message}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              onClick={() => deleteUser.mutate({ id: user.id })}
              disabled={confirmText !== "DELETE" || deleteUser.isPending}
              className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {deleteUser.isPending ? "Deleting…" : "Delete Permanently"}
            </button>
            <button type="button" onClick={onClose} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserDetailActions({ user }: Props) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const deactivate = api.admin.deactivateUser.useMutation({
    onSuccess: () => {
      setConfirmDeactivate(false);
      router.refresh();
    },
  });

  const reactivate = api.admin.updateUser.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEditOpen(true)}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Edit User
        </button>
        {user.isActive ? (
          <button
            onClick={() => setConfirmDeactivate(true)}
            className="px-4 py-2 text-sm font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 transition-colors"
          >
            Deactivate
          </button>
        ) : (
          <button
            onClick={() => reactivate.mutate({ id: user.id, isActive: true })}
            disabled={reactivate.isPending}
            className="px-4 py-2 text-sm font-medium text-green-700 bg-green-100 rounded-lg hover:bg-green-200 disabled:opacity-50 transition-colors"
          >
            {reactivate.isPending ? "Reactivating…" : "Reactivate"}
          </button>
        )}
        <button
          onClick={() => setDeleteOpen(true)}
          className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors"
        >
          Delete
        </button>
      </div>

      {editOpen && <EditUserModal user={user} onClose={() => setEditOpen(false)} />}
      {deleteOpen && <DeleteUserModal user={user} onClose={() => setDeleteOpen(false)} />}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setConfirmDeactivate(false)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Deactivate User?</h2>
            <p className="text-sm text-gray-600 mb-6">
              <strong>{user.displayName}</strong> will lose access to the platform immediately. You can reactivate them later.
            </p>
            {deactivate.error && (
              <p className="text-sm text-red-600 mb-3">{deactivate.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => deactivate.mutate({ id: user.id })}
                disabled={deactivate.isPending}
                className="flex-1 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                {deactivate.isPending ? "Deactivating…" : "Deactivate"}
              </button>
              <button
                onClick={() => setConfirmDeactivate(false)}
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
