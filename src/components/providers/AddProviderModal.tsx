"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface ProviderType {
  id: string;
  name: string;
  abbreviation: string;
}

interface Staff {
  id: string;
  displayName: string;
}

interface Props {
  providerTypes: ProviderType[];
  staffUsers: Staff[];
}

export function AddProviderModal({ providerTypes, staffUsers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    legalFirstName: "",
    legalLastName: "",
    legalMiddleName: "",
    providerTypeId: providerTypes[0]?.id ?? "",
    npi: "",
    personalEmail: "",
    mobilePhone: "",
    assignedSpecialistId: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const createProvider = api.provider.create.useMutation({
    onSuccess: (provider) => {
      setOpen(false);
      setForm({
        legalFirstName: "",
        legalLastName: "",
        legalMiddleName: "",
        providerTypeId: providerTypes[0]?.id ?? "",
        npi: "",
        personalEmail: "",
        mobilePhone: "",
        assignedSpecialistId: "",
      });
      router.push(`/providers/${provider.id}`);
    },
  });

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!form.legalFirstName.trim()) errs.legalFirstName = "First name is required.";
    if (!form.legalLastName.trim()) errs.legalLastName = "Last name is required.";
    if (!form.providerTypeId) errs.providerTypeId = "Provider type is required.";
    if (form.npi && !/^\d{10}$/.test(form.npi)) errs.npi = "NPI must be exactly 10 digits.";
    if (form.personalEmail && !/\S+@\S+\.\S+/.test(form.personalEmail)) errs.personalEmail = "Invalid email address.";
    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    createProvider.mutate({
      legalFirstName: form.legalFirstName.trim(),
      legalLastName: form.legalLastName.trim(),
      legalMiddleName: form.legalMiddleName.trim() || undefined,
      providerTypeId: form.providerTypeId,
      npi: form.npi.trim() || undefined,
      personalEmail: form.personalEmail.trim() || undefined,
      mobilePhone: form.mobilePhone.trim() || undefined,
      assignedSpecialistId: form.assignedSpecialistId || undefined,
    });
  };

  const field = (name: string) => ({
    className: `w-full border ${errors[name] ? "border-red-400" : "border-gray-300"} rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500`,
  });

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
      >
        + New Provider
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center px-6 py-4 border-b sticky top-0 bg-white">
              <h2 className="text-lg font-semibold text-gray-900">Add New Provider</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <form onSubmit={handleSubmit} className="px-6 py-4 space-y-4">
              {createProvider.error && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-2">
                  {createProvider.error.message}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">First Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.legalFirstName} onChange={(e) => setForm((p) => ({ ...p, legalFirstName: e.target.value }))} {...field("legalFirstName")} placeholder="Jane" />
                  {errors.legalFirstName && <p className="text-xs text-red-600 mt-0.5">{errors.legalFirstName}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Last Name <span className="text-red-500">*</span></label>
                  <input type="text" value={form.legalLastName} onChange={(e) => setForm((p) => ({ ...p, legalLastName: e.target.value }))} {...field("legalLastName")} placeholder="Smith" />
                  {errors.legalLastName && <p className="text-xs text-red-600 mt-0.5">{errors.legalLastName}</p>}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Middle Name <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.legalMiddleName} onChange={(e) => setForm((p) => ({ ...p, legalMiddleName: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="Middle name" />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Provider Type <span className="text-red-500">*</span></label>
                <select value={form.providerTypeId} onChange={(e) => setForm((p) => ({ ...p, providerTypeId: e.target.value }))} {...field("providerTypeId")}>
                  {providerTypes.map((pt) => (
                    <option key={pt.id} value={pt.id}>{pt.name} ({pt.abbreviation})</option>
                  ))}
                </select>
                {errors.providerTypeId && <p className="text-xs text-red-600 mt-0.5">{errors.providerTypeId}</p>}
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">NPI <span className="text-gray-400 font-normal">(optional)</span></label>
                <input type="text" value={form.npi} onChange={(e) => setForm((p) => ({ ...p, npi: e.target.value }))} {...field("npi")} placeholder="10-digit NPI" maxLength={10} />
                {errors.npi && <p className="text-xs text-red-600 mt-0.5">{errors.npi}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Personal Email</label>
                  <input type="email" value={form.personalEmail} onChange={(e) => setForm((p) => ({ ...p, personalEmail: e.target.value }))} {...field("personalEmail")} placeholder="provider@email.com" />
                  {errors.personalEmail && <p className="text-xs text-red-600 mt-0.5">{errors.personalEmail}</p>}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Mobile Phone</label>
                  <input type="tel" value={form.mobilePhone} onChange={(e) => setForm((p) => ({ ...p, mobilePhone: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="(555) 000-0000" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Assign Specialist <span className="text-gray-400 font-normal">(optional)</span></label>
                <select value={form.assignedSpecialistId} onChange={(e) => setForm((p) => ({ ...p, assignedSpecialistId: e.target.value }))} className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">— Unassigned —</option>
                  {staffUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.displayName}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={createProvider.isPending} className="flex-1 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                  {createProvider.isPending ? "Creating…" : "Create Provider"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
