"use client";

import Link from "next/link";
import type { Provider, ProviderType, User, ChecklistItem } from "@prisma/client";
import { ProviderStatusBadge } from "@/components/providers/ProviderStatusBadge";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";

type ProviderWithRelations = Provider & {
  providerType: ProviderType;
  assignedSpecialist?: Pick<User, "id" | "displayName"> | null;
  checklistItems: Pick<ChecklistItem, "status">[];
};

interface Props {
  providers: ProviderWithRelations[];
}

export function PipelineTable({ providers }: Props) {
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const filtered = providers.filter((p) => {
    const name = `${p.legalFirstName} ${p.legalLastName}`.toLowerCase();
    const matchesSearch = !filter || name.includes(filter.toLowerCase()) || (p.npi ?? "").includes(filter);
    const matchesStatus = !statusFilter || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="bg-white rounded-lg border">
      {/* Filters */}
      <div className="p-4 border-b flex gap-3">
        <input
          type="text"
          placeholder="Search providers..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="INVITED">Invited</option>
          <option value="ONBOARDING_IN_PROGRESS">In Progress</option>
          <option value="DOCUMENTS_PENDING">Docs Pending</option>
          <option value="VERIFICATION_IN_PROGRESS">Verifying</option>
          <option value="COMMITTEE_READY">Committee Ready</option>
          <option value="COMMITTEE_IN_REVIEW">In Review</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Provider</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Docs</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Specialist</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Updated</th>
              <th className="text-left p-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">No providers found</td>
              </tr>
            ) : (
              filtered.map((p) => {
                const docsReceived = p.checklistItems.filter((i) => i.status === "RECEIVED").length;
                const docsTotal = p.checklistItems.length;

                return (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <Link href={`/providers/${p.id}`} className="font-medium text-blue-600 hover:underline">
                        {p.legalFirstName} {p.legalLastName}
                      </Link>
                      {p.npi && <div className="text-xs text-gray-400">NPI: {p.npi}</div>}
                    </td>
                    <td className="p-3 text-sm text-gray-600">{p.providerType.abbreviation}</td>
                    <td className="p-3">
                      <ProviderStatusBadge status={p.status} />
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {docsTotal > 0 ? `${docsReceived}/${docsTotal}` : "—"}
                    </td>
                    <td className="p-3 text-sm text-gray-500">
                      {p.assignedSpecialist?.displayName ?? "—"}
                    </td>
                    <td className="p-3 text-xs text-gray-400">
                      {formatDistanceToNow(p.updatedAt, { addSuffix: true })}
                    </td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <Link
                          href={`/providers/${p.id}`}
                          className="text-xs text-blue-600 hover:underline"
                        >
                          View
                        </Link>
                        <Link
                          href={`/providers/${p.id}/bots`}
                          className="text-xs text-purple-600 hover:underline"
                        >
                          Bots
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
