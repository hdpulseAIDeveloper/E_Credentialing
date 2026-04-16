/**
 * Sanctions re-check job (NCQA: weekly).
 * Re-runs OIG + SAM checks for all APPROVED providers.
 *
 * Idempotency: skips providers whose most recent OIG/SAM check completed in the
 * last 24h to avoid duplicate work if the scheduler fires twice in the same day.
 */

import { db } from "../../server/db";
import { Queue } from "bullmq";
import { createRedisConnection } from "../../lib/redis";

const RECENT_CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;

export async function runMonthlySanctionsCheck(): Promise<void> {
  console.log("[SanctionsRecheck] Starting sanctions re-check...");

  if (!process.env.AZURE_BLOB_ACCOUNT_URL && !process.env.SAM_GOV_API_KEY) {
    console.log("[SanctionsRecheck] Skipped — neither AZURE_BLOB_ACCOUNT_URL nor SAM_GOV_API_KEY configured");
    return;
  }

  const queue = new Queue("psv-bot", { connection: createRedisConnection() });
  let queued = 0;
  let skipped = 0;

  try {
    const approvedProviders = await db.provider.findMany({
      where: { status: "APPROVED" },
      select: { id: true, legalFirstName: true, legalLastName: true, npi: true },
    });

    const cutoff = new Date(Date.now() - RECENT_CHECK_WINDOW_MS);

    console.log(`[SanctionsRecheck] Checking ${approvedProviders.length} approved providers...`);

    for (const provider of approvedProviders) {
      const recent = await db.botRun.count({
        where: {
          providerId: provider.id,
          botType: { in: ["OIG_SANCTIONS", "SAM_SANCTIONS"] },
          status: { in: ["QUEUED", "RUNNING", "COMPLETED"] },
          queuedAt: { gte: cutoff },
        },
      });
      if (recent >= 2) {
        skipped++;
        continue;
      }
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

    console.log(`[SanctionsRecheck] Complete. Queued ${queued} bot runs for ${approvedProviders.length} providers (skipped ${skipped} due to recent checks).`);
  } catch (error) {
    console.error("[SanctionsRecheck] Error:", error);
    throw error;
  } finally {
    await queue.close();
  }
}
