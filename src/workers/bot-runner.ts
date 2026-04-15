/**
 * Bot runner — for running specific bots with visible browser (debugging).
 * Usage: npm run bot:headed <botType> <providerId>
 */

import { PrismaClient } from "@prisma/client";
import { LicenseVerificationBot } from "./bots/license-verification";
import { DeaVerificationBot } from "./bots/dea-verification";
import { BoardNccpaBot } from "./bots/board-nccpa";
import { BoardAbimBot } from "./bots/board-abim";
import { BoardAbfmBot } from "./bots/board-abfm";
import { SanctionsOigBot } from "./bots/sanctions-oig";
import { SanctionsSamBot } from "./bots/sanctions-sam";
import { NpdbQueryBot } from "./bots/npdb-query";

const db = new PrismaClient();

const BOT_MAP = {
  "license-verification": () => new LicenseVerificationBot(),
  "dea-verification": () => new DeaVerificationBot(),
  "board-nccpa": () => new BoardNccpaBot(),
  "board-abim": () => new BoardAbimBot(),
  "board-abfm": () => new BoardAbfmBot(),
  "oig-sanctions": () => new SanctionsOigBot(),
  "sam-sanctions": () => new SanctionsSamBot(),
  "npdb": () => new NpdbQueryBot(),
} as const;

async function main() {
  const [, , botTypeName, providerId] = process.argv;

  if (!botTypeName || !providerId) {
    console.error("Usage: npm run bot:headed <bot-type> <provider-id>");
    console.error("Bot types:", Object.keys(BOT_MAP).join(", "));
    process.exit(1);
  }

  const botFactory = BOT_MAP[botTypeName as keyof typeof BOT_MAP];
  if (!botFactory) {
    console.error(`Unknown bot type: ${botTypeName}. Available:`, Object.keys(BOT_MAP).join(", "));
    process.exit(1);
  }

  // Create a BotRun record
  const botRun = await db.botRun.create({
    data: {
      providerId,
      botType: "LICENSE_VERIFICATION", // Will be overridden by actual bot
      triggeredBy: "MANUAL",
      status: "QUEUED",
      attemptCount: 0,
      inputData: { manual: true, botTypeName },
    },
  });

  console.log(`[BotRunner] Starting ${botTypeName} for provider ${providerId} (botRunId: ${botRun.id})`);

  const bot = botFactory();
  await bot.run({ botRunId: botRun.id, providerId });

  console.log(`[BotRunner] ${botTypeName} completed.`);
  await db.$disconnect();
}

main().catch(async (error) => {
  console.error("[BotRunner] Fatal error:", error);
  await db.$disconnect();
  process.exit(1);
});
