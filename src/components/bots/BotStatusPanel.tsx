"use client";

import { useMemo } from "react";
import { BotRunRow } from "./BotRunRow";
import { api } from "@/trpc/react";
import type { BotRun, BotType, User, VerificationRecord } from "@prisma/client";

type TriggerableBotType =
  | "LICENSE_VERIFICATION"
  | "DEA_VERIFICATION"
  | "BOARD_NCCPA"
  | "BOARD_ABIM"
  | "BOARD_ABFM"
  | "OIG_SANCTIONS"
  | "SAM_SANCTIONS"
  | "NPDB"
  | "EMEDRAL_ETIN"
  | "EDUCATION_AMA"
  | "EDUCATION_ECFMG"
  | "EDUCATION_ACGME";

type BotRunWithRelations = BotRun & {
  triggeredByUser: Pick<User, "id" | "displayName"> | null;
  verificationRecords: Pick<VerificationRecord, "id" | "status" | "isFlagged" | "credentialType">[];
};

interface Props {
  providerId: string;
  providerType: string;
  botRuns: BotRunWithRelations[];
}

// Per NCQA CVO 11-product spec, MD/DO require AMA Masterfile, ECFMG (when IMG),
// and ACGME residency verification in addition to license/DEA/board/sanctions.
// PAs and NPs require AMA + ACGME (where applicable) but not ECFMG.
const BOT_TYPES_BY_PROVIDER: Record<string, TriggerableBotType[]> = {
  MD: ["LICENSE_VERIFICATION", "DEA_VERIFICATION", "BOARD_ABIM", "BOARD_ABFM", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB", "EDUCATION_AMA", "EDUCATION_ECFMG", "EDUCATION_ACGME"],
  DO: ["LICENSE_VERIFICATION", "DEA_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB", "EDUCATION_AMA", "EDUCATION_ACGME"],
  PA: ["LICENSE_VERIFICATION", "BOARD_NCCPA", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB", "EDUCATION_AMA"],
  NP: ["LICENSE_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB"],
  LCSW: ["LICENSE_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS"],
  LMHC: ["LICENSE_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS"],
};

const ACTIVE_STATUSES = new Set(["QUEUED", "RUNNING", "RETRYING"]);

export function BotStatusPanel({ providerId, providerType, botRuns: initialBotRuns }: Props) {
  const utils = api.useUtils();

  const applicableBotTypes = BOT_TYPES_BY_PROVIDER[providerType] ?? ["LICENSE_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS"];

  // Polling: refetch every 5s while any bot is in an active state, then back off.
  // tRPC + react-query gives us optimistic + automatic re-render.
  const { data } = api.bot.listByProvider.useQuery(
    { providerId, page: 1, limit: 50 },
    {
      initialData: { runs: initialBotRuns, total: initialBotRuns.length },
      refetchInterval: (q) => {
        const runs = (q.state.data?.runs ?? []) as BotRunWithRelations[];
        return runs.some((r) => ACTIVE_STATUSES.has(r.status)) ? 5000 : false;
      },
    }
  );

  const botRuns = useMemo(() => (data?.runs ?? []) as BotRunWithRelations[], [data]);

  const triggerMutation = api.bot.triggerBot.useMutation({
    onSuccess: () => {
      void utils.bot.listByProvider.invalidate({ providerId });
    },
    onError: (err) => {
      console.error("[BotStatusPanel] Failed to trigger bot:", err.message);
    },
  });

  const getLatestRun = (botType: BotType) =>
    botRuns.find((r) => r.botType === botType);

  const handleTriggerBot = (botType: TriggerableBotType) => {
    triggerMutation.mutate({ providerId, botType });
  };

  // NPDB feature flag (P0 Gap #1) — surface a prominent banner when NPDB
  // automated query is not enabled. Real HIQA Continuous Query integration
  // requires NPDB account + DUNS provisioning before it can be turned on.
  const npdbEnabled =
    process.env.NEXT_PUBLIC_NPDB_ENABLED === "true";
  const showsNpdb = applicableBotTypes.includes("NPDB");

  return (
    <div className="space-y-4">
      {showsNpdb && !npdbEnabled && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm">
          <div className="flex items-start gap-3">
            <span aria-hidden className="text-amber-600 font-semibold mt-0.5">!</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-900">
                NPDB Continuous Query is currently a manual workflow
              </p>
              <p className="text-amber-900 mt-1 leading-relaxed">
                Until NPDB account credentials are provisioned, the NPDB bot
                will mark each run as <strong>Manual Required</strong>. Please
                query{" "}
                <a
                  href="https://www.npdb.hrsa.gov/"
                  target="_blank"
                  rel="noreferrer noopener"
                  className="underline font-medium"
                >
                  npdb.hrsa.gov
                </a>{" "}
                manually, download the report PDF, and upload it under
                Documents &rarr; NPDB Report. This is gated behind the
                <code className="mx-1 px-1 py-0.5 bg-amber-100 rounded text-xs">
                  NPDB_ENABLED
                </code>
                feature flag and will switch to fully automated once the
                integration ships.
              </p>
            </div>
          </div>
        </div>
      )}
      {applicableBotTypes.map((botType) => {
        const latestRun = getLatestRun(botType);
        return (
          <BotRunRow
            key={botType}
            botType={botType}
            latestRun={latestRun}
            onTrigger={() => handleTriggerBot(botType)}
          />
        );
      })}
    </div>
  );
}
