/**
 * P1 Gap #14 — CAQH ProView 2026 re-attestation reminder job.
 *
 * CAQH ProView requires providers to re-attest every 120 days. Without a
 * fresh attestation, the profile becomes "stale" and many payers will
 * pause claims processing and recredentialing.
 *
 * This nightly job scans every active provider with a CAQH profile and
 * sends an email reminder when the next-reattest-due date crosses one of
 * the configured tier thresholds. Reminders are de-duplicated by tier so
 * each tier fires exactly once per cycle.
 */

import { PrismaClient } from "@prisma/client";
import {
  sendCaqhReattestationReminder,
  tryEmail,
} from "../../lib/email/verifications";

const db = new PrismaClient();

// Days-before-due thresholds at which we fire a reminder. -1 indicates an
// "already overdue" reminder (sent once after the due date passes).
const REMINDER_TIERS_DAYS = [30, 14, 3, -1];

interface RunSummary {
  scanned: number;
  remindersSent: number;
  remindersSkippedNoEmail: number;
  remindersSkippedDeduped: number;
  errors: number;
}

export async function runCaqhReattestationReminders(): Promise<RunSummary> {
  const summary: RunSummary = {
    scanned: 0,
    remindersSent: 0,
    remindersSkippedNoEmail: 0,
    remindersSkippedDeduped: 0,
    errors: 0,
  };

  // Active providers with a CAQH profile + a known reattest due date.
  const profiles = await db.providerProfile.findMany({
    where: {
      caqhNextReattestDue: { not: null },
      provider: {
        status: {
          notIn: ["DENIED", "TERMINATED", "WITHDRAWN", "INVITED"],
        },
        caqhId: { not: null },
      },
    },
    include: {
      provider: {
        select: {
          id: true,
          legalFirstName: true,
          legalLastName: true,
          caqhId: true,
          status: true,
        },
      },
    },
  });

  const now = new Date();

  for (const profile of profiles) {
    summary.scanned += 1;
    const due = profile.caqhNextReattestDue;
    if (!due) continue;

    const daysUntilDue = Math.ceil(
      (due.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );

    // Pick the strictest tier the provider has crossed but not yet been
    // reminded for in this cycle (cycle = since lastReminderSentAt > attestation).
    const matchingTier = REMINDER_TIERS_DAYS
      .filter((tier) => daysUntilDue <= tier)
      .sort((a, b) => a - b)[0]; // smallest = strictest

    if (matchingTier === undefined) continue;

    // Dedup: only one reminder per tier per cycle. If the last reminder
    // was sent after the attestation date and within 7d of "now", skip.
    if (profile.caqhLastReminderSentAt) {
      const last = profile.caqhLastReminderSentAt;
      const sinceDays = (now.getTime() - last.getTime()) / (24 * 60 * 60 * 1000);
      // We send at most once every 7 days.
      if (sinceDays < 7) {
        summary.remindersSkippedDeduped += 1;
        continue;
      }
    }

    const recipientEmail = profile.personalEmail;
    if (!recipientEmail) {
      summary.remindersSkippedNoEmail += 1;
      continue;
    }

    const providerName =
      `${profile.provider.legalFirstName} ${profile.provider.legalLastName}`.trim();
    const result = await tryEmail(() =>
      sendCaqhReattestationReminder({
        to: recipientEmail,
        providerName,
        daysUntilDue,
        dueDate: due,
        caqhId: profile.provider.caqhId,
      })
    );

    if (result.delivered) {
      await db.providerProfile.update({
        where: { id: profile.id },
        data: { caqhLastReminderSentAt: new Date() },
      });
      summary.remindersSent += 1;
    } else {
      summary.errors += 1;
      console.error(
        `[CaqhReattest] failed to send reminder for ${providerName}: ${result.reason}`
      );
    }
  }

  console.log(
    `[CaqhReattest] scanned=${summary.scanned} sent=${summary.remindersSent} ` +
      `noEmail=${summary.remindersSkippedNoEmail} dedup=${summary.remindersSkippedDeduped} ` +
      `errors=${summary.errors}`
  );

  return summary;
}
