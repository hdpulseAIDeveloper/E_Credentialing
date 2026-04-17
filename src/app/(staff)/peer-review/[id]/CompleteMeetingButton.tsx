"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";

export function CompleteMeetingButton({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const update = api.peerReview.updateMeeting.useMutation({
    onSuccess: () => router.refresh(),
  });
  return (
    <button
      type="button"
      onClick={() =>
        update.mutate({ id: meetingId, status: "COMPLETED" })
      }
      disabled={update.isPending}
      className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded shadow-sm disabled:opacity-50"
    >
      {update.isPending ? "Saving…" : "Mark meeting complete"}
    </button>
  );
}
