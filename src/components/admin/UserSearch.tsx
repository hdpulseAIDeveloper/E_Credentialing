"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useCallback } from "react";
import { Search, X } from "lucide-react";

interface UserSearchProps {
  currentSearch?: string;
  currentRole?: string;
  currentStatus?: string;
}

export function UserSearch({ currentSearch, currentRole, currentStatus }: UserSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(currentSearch ?? "");

  const updateParams = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("page");
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      router.push(`/admin/users?${params.toString()}`);
    },
    [router, searchParams]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    updateParams({ search: search.trim() || undefined });
  };

  const hasFilters = currentSearch || currentRole || currentStatus;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form onSubmit={handleSearch} className="flex-1 min-w-48 max-w-sm relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email…"
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </form>

      <select
        value={currentRole ?? ""}
        onChange={(e) => updateParams({ role: e.target.value || undefined })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Roles</option>
        <option value="ADMIN">Admin</option>
        <option value="MANAGER">Manager</option>
        <option value="COMMITTEE_MEMBER">Committee Member</option>
        <option value="SPECIALIST">Specialist</option>
      </select>

      <select
        value={currentStatus ?? ""}
        onChange={(e) => updateParams({ status: e.target.value || undefined })}
        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="">All Statuses</option>
        <option value="active">Active</option>
        <option value="inactive">Inactive</option>
      </select>

      {hasFilters && (
        <button
          onClick={() => {
            setSearch("");
            router.push("/admin/users");
          }}
          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
          Clear filters
        </button>
      )}
    </div>
  );
}
