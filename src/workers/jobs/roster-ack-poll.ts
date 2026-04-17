/**
 * P1 Gap #13 — Hourly polling of payer SFTP ack directories.
 *
 * For every RosterSubmission that's been delivered (status SUBMITTED) and
 * doesn't yet have an acknowledgment, this job polls the payer's configured
 * `sftpAckDir` for files matching `sftpAckPattern`. When a match is found it
 * downloads the ack file and flips the submission to ACKNOWLEDGED or ERROR
 * based on whether the file content contains an error/reject token.
 *
 * Runs hourly. Skips submissions where the payer has no SFTP ack config
 * (those are tracked manually by staff). Caps attempts at 24 (≈24h) so a
 * dead payer doesn't generate infinite polls.
 */

import { PrismaClient } from "@prisma/client";
import { pollRosterAck } from "../../lib/integrations/sftp";

const db = new PrismaClient();

const MAX_ATTEMPTS = 24;
const STALE_AFTER_HOURS = 72;

interface RunSummary {
  scanned: number;
  acknowledged: number;
  errored: number;
  pendingStillOpen: number;
  skippedNoConfig: number;
  skippedMaxAttempts: number;
  markedStale: number;
}

export async function runRosterAckPoll(): Promise<RunSummary> {
  const summary: RunSummary = {
    scanned: 0,
    acknowledged: 0,
    errored: 0,
    pendingStillOpen: 0,
    skippedNoConfig: 0,
    skippedMaxAttempts: 0,
    markedStale: 0,
  };

  const submissions = await db.rosterSubmission.findMany({
    where: { status: "SUBMITTED", acknowledgedAt: null },
    include: { roster: true },
  });

  for (const sub of submissions) {
    summary.scanned += 1;

    if (!sub.roster.sftpEnabled || !sub.roster.sftpAckDir || !sub.roster.sftpAckPattern) {
      summary.skippedNoConfig += 1;
      continue;
    }

    if (sub.attemptCount >= MAX_ATTEMPTS) {
      summary.skippedMaxAttempts += 1;
      continue;
    }

    if (!sub.remoteFilename || !sub.submittedAt) {
      summary.skippedNoConfig += 1;
      continue;
    }

    try {
      const result = await pollRosterAck({
        payer: sub.roster,
        remoteFilename: sub.remoteFilename,
        uploadedAt: sub.submittedAt,
      });

      if (result.acknowledged) {
        await db.rosterSubmission.update({
          where: { id: sub.id },
          data: {
            status: "ACKNOWLEDGED",
            acknowledgedAt: new Date(),
            ackFilename: result.ackFilename,
            ackContent: result.ackContent,
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });
        summary.acknowledged += 1;
      } else if (result.errored) {
        await db.rosterSubmission.update({
          where: { id: sub.id },
          data: {
            status: "ERROR",
            ackFilename: result.ackFilename,
            ackContent: result.ackContent,
            ackErrorMessage: result.errorMessage,
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });
        summary.errored += 1;
      } else {
        // No ack file yet — bump attempt count, optionally mark stale.
        const ageHours =
          (Date.now() - sub.submittedAt.getTime()) / (60 * 60 * 1000);
        const stale = ageHours > STALE_AFTER_HOURS;
        await db.rosterSubmission.update({
          where: { id: sub.id },
          data: {
            attemptCount: { increment: 1 },
            lastAttemptAt: new Date(),
            lastError: result.errorMessage,
            notes: stale
              ? `${sub.notes ?? ""}\n[ack-poll] No ack received within ${STALE_AFTER_HOURS}h.`.trim()
              : sub.notes,
          },
        });
        if (stale) summary.markedStale += 1;
        else summary.pendingStillOpen += 1;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `[RosterAckPoll] ${sub.roster.payerName} #${sub.id}: ${msg}`
      );
      await db.rosterSubmission.update({
        where: { id: sub.id },
        data: {
          attemptCount: { increment: 1 },
          lastAttemptAt: new Date(),
          lastError: msg,
        },
      });
    }
  }

  console.log(
    `[RosterAckPoll] scanned=${summary.scanned} ack=${summary.acknowledged} ` +
      `err=${summary.errored} pending=${summary.pendingStillOpen} ` +
      `skipped(no-cfg)=${summary.skippedNoConfig} skipped(max)=${summary.skippedMaxAttempts}`
  );

  return summary;
}
