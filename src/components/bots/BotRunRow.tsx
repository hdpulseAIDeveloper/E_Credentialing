"use client";

import type { BotRun, BotType } from "@prisma/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

const BOT_LABELS: Record<BotType, string> = {
  LICENSE_VERIFICATION: "State License Verification",
  DEA_VERIFICATION: "DEA Verification",
  BOARD_NCCPA: "NCCPA Board Certification",
  BOARD_ABIM: "ABIM Board Certification",
  BOARD_ABFM: "ABFM Board Certification",
  OIG_SANCTIONS: "OIG Sanctions Check",
  SAM_SANCTIONS: "SAM.gov Sanctions Check",
  NPDB: "NPDB Query",
  EMEDRAL_ETIN: "eMedNY Enrollment",
  EXPIRABLE_RENEWAL: "Expirable Renewal Check",
  ENROLLMENT_SUBMISSION: "Enrollment Submission",
  EDUCATION_AMA: "AMA Education Verification",
  EDUCATION_ECFMG: "ECFMG Certification Verification",
};

const STATUS_CONFIG = {
  QUEUED: { label: "Queued", className: "text-gray-500 bg-gray-100" },
  RUNNING: { label: "Running...", className: "text-blue-600 bg-blue-100" },
  COMPLETED: { label: "Completed", className: "text-green-600 bg-green-100" },
  FAILED: { label: "Failed", className: "text-red-600 bg-red-100" },
  RETRYING: { label: "Retrying", className: "text-yellow-600 bg-yellow-100" },
  REQUIRES_MANUAL: { label: "Manual Required", className: "text-orange-600 bg-orange-100" },
};

interface Props {
  botType: BotType;
  latestRun?: BotRun | null;
  onTrigger: () => void;
}

export function BotRunRow({ botType, latestRun, onTrigger }: Props) {
  const statusConfig = latestRun ? STATUS_CONFIG[latestRun.status] : null;
  const isRunning = latestRun?.status === "RUNNING" || latestRun?.status === "QUEUED";

  return (
    <div className="bg-white rounded-lg border p-4 flex items-center justify-between">
      <div className="flex-1">
        <div className="font-medium text-gray-900">{BOT_LABELS[botType]}</div>
        {latestRun ? (
          <div className="text-sm text-gray-500 mt-1">
            Last run: {formatDistanceToNow(latestRun.queuedAt, { addSuffix: true })}
            {latestRun.completedAt && (
              <span>
                {" "}· Duration:{" "}
                {Math.round(
                  (latestRun.completedAt.getTime() - latestRun.startedAt!.getTime()) / 1000
                )}s
              </span>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-400 mt-1">Never run</div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {statusConfig && (
          <span className={cn("text-xs px-2 py-1 rounded-full font-medium", statusConfig.className)}>
            {statusConfig.label}
          </span>
        )}
        {latestRun?.errorMessage && (
          <span className="text-xs text-red-500 max-w-xs truncate" title={latestRun.errorMessage}>
            {latestRun.errorMessage}
          </span>
        )}
        <button
          onClick={onTrigger}
          disabled={isRunning}
          className={cn(
            "text-sm px-3 py-1.5 rounded-lg font-medium transition-colors",
            isRunning
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          )}
        >
          {isRunning ? "Running..." : latestRun ? "Re-run" : "Run"}
        </button>
      </div>
    </div>
  );
}
