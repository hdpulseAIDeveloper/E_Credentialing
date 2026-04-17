/**
 * P1 Gap #9 — Nightly continuous license monitoring with diff alerts.
 *
 * Different from license-poll.ts:
 *   • license-poll.ts re-verifies licenses approaching expiration so the
 *     bot can refresh evidence before the renewal window closes.
 *   • This job runs nightly across ALL active licenses for approved
 *     providers regardless of expiration. After each verification it
 *     compares the new VerificationRecord against the prior one and
 *     creates a MonitoringAlert if status changed (e.g. ACTIVE -> SUSPENDED,
 *     ACTIVE -> SURRENDERED, new disciplinary action surfaced).
 *
 * Cadence: nightly, but each license has a ≥7 day cooldown so the bot
 * doesn't re-poll the same source 30+ times a month.
 */

import { PrismaClient } from "@prisma/client";
import { Queue } from "bullmq";
import { createRedisConnection } from "../../lib/redis";
import { createMonitoringAlert } from "../../lib/monitoring-alerts";

const db = new PrismaClient();

// How long after the last verification before we re-poll a given license.
const RE_POLL_COOLDOWN_DAYS = 7;

interface RunSummary {
  licensesScanned: number;
  verificationsQueued: number;
  diffsDetected: number;
  alertsCreated: number;
  cooldownSkipped: number;
}

export async function runContinuousLicenseMonitoring(): Promise<RunSummary> {
  console.log("[ContinuousLicenseMonitoring] Starting nightly sweep...");

  const queue = new Queue("psv-bot", { connection: createRedisConnection() });
  const summary: RunSummary = {
    licensesScanned: 0,
    verificationsQueued: 0,
    diffsDetected: 0,
    alertsCreated: 0,
    cooldownSkipped: 0,
  };

  try {
    const licenses = await db.license.findMany({
      where: {
        status: "ACTIVE",
        provider: { status: "APPROVED" },
      },
      select: {
        id: true,
        providerId: true,
        state: true,
        licenseNumber: true,
        provider: {
          select: { legalFirstName: true, legalLastName: true },
        },
      },
    });

    summary.licensesScanned = licenses.length;
    console.log(
      `[ContinuousLicenseMonitoring] Scanning ${licenses.length} active licenses.`
    );

    const cooldownCutoff = new Date(
      Date.now() - RE_POLL_COOLDOWN_DAYS * 24 * 60 * 60 * 1000
    );

    for (const license of licenses) {
      // Look at the most recent license verification record for the diff
      // baseline AND for cooldown enforcement.
      const lastVerifications = await db.verificationRecord.findMany({
        where: {
          providerId: license.providerId,
          credentialType: "LICENSE",
        },
        orderBy: { verifiedDate: "desc" },
        take: 2,
      });

      const last = lastVerifications[0];
      const previous = lastVerifications[1];

      // Diff detection: if the latest verification (from a recent run that
      // happened since this job last looked) shows a status worse than the
      // prior one, raise an alert. We check this BEFORE deciding whether
      // to re-poll, because the diff might already be sitting in the DB.
      if (last && previous) {
        const lastDetails = (last.resultDetails as Record<string, unknown>) ?? {};
        const prevDetails = (previous.resultDetails as Record<string, unknown>) ?? {};

        const lastStatus = String(lastDetails.licenseStatus ?? last.status ?? "");
        const prevStatus = String(prevDetails.licenseStatus ?? previous.status ?? "");

        const statusChanged =
          lastStatus &&
          prevStatus &&
          lastStatus.toUpperCase() !== prevStatus.toUpperCase();

        if (statusChanged) {
          summary.diffsDetected += 1;

          const isCritical =
            /SUSPEND|REVOK|SURRENDER|EXPIRED|INACTIVE|VOLUNTAR/i.test(lastStatus);

          const alertId = await createMonitoringAlert(db, {
            providerId: license.providerId,
            type: "LICENSE_STATUS_CHANGE",
            severity: isCritical ? "CRITICAL" : "WARNING",
            source: `LICENSE_POLL_${license.state.toUpperCase()}`,
            title: `${license.state} License status changed`,
            description: `License #${license.licenseNumber} status changed from "${prevStatus}" to "${lastStatus}".`,
            evidence: {
              licenseId: license.id,
              state: license.state,
              licenseNumber: license.licenseNumber,
              previousStatus: prevStatus,
              currentStatus: lastStatus,
              previousVerificationId: previous.id,
              currentVerificationId: last.id,
              previousVerifiedDate: previous.verifiedDate,
              currentVerifiedDate: last.verifiedDate,
            },
          });

          if (alertId) summary.alertsCreated += 1;
        }

        // Also surface flagged verifications as alerts (e.g., bot detected
        // a disciplinary action on the source page).
        if (last.isFlagged && (!previous.isFlagged || previous.flagReason !== last.flagReason)) {
          summary.diffsDetected += 1;
          const alertId = await createMonitoringAlert(db, {
            providerId: license.providerId,
            type: "LICENSE_DISCIPLINARY_ACTION",
            severity: "CRITICAL",
            source: `LICENSE_POLL_${license.state.toUpperCase()}`,
            title: `Disciplinary action flagged on ${license.state} license`,
            description:
              last.flagReason ?? "Bot flagged the latest license verification.",
            evidence: {
              licenseId: license.id,
              state: license.state,
              licenseNumber: license.licenseNumber,
              flagReason: last.flagReason,
              verificationId: last.id,
            },
          });
          if (alertId) summary.alertsCreated += 1;
        }
      }

      // Cooldown — skip re-polling if we already have a fresh verification.
      if (last && last.verifiedDate >= cooldownCutoff) {
        summary.cooldownSkipped += 1;
        continue;
      }

      const botRun = await db.botRun.create({
        data: {
          providerId: license.providerId,
          botType: "LICENSE_VERIFICATION",
          triggeredBy: "AUTOMATIC",
          status: "QUEUED",
          attemptCount: 0,
          inputData: {
            licenseId: license.id,
            state: license.state,
            licenseNumber: license.licenseNumber,
            firstName: license.provider.legalFirstName,
            lastName: license.provider.legalLastName,
            triggeredBy: "automatic_continuous_monitoring",
          },
        },
      });

      await queue.add(
        "license-verification",
        { botRunId: botRun.id, providerId: license.providerId },
        {
          priority: 7, // lower priority than expiry-driven polls
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        }
      );

      summary.verificationsQueued += 1;
      // brief pacing so we don't overwhelm an upstream board site
      await new Promise((resolve) => setTimeout(resolve, 75));
    }

    console.log(
      `[ContinuousLicenseMonitoring] Done. ${JSON.stringify(summary)}`
    );
    return summary;
  } catch (error) {
    console.error("[ContinuousLicenseMonitoring] Error:", error);
    throw error;
  } finally {
    await queue.close();
  }
}
