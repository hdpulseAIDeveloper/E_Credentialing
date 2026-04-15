/**
 * Monthly sanctions re-check job.
 * Re-runs OIG + SAM checks for all APPROVED providers.
 */

import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { createRedisConnection } from "../../lib/redis";

const db = new PrismaClient();

export async function runMonthlySanctionsCheck(): Promise<void> {
  console.log("[SanctionsMonthly] Starting monthly sanctions re-check...");

  const queue = new Queue("psv-bot", { connection: createRedisConnection() });
  let queued = 0;

  try {
    // Get all approved providers
    const approvedProviders = await db.provider.findMany({
      where: { status: "APPROVED" },
      select: { id: true, legalFirstName: true, legalLastName: true, npi: true },
    });

    console.log(`[SanctionsMonthly] Checking ${approvedProviders.length} approved providers...`);

    for (const provider of approvedProviders) {
      // Create BotRun records for OIG and SAM checks
      const [oigBotRun, samBotRun] = await Promise.all([
        db.botRun.create({
          data: {
            providerId: provider.id,
            botType: "OIG_SANCTIONS",
            triggeredBy: "AUTOMATIC",
            status: "QUEUED",
            attemptCount: 0,
            inputData: {
              npi: provider.npi,
              firstName: provider.legalFirstName,
              lastName: provider.legalLastName,
              triggeredBy: "automatic_monthly",
            },
          },
        }),
        db.botRun.create({
          data: {
            providerId: provider.id,
            botType: "SAM_SANCTIONS",
            triggeredBy: "AUTOMATIC",
            status: "QUEUED",
            attemptCount: 0,
            inputData: {
              npi: provider.npi,
              firstName: provider.legalFirstName,
              lastName: provider.legalLastName,
              triggeredBy: "automatic_monthly",
            },
          },
        }),
      ]);

      // Enqueue both checks
      await Promise.all([
        queue.add("oig-sanctions", { botRunId: oigBotRun.id, providerId: provider.id }, {
          priority: 10,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }),
        queue.add("sam-sanctions", { botRunId: samBotRun.id, providerId: provider.id }, {
          priority: 10,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }),
      ]);

      queued += 2;

      // Small delay to avoid overwhelming the queue
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log(`[SanctionsMonthly] Complete. Queued ${queued} bot runs for ${approvedProviders.length} providers.`);
  } catch (error) {
    console.error("[SanctionsMonthly] Error:", error);
    throw error;
  } finally {
    await queue.close();
  }
}
