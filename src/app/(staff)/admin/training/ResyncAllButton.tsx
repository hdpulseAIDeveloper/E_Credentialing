"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function ResyncAllButton() {
  const router = useRouter();
  const resync = api.training.resyncAll.useMutation({
    onSuccess: () => router.refresh(),
  });
  return (
    <button
      type="button"
      onClick={() => resync.mutate()}
      disabled={resync.isPending}
      className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded shadow-sm disabled:opacity-50"
    >
      {resync.isPending
        ? "Resyncing…"
        : resync.data
          ? `Resynced ${resync.data.usersConsidered} users (${resync.data.created} new)`
          : "Resync all assignments"}
    </button>
  );
}
