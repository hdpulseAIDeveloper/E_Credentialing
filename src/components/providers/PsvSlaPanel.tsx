/**
 * PSV SLA Panel — surfaces the NCQA 90/120-day Primary Source Verification
 * countdown for a single provider on the staff Provider Detail overview.
 *
 * Server component (no React hooks). Pure read on the data already loaded
 * by the parent page; no extra DB calls.
 *
 * P0 Gap #7.
 */

import {
  computeSlaState,
  slaStateColor,
  slaStateLabel,
  PSV_SLA_INITIAL_DAYS,
  PSV_SLA_RECRED_DAYS,
  type PsvSlaCycle,
} from "@/lib/psv-sla";
import { formatDateLong } from "@/lib/format-date";

interface Props {
  applicationSubmittedAt: Date | string | null | undefined;
  approvedAt?: Date | string | null;
  recredentialingCycles: ReadonlyArray<{
    id: string;
    cycleNumber?: number | null;
    startedAt?: Date | string | null;
    dueDate?: Date | string | null;
    completedAt?: Date | string | null;
    status: string;
  }>;
}

export function PsvSlaPanel({
  applicationSubmittedAt,
  approvedAt,
  recredentialingCycles,
}: Props) {
  const initial = computeSlaState({
    cycle: "INITIAL",
    appliedAt: applicationSubmittedAt,
    completedAt: approvedAt ?? null,
  });

  const activeRecred =
    recredentialingCycles.find(
      (c) => c.status !== "COMPLETED" && c.status !== "CANCELLED"
    ) ??
    recredentialingCycles[0] ??
    null;

  const recred = activeRecred
    ? computeSlaState({
        cycle: "RECRED" as PsvSlaCycle,
        appliedAt: activeRecred.startedAt ?? activeRecred.dueDate ?? null,
        completedAt: activeRecred.completedAt ?? null,
      })
    : null;

  return (
    <div className="bg-white rounded-lg border p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">
          PSV SLA Status
          <span className="ml-2 text-xs font-normal text-gray-500">
            NCQA CR 4 — Verification timeliness
          </span>
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Initial Credentialing */}
        <SlaCard
          title="Initial Credentialing"
          window={PSV_SLA_INITIAL_DAYS}
          appliedLabel="App submitted"
          state={initial}
        />

        {/* Active Recredentialing Cycle */}
        {recred ? (
          <SlaCard
            title={`Recredentialing${
              activeRecred?.cycleNumber ? ` — Cycle #${activeRecred.cycleNumber}` : ""
            }`}
            window={PSV_SLA_RECRED_DAYS}
            appliedLabel="Cycle started"
            state={recred}
          />
        ) : (
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
            No active recredentialing cycle.
          </div>
        )}
      </div>
    </div>
  );
}

function SlaCard({
  title,
  window,
  appliedLabel,
  state,
}: {
  title: string;
  window: number;
  appliedLabel: string;
  state: ReturnType<typeof computeSlaState>;
}) {
  const colorClass = slaStateColor(state.status);
  const label = slaStateLabel(state);

  return (
    <div className={`rounded-md border p-4 space-y-2 ${colorClass}`}>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-xs font-medium uppercase tracking-wide">
          {state.status.replace(/_/g, " ")}
        </span>
      </div>
      <div className="text-2xl font-bold">{label}</div>
      <dl className="text-xs space-y-0.5">
        <div className="flex justify-between">
          <dt className="opacity-75">{appliedLabel}</dt>
          <dd className="font-medium">{formatDateLong(state.appliedAt)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="opacity-75">PSV deadline</dt>
          <dd className="font-medium">
            {formatDateLong(state.deadline)}
            <span className="opacity-60"> ({window}d)</span>
          </dd>
        </div>
        {state.completedAt && (
          <div className="flex justify-between">
            <dt className="opacity-75">Completed</dt>
            <dd className="font-medium">{formatDateLong(state.completedAt)}</dd>
          </div>
        )}
      </dl>
    </div>
  );
}
