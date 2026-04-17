"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function AttestReviewButton({ cardId }: { cardId: string }) {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const attest = api.aiGovernance.attestModelCardReview.useMutation({
    onSuccess: () => {
      setDone(true);
      router.refresh();
    },
  });

  return (
    <button
      onClick={() => attest.mutate({ id: cardId })}
      disabled={attest.isPending || done}
      className="px-3 py-1.5 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
    >
      {done ? "Review attested" : attest.isPending ? "Attesting…" : "Attest annual review"}
    </button>
  );
}
