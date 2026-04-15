"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { BotRunRow } from "./BotRunRow";
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

export function BotStatusPanel({ providerId, providerType, botRuns: initialBotRuns }: Props) {
  const [botRuns, setBotRuns] = useState<BotRunWithRelations[]>(initialBotRuns);
  const [socket, setSocket] = useState<Socket | null>(null);

  const applicableBotTypes = BOT_TYPES_BY_PROVIDER[providerType] ?? ["LICENSE_VERIFICATION", "OIG_SANCTIONS", "SAM_SANCTIONS"];

  useEffect(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
    const s = io(appUrl);

    s.on("connect", () => {
      s.emit("subscribe:provider", providerId);
    });

    s.on("bot:update", (data: { event: string; botRunId: string; botType: string }) => {
      // Refresh bot run data
      console.log("[BotStatusPanel] Bot update received:", data);
      // In a full implementation, re-fetch the updated bot run from API
    });

    setSocket(s);

    return () => {
      s.emit("unsubscribe:provider", providerId);
      s.disconnect();
    };
  }, [providerId]);

  const getLatestRun = (botType: BotType) =>
    botRuns.find((r) => r.botType === botType);

  const handleTriggerBot = async (botType: BotType) => {
    const response = await fetch("/api/trpc/bot.triggerBot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ providerId, botType }),
    });
    if (response.ok) {
      // Optimistically add a queued run
      console.log(`[BotStatusPanel] Triggered ${botType}`);
    }
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
