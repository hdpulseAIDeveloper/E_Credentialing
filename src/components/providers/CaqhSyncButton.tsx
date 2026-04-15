"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

interface Props {
  providerId: string;
  caqhId: string | null;
}

export function CaqhSyncButton({ providerId, caqhId }: Props) {
  const router = useRouter();
  const [syncing, setSyncing] = useState(false);

  const syncMutation = api.provider.pullCaqhData.useMutation({
    onSuccess: () => { setSyncing(false); router.refresh(); },
    onError: () => setSyncing(false),
  });

  if (!caqhId) return null;

  return (
    <button
      onClick={() => { setSyncing(true); syncMutation.mutate({ providerId }); }}
      disabled={syncing}
      className="text-xs text-blue-600 hover:underline disabled:opacity-50"
    >
      {syncing ? "Syncing..." : "Sync CAQH Data"}
    </button>
  );
}
