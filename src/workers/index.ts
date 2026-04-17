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
import { EducationAmaBot } from "./bots/education-ama";
import { EducationEcfmgBot } from "./bots/education-ecfmg";
import { EducationAcgmeBot } from "./bots/education-acgme";
import { runExpirablesScan } from "./jobs/expirables-scan";
import { runSanctions30DayMonitoring } from "./jobs/sanctions-30day";
import { runFollowUpCadence } from "./jobs/follow-up-cadence";
import { runLicensePoll } from "./jobs/license-poll";
import { runRecredentialingCheck } from "./jobs/recredentialing-check";
import { runContinuousLicenseMonitoring } from "./jobs/continuous-license-monitoring";
import { runRosterAckPoll } from "./jobs/roster-ack-poll";
import { runCaqhReattestationReminders } from "./jobs/caqh-reattestation";
import { runTelehealthComplianceCheck } from "./jobs/telehealth-compliance";
import { runOppeAutoSchedule } from "./jobs/oppe-auto-schedule";
import { runStaffTrainingSync } from "./jobs/training-sync";
import { runFsmbPdcPoll } from "./jobs/fsmb-pdc-poll";
import { runSupervisionReminderSweep } from "./jobs/supervision-reminder";
import { runStateMedicaidExclusion } from "./bots/state-medicaid/runner";

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
        await new EducationAmaBot().run({ botRunId, providerId });
        break;
      case "education-ecfmg":
        await new EducationEcfmgBot().run({ botRunId, providerId });
        break;
      case "education-acgme":
        await new EducationAcgmeBot().run({ botRunId, providerId });
        break;
      case "state-medicaid-exclusion": {
        const { state } = job.data as { botRunId: string; providerId: string; state: string };
        await runStateMedicaidExclusion({ botRunId, providerId, state });
        break;
      }
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
      case "sanctions-recheck":
      case "sanctions-30day":
        // P0 Gap #4: NCQA-mandated 30-day continuous monitoring sweep.
        // Federal (OIG, SAM) + state Medicaid exclusion fan-out across
        // every active license state.
        await runSanctions30DayMonitoring();
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
      case "continuous-license-monitoring":
        // P1 Gap #9: nightly diff-aware re-poll across every active license
        // for approved providers. Raises MonitoringAlerts on status changes
        // and flagged disciplinary actions.
        await runContinuousLicenseMonitoring();
        break;
      case "roster-ack-poll":
        // P1 Gap #13: hourly poll of payer SFTP ack directories for
        // outstanding RosterSubmissions.
        await runRosterAckPoll();
        break;
      case "caqh-reattestation":
        // P1 Gap #14: nightly CAQH ProView 120-day re-attestation reminder
        // sweep (tiered: 30 / 14 / 3 / overdue).
        await runCaqhReattestationReminders();
        break;
      case "telehealth-compliance":
        // P1 Gap #15: nightly telehealth coverage / cert / LoQ compliance
        // sweep. Raises MonitoringAlerts for coverage gaps, expiring
        // platform certs, and expiring IMLC Letters of Qualification.
        await runTelehealthComplianceCheck();
        break;
      case "oppe-auto-schedule":
        // P2 Gap #17 — Joint Commission NPG 12: keep OPPE evaluations
        // continuously scheduled at the JC standard 6-month cadence.
        await runOppeAutoSchedule();
        break;
      case "staff-training-sync":
        // P2 Gap #18 — sync NCQA training assignments and send tiered
        // reminders for upcoming/overdue staff training.
        await runStaffTrainingSync();
        break;
      case "fsmb-pdc-poll":
        // P3 Gap #21 — FSMB PDC daily NDJSON pull for board actions,
        // license-status changes, and disciplinary reports.
        await runFsmbPdcPoll();
        break;
      case "supervision-reminder":
        // P3 Gap #22 — daily sweep for provisionally-licensed
        // behavioral-health clinicians whose supervision attestation is
        // overdue or whose provisional license is about to expire.
        await runSupervisionReminderSweep();
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

  // P1 Gap #9: continuous license monitoring with diff alerts.
  // Runs nightly so disciplinary actions surface within 24h of the
  // state board updating its public record (vs. waiting for the next
  // expiry-driven re-verification).
  if (process.env.CONTINUOUS_MONITORING_DISABLED === "true") {
    console.log("[Scheduler] continuous-license-monitoring DISABLED via env");
  } else {
    void scheduledJobQueue.add("continuous-license-monitoring", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "continuous-license-monitoring" },
    });
  }

  // NCQA 2026 standard (P0 Gap #4): continuous monitoring at most every 30
  // days for OIG, SAM, Medicare opt-out, and state Medicaid sanctions —
  // across every state the practitioner practices. We schedule weekly so the
  // 30-day window is comfortably hit even if a single sweep is delayed.
  const hasAzureBlob = !!process.env.AZURE_BLOB_ACCOUNT_URL;
  const hasSamKey = !!process.env.SAM_GOV_API_KEY;
  const sanctionsExplicitlyDisabled = process.env.SANCTIONS_RECHECK_DISABLED === "true";

  if (sanctionsExplicitlyDisabled) {
    console.log("[Scheduler] sanctions-30day DISABLED via SANCTIONS_RECHECK_DISABLED=true");
  } else if (hasAzureBlob || hasSamKey) {
    void scheduledJobQueue.add("sanctions-30day", { scheduled: true }, {
      ...opts, repeat: { every: WEEKLY_MS, key: "sanctions-30day" },
    });
    console.log(`[Scheduler] sanctions-30day scheduled every ${WEEKLY_MS / 1000 / 60 / 60}h (NCQA 30-day continuous monitoring)`);
  } else {
    console.log("[Scheduler] sanctions-30day SKIPPED — neither AZURE_BLOB_ACCOUNT_URL nor SAM_GOV_API_KEY set");
  }

  // Retained for any future 30-day cadence references.
  void MONTHLY_MS;

  // P1 Gap #13: hourly SFTP ack polling for outstanding roster submissions.
  if (process.env.ROSTER_ACK_POLL_DISABLED === "true") {
    console.log("[Scheduler] roster-ack-poll DISABLED via env");
  } else {
    void scheduledJobQueue.add("roster-ack-poll", { scheduled: true }, {
      ...opts, repeat: { every: HOURLY_MS, key: "roster-ack-poll" },
    });
  }

  // P1 Gap #14: nightly CAQH ProView re-attestation reminder sweep.
  if (process.env.CAQH_REATTEST_REMINDERS_DISABLED === "true") {
    console.log("[Scheduler] caqh-reattestation DISABLED via env");
  } else {
    void scheduledJobQueue.add("caqh-reattestation", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "caqh-reattestation" },
    });
  }

  // P1 Gap #15: nightly telehealth coverage / cert / LoQ compliance sweep.
  if (process.env.TELEHEALTH_COMPLIANCE_DISABLED === "true") {
    console.log("[Scheduler] telehealth-compliance DISABLED via env");
  } else {
    void scheduledJobQueue.add("telehealth-compliance", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "telehealth-compliance" },
    });
  }

  // P2 Gap #17 — Joint Commission NPG 12 OPPE auto-scheduling. Nightly
  // cadence keeps the OPPE pipeline always pre-populated.
  if (process.env.OPPE_AUTO_SCHEDULE_DISABLED === "true") {
    console.log("[Scheduler] oppe-auto-schedule DISABLED via env");
  } else {
    void scheduledJobQueue.add("oppe-auto-schedule", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "oppe-auto-schedule" },
    });
  }

  // P2 Gap #18 — NCQA staff training sync + reminder cadence.
  if (process.env.STAFF_TRAINING_SYNC_DISABLED === "true") {
    console.log("[Scheduler] staff-training-sync DISABLED via env");
  } else {
    void scheduledJobQueue.add("staff-training-sync", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "staff-training-sync" },
    });
  }

  // P3 Gap #21 — FSMB Practitioner Data Center daily NDJSON pull. Only
  // worth scheduling when a feed source is configured.
  const fsmbConfigured = !!process.env.FSMB_PDC_FEED_URL || !!process.env.FSMB_PDC_FEED_FILE;
  if (process.env.FSMB_PDC_POLL_DISABLED === "true" || !fsmbConfigured) {
    console.log(
      `[Scheduler] fsmb-pdc-poll ${
        fsmbConfigured ? "DISABLED via env" : "SKIPPED (no FSMB_PDC_FEED_URL/FILE)"
      }`
    );
  } else {
    void scheduledJobQueue.add("fsmb-pdc-poll", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "fsmb-pdc-poll" },
    });
  }

  // P3 Gap #22 — supervision attestation reminder sweep for behavioral-health
  // provisionally-licensed clinicians.
  if (process.env.SUPERVISION_REMINDER_DISABLED === "true") {
    console.log("[Scheduler] supervision-reminder DISABLED via env");
  } else {
    void scheduledJobQueue.add("supervision-reminder", { scheduled: true }, {
      ...opts, repeat: { every: NIGHTLY_MS, key: "supervision-reminder" },
    });
  }

  console.log(`[Scheduler] Jobs registered (${isDev ? "DEV intervals" : "PROD intervals"}): expirables-scan, follow-up-cadence, recredentialing-check, license-poll, continuous-license-monitoring, roster-ack-poll, caqh-reattestation, telehealth-compliance, oppe-auto-schedule, staff-training-sync, fsmb-pdc-poll, supervision-reminder`);
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
