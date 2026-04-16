"use client";

import { useMemo } from "react";
import { BotRunRow } from "./BotRunRow";
import { api } from "@/trpc/react";
import type { BotRun, BotType, User, VerificationRecord } from "@prisma/client";

type BotRunWithRelations = BotRun & {
  triggeredByUser: Pick<User, "id" | "displayName"> | null;
  verificationRecords: Pick<VerificationRecord, "id" | "status" | "isFlagged" | "credentialType">[];
};

interface Props {
  providerId: string;
  providerType: string;
  botRuns: BotRunWithRelations[];
}

const BOT_TYPES_BY_PROVIDER: Record<string, BotType[]> = {
  MD: ["LICENSE_VERIFICATION", "DEA_VERIFICATION", "BOARD_ABIM", "BOARD_ABFM", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB"],
  DO: ["LICENSE_VERIFICATION", "DEA_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB"],
  PA: ["LICENSE_VERIFICATION", "BOARD_NCCPA", "OIG_SANCTIONS", "SAM_SANCTIONS", "NPDB"],
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

  const handleTriggerBot = (botType: BotType) => {
    triggerMutation.mutate({ providerId, botType });
  };

  return (
    <div className="space-y-4">
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
