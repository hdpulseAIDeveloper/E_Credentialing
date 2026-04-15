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

interface EditModalProps {
  user: User;
  onClose: () => void;
}

function EditUserModal({ user, onClose }: EditModalProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState<UserRole>(user.role as UserRole);

  const updateUser = api.admin.updateUser.useMutation({
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Edit User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateUser.mutate({ id: user.id, displayName: displayName.trim() || undefined, role });
          }}
          className="px-6 py-4 space-y-4"
        >
          {updateUser.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {updateUser.error.message}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="SPECIALIST">Specialist</option>
              <option value="MANAGER">Manager</option>
              <option value="COMMITTEE_MEMBER">Committee Member</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={updateUser.isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {updateUser.isPending ? "Saving…" : "Save Changes"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface InviteModalProps {
  onClose: () => void;
}

function InviteUserModal({ onClose }: InviteModalProps) {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", displayName: "", role: "SPECIALIST" as UserRole });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createUser = api.admin.createUser.useMutation({
    onSuccess: () => {
      onClose();
      router.refresh();
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!form.email.trim()) errs.email = "Email is required.";
    else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = "Invalid email address.";
    if (!form.displayName.trim()) errs.displayName = "Name is required.";
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    createUser.mutate({ email: form.email.trim(), displayName: form.displayName.trim(), role: form.role });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
        <div className="flex justify-between items-center px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Invite Staff User</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
          {createUser.error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
              {createUser.error.message}
            </p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Email <span className="text-red-500">*</span></label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => { setForm((p) => ({ ...p, email: e.target.value })); setErrors((p) => ({ ...p, email: "" })); }}
              placeholder="user@essenmed.com"
              className={`w-full border ${errors.email ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.email && <p className="text-xs text-red-600 mt-0.5">{errors.email}</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Display Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.displayName}
              onChange={(e) => { setForm((p) => ({ ...p, displayName: e.target.value })); setErrors((p) => ({ ...p, displayName: "" })); }}
              placeholder="Jane Smith"
              className={`w-full border ${errors.displayName ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`}
            />
            {errors.displayName && <p className="text-xs text-red-600 mt-0.5">{errors.displayName}</p>}
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
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={createUser.isPending}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {createUser.isPending ? "Creating…" : "Create User"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AdminUserRowActionsProps {
  user: User;
}

export function AdminUserRowActions({ user }: AdminUserRowActionsProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
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
      <div className="flex gap-2">
        <button
          onClick={() => setEditOpen(true)}
          className="text-xs text-blue-600 hover:underline"
        >
          Edit
        </button>
        {user.isActive ? (
          <button
            onClick={() => setConfirmDeactivate(true)}
            className="text-xs text-red-600 hover:underline"
          >
            Deactivate
          </button>
        ) : (
          <button
            onClick={() => reactivate.mutate({ id: user.id, isActive: true })}
            disabled={reactivate.isPending}
            className="text-xs text-green-600 hover:underline disabled:opacity-50"
          >
            Reactivate
          </button>
        )}
      </div>

      {editOpen && <EditUserModal user={user} onClose={() => setEditOpen(false)} />}

      {confirmDeactivate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Deactivate User?</h2>
            <p className="text-sm text-gray-600 mb-6">
              <strong>{user.displayName}</strong> will lose access to the platform. You can reactivate them later.
            </p>
            {deactivate.error && (
              <p className="text-sm text-red-600 mb-3">{deactivate.error.message}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => deactivate.mutate({ id: user.id })}
                disabled={deactivate.isPending}
                className="flex-1 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
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

export function InviteUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        + Invite User
      </button>
      {open && <InviteUserModal onClose={() => setOpen(false)} />}
    </>
  );
}
