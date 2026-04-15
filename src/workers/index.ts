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
      case "follow-up-cadence":
        await runFollowUpCadence();
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
  // Nightly expirables scan (every 24 hours)
  const NIGHTLY_MS = 24 * 60 * 60 * 1000;
  setInterval(async () => {
    await scheduledJobQueue.add("expirables-scan", { runDate: new Date().toISOString() }, {
      priority: 10,
      attempts: 2,
    });
  }, NIGHTLY_MS);

  // Monthly sanctions check (every 30 days)
  const MONTHLY_MS = 30 * 24 * 60 * 60 * 1000;
  setInterval(async () => {
    await scheduledJobQueue.add("sanctions-monthly", { runDate: new Date().toISOString() }, {
      priority: 10,
      attempts: 2,
    });
  }, MONTHLY_MS);

  // Hourly follow-up cadence
  const HOURLY_MS = 60 * 60 * 1000;
  setInterval(async () => {
    await scheduledJobQueue.add("follow-up-cadence", { runDate: new Date().toISOString() }, {
      priority: 10,
      attempts: 2,
    });
  }, HOURLY_MS);

  console.log("[Scheduler] Jobs registered: expirables-scan (daily), sanctions-monthly, follow-up-cadence (hourly)");
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
app.get("/health", (_req, res) => {
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
