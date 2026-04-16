/**
 * Worker entry point — BullMQ workers for all queues.
 * Also serves Bull Board dashboard on port 6025 (WORKER_PORT).
 * Registers scheduled jobs via setInterval.
 */

import { Worker, type Job } from "bullmq";
import express from "express";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { createRedisConnection } from "../lib/redis";
import { psvBotQueue, enrollmentBotQueue, scheduledJobQueue } from "./queues";
import { LicenseVerificationBot } from "./bots/license-verification";
import { DeaVerificationBot } from "./bots/dea-verification";
import { BoardNccpaBot } from "./bots/board-nccpa";
import { BoardAbimBot } from "./bots/board-abim";
import { BoardAbfmBot } from "./bots/board-abfm";
import { SanctionsOigBot } from "./bots/sanctions-oig";
import { SanctionsSamBot } from "./bots/sanctions-sam";
import { NpdbQueryBot } from "./bots/npdb-query";
import { EmedralEnrollmentBot } from "./bots/emedral-enrollment";
import { EnrollmentPortalBot } from "./bots/enrollment-portal";
import { runExpirablesScan } from "./jobs/expirables-scan";
import { runMonthlySanctionsCheck } from "./jobs/sanctions-monthly";
import { runFollowUpCadence } from "./jobs/follow-up-cadence";
import { runLicensePoll } from "./jobs/license-poll";
import { runRecredentialingCheck } from "./jobs/recredentialing-check";

// ─── PSV Bot Worker ────────────────────────────────────────────────────────────

const psvWorker = new Worker(
  "psv-bot",
  async (job: Job) => {
    const { botRunId, providerId } = job.data as { botRunId: string; providerId: string };
    console.log(`[PSV Worker] Processing job: ${job.name} (botRunId: ${botRunId})`);

    switch (job.name) {
      case "license-verification":
        await new LicenseVerificationBot().run({ botRunId, providerId });
        break;
      case "dea-verification":
        await new DeaVerificationBot().run({ botRunId, providerId });
        break;
      case "board-nccpa":
        await new BoardNccpaBot().run({ botRunId, providerId });
        break;
      case "board-abim":
        await new BoardAbimBot().run({ botRunId, providerId });
        break;
      case "board-abfm":
        await new BoardAbfmBot().run({ botRunId, providerId });
        break;
      case "oig-sanctions":
        await new SanctionsOigBot().run({ botRunId, providerId });
        break;
      case "sam-sanctions":
        await new SanctionsSamBot().run({ botRunId, providerId });
        break;
      case "npdb-query":
        await new NpdbQueryBot().run({ botRunId, providerId });
        break;
      case "emedral-enrollment":
        await new EmedralEnrollmentBot().run({ botRunId, providerId });
        break;
      case "enrollment-mpp":
        await new EnrollmentPortalBot("MPP").run({ botRunId, providerId });
        break;
      case "enrollment-availity":
        await new EnrollmentPortalBot("AVAILITY").run({ botRunId, providerId });
        break;
      case "enrollment-verity":
        await new EnrollmentPortalBot("VERITY").run({ botRunId, providerId });
        break;
      case "enrollment-eyemed":
        await new EnrollmentPortalBot("EYEMED").run({ botRunId, providerId });
        break;
      case "education-ama":
        console.log(`[PSV Worker] Education AMA verification not yet implemented for botRun ${botRunId}`);
        break;
      case "education-ecfmg":
        console.log(`[PSV Worker] Education ECFMG verification not yet implemented for botRun ${botRunId}`);
        break;
      default:
        throw new Error(`Unknown bot job: ${job.name}`);
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 3, // Max 3 bots running simultaneously
  }
);

psvWorker.on("completed", (job: Job) => {
  console.log(`[PSV Worker] Job completed: ${job.name} (${job.id})`);
});

psvWorker.on("failed", (job: Job | undefined, error: Error) => {
  console.error(`[PSV Worker] Job failed: ${job?.name} (${job?.id}):`, error.message);
});

// ─── Enrollment Bot Worker ─────────────────────────────────────────────────────

const enrollmentWorker = new Worker(
  "enrollment-bot",
  async (job: Job) => {
    const { botRunId, providerId } = job.data as { botRunId: string; providerId: string };
    console.log(`[Enrollment Worker] Processing: ${job.name}`);

    switch (job.name) {
      case "enrollment-mpp":
        await new EnrollmentPortalBot("MPP").run({ botRunId, providerId });
        break;
      case "enrollment-availity":
        await new EnrollmentPortalBot("AVAILITY").run({ botRunId, providerId });
        break;
      default:
        throw new Error(`Unknown enrollment job: ${job.name}`);
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 2,
  }
);

enrollmentWorker.on("failed", (job: Job | undefined, error: Error) => {
  console.error(`[Enrollment Worker] Job failed: ${job?.name}:`, error.message);
});

// ─── Scheduled Job Worker ──────────────────────────────────────────────────────

const scheduledWorker = new Worker(
  "scheduled-jobs",
  async (job: Job) => {
    console.log(`[Scheduled Worker] Running: ${job.name}`);
    switch (job.name) {
      case "expirables-scan":
        await runExpirablesScan();
        break;
      case "sanctions-monthly":
        await runMonthlySanctionsCheck();
        break;
      case "sanctions-weekly":
        await runMonthlySanctionsCheck();
        break;
      case "follow-up-cadence":
        await runFollowUpCadence();
        break;
      case "license-poll":
        await runLicensePoll();
        break;
      case "recredentialing-check":
        await runRecredentialingCheck();
        break;
      default:
        throw new Error(`Unknown scheduled job: ${job.name}`);
    }
  },
  {
    connection: createRedisConnection(),
    concurrency: 1,
  }
);

// ─── Scheduled Job Registration ────────────────────────────────────────────────

function scheduleJobs() {
  const isDev = process.env.NODE_ENV !== "production";

  // In dev, use much longer intervals and run initial jobs only once after a delay
  const NIGHTLY_MS = isDev ? 12 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000; // 12h dev / 24h prod
  const WEEKLY_MS = isDev ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const MONTHLY_MS = isDev ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  const HOURLY_MS = isDev ? 4 * 60 * 60 * 1000 : 60 * 60 * 1000; // 4h dev / 1h prod

  // Use BullMQ's built-in repeatable jobs instead of setInterval.
  // This deduplicates: if a repeat job with the same key already exists, it won't be added again.
  const opts = { removeOnComplete: { count: 5 }, removeOnFail: { count: 10 } };

  void scheduledJobQueue.add("expirables-scan", { scheduled: true }, {
    ...opts, repeat: { every: NIGHTLY_MS, key: "expirables-scan" },
  });

  void scheduledJobQueue.add("follow-up-cadence", { scheduled: true }, {
    ...opts, repeat: { every: HOURLY_MS, key: "follow-up-cadence" },
  });

  void scheduledJobQueue.add("recredentialing-check", { scheduled: true }, {
    ...opts, repeat: { every: NIGHTLY_MS, key: "recredentialing-check" },
  });

  void scheduledJobQueue.add("license-poll", { scheduled: true }, {
    ...opts, repeat: { every: NIGHTLY_MS, key: "license-poll" },
  });

  // Only schedule sanctions jobs if the required credentials are configured
  const hasAzureBlob = !!process.env.AZURE_BLOB_ACCOUNT_URL;
  const hasSamKey = !!process.env.SAM_GOV_API_KEY;

  if (hasAzureBlob || hasSamKey) {
    void scheduledJobQueue.add("sanctions-weekly", { scheduled: true }, {
      ...opts, repeat: { every: WEEKLY_MS, key: "sanctions-weekly" },
    });
    void scheduledJobQueue.add("sanctions-monthly", { scheduled: true }, {
      ...opts, repeat: { every: MONTHLY_MS, key: "sanctions-monthly" },
    });
    console.log("[Scheduler] Sanctions jobs scheduled (credentials configured)");
  } else {
    console.log("[Scheduler] Sanctions jobs SKIPPED — AZURE_BLOB_ACCOUNT_URL and SAM_GOV_API_KEY not set");
  }

  console.log(`[Scheduler] Jobs registered (${isDev ? "DEV intervals" : "PROD intervals"}): expirables-scan, follow-up-cadence, recredentialing-check, license-poll`);
}

// ─── Bull Board Dashboard ──────────────────────────────────────────────────────

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/bull-board");

createBullBoard({
  queues: [
    new BullMQAdapter(psvBotQueue),
    new BullMQAdapter(enrollmentBotQueue),
    new BullMQAdapter(scheduledJobQueue),
  ],
  serverAdapter,
});

const app = express();
app.use("/bull-board", serverAdapter.getRouter());
app.get("/health", (_req: express.Request, res: express.Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const WORKER_PORT = parseInt(process.env.BULL_BOARD_PORT ?? "6025", 10);
app.listen(WORKER_PORT, () => {
  console.log(`[Worker] Bull Board running on http://localhost:${WORKER_PORT}/bull-board`);
  scheduleJobs();
});

// Graceful shutdown
process.on("SIGTERM", async () => {
  console.log("[Worker] Shutting down...");
  await Promise.all([
    psvWorker.close(),
    enrollmentWorker.close(),
    scheduledWorker.close(),
    psvBotQueue.close(),
    enrollmentBotQueue.close(),
    scheduledJobQueue.close(),
  ]);
  process.exit(0);
});

console.log("[Worker] Workers started and listening for jobs...");
