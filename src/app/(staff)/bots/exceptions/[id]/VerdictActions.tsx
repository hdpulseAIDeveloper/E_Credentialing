"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { BotExceptionAction } from "@prisma/client";

const ACTIONS: BotExceptionAction[] = [
  "RETRY_NOW",
  "RETRY_LATER",
  "ESCALATE_TO_STAFF",
  "MARK_REQUIRES_MANUAL",
  "RAISE_ALERT",
  "DEFER_NO_ACTION",
];

export function VerdictActions({
  id,
  recommendedAction,
}: {
  id: string;
  recommendedAction: BotExceptionAction;
}) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [chosenAction, setChosenAction] = useState<BotExceptionAction>(
    recommendedAction
  );

  const accept = api.botOrchestrator.accept.useMutation({
    onSuccess: () => router.refresh(),
  });
  const override = api.botOrchestrator.override.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm space-y-4">
      <h2 className="text-sm font-semibold text-gray-900">Your decision</h2>

      <div>
        <label className="text-xs text-gray-500">
          Note (required for override, optional for accept)
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="mt-1 w-full text-sm border border-gray-300 rounded-md p-2"
          placeholder="What did you do (or plan to do) about this?"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={() => accept.mutate({ id, note: note || null })}
          disabled={accept.isPending}
          className="px-3 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
        >
          {accept.isPending
            ? "Accepting…"
            : `Accept AI recommendation (${recommendedAction.replace(/_/g, " ")})`}
        </button>

        <div className="flex gap-2 items-center">
          <select
            value={chosenAction}
            onChange={(e) =>
              setChosenAction(e.target.value as BotExceptionAction)
            }
            className="text-sm border border-gray-300 rounded-md p-2"
          >
            {ACTIONS.map((a) => (
              <option key={a} value={a}>
                {a.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              override.mutate({ id, chosenAction, note: note.trim() })
            }
            disabled={
              override.isPending ||
              note.trim().length === 0 ||
              chosenAction === recommendedAction
            }
            className="px-3 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
          >
            {override.isPending ? "Overriding…" : "Override"}
          </button>
        </div>
      </div>

      {(accept.error || override.error) && (
        <p className="text-xs text-red-700">
          {accept.error?.message || override.error?.message}
        </p>
      )}
    </section>
  );
}
