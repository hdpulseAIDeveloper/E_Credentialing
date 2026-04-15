/**
 * Auto-queues PSV bots for a provider after attestation is complete.
 * Determines which bots to run based on provider type configuration.
 */

import { db } from "@/server/db";
import type { BotType } from "@prisma/client";

interface QueuedBot {
  botType: BotType;
  inputData: Record<string, unknown>;
}

export async function queuePsvBotsForProvider(providerId: string): Promise<QueuedBot[]> {
  const provider = await db.provider.findUniqueOrThrow({
    where: { id: providerId },
    include: {
      providerType: true,
      licenses: { where: { isPrimary: true }, take: 1 },
    },
  });

  const botsToQueue: QueuedBot[] = [];

  // License verification — all providers
  const primaryLicense = provider.licenses[0];
  if (primaryLicense) {
    botsToQueue.push({
      botType: "LICENSE_VERIFICATION",
      inputData: { state: primaryLicense.state, licenseNumber: primaryLicense.licenseNumber },
    });
  }

  // DEA verification — if provider has DEA number
  if (provider.deaNumber) {
    botsToQueue.push({
      botType: "DEA_VERIFICATION",
      inputData: { deaNumber: provider.deaNumber },
    });
  }

  // Board certification — based on provider type
  if (provider.providerType.requiresBoards && provider.providerType.boardType) {
    const boardType = provider.providerType.boardType.toUpperCase();
    let botType: BotType = "BOARD_NCCPA";
    if (boardType.includes("ABIM")) botType = "BOARD_ABIM";
    else if (boardType.includes("ABFM")) botType = "BOARD_ABFM";
    botsToQueue.push({
      botType,
      inputData: { npi: provider.npi, providerName: `${provider.legalFirstName} ${provider.legalLastName}` },
    });
  }

  // Sanctions — all providers
  botsToQueue.push({
    botType: "OIG_SANCTIONS",
    inputData: { firstName: provider.legalFirstName, lastName: provider.legalLastName, npi: provider.npi },
  });
  botsToQueue.push({
    botType: "SAM_SANCTIONS",
    inputData: { firstName: provider.legalFirstName, lastName: provider.legalLastName, npi: provider.npi },
  });

  // NPDB — all providers
  botsToQueue.push({
    botType: "NPDB",
    inputData: { firstName: provider.legalFirstName, lastName: provider.legalLastName, npi: provider.npi },
  });

  // Create BotRun records
  for (const bot of botsToQueue) {
    await db.botRun.create({
      data: {
        providerId,
        botType: bot.botType,
        triggeredBy: "AUTOMATIC",
        status: "QUEUED",
        attemptCount: 0,
        queuedAt: new Date(),
        inputData: bot.inputData as any,
      },
    });
  }

  console.log(`[PSV Auto-Queue] Queued ${botsToQueue.length} bots for provider ${providerId}`);
  return botsToQueue;
}
