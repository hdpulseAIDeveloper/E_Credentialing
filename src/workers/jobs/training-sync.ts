/**
 * P2 Gap #18 — Nightly staff-training sync + reminder job.
 *
 * Each night this job:
 *   1. Re-syncs assignments for every active staff user (so newly added
 *      courses or new staff members are picked up automatically).
 *   2. Reconciles statuses against StaffTrainingRecord completions
 *      (handled inside syncAssignmentsForUser).
 *   3. Sends tiered email reminders for assignments approaching or past
 *      their due date, with de-duplication on `lastReminderSentAt`.
 */

import { PrismaClient } from "@prisma/client";
import { syncAllAssignments } from "@/lib/training";
import { sendStaffTrainingReminder, tryEmail } from "@/lib/email/verifications";

const db = new PrismaClient();

const REMINDER_TIERS_DAYS = [30, 14, 7, 3, 0, -7, -14, -30];

const APP_URL = (
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:6015"
).replace(/\/+$/, "");

interface RunSummary {
  syncedUsers: number;
  remindersAttempted: number;
  remindersDelivered: number;
}

function pickTier(daysUntilDue: number): number | null {
  for (const tier of REMINDER_TIERS_DAYS) {
    // Pick the closest tier band (within ±2 days of tier marker).
    if (Math.abs(daysUntilDue - tier) <= 2) return tier;
  }
  return null;
}

export async function runStaffTrainingSync(): Promise<RunSummary> {
  const summary: RunSummary = {
    syncedUsers: 0,
    remindersAttempted: 0,
    remindersDelivered: 0,
  };

  const sync = await syncAllAssignments(db);
  summary.syncedUsers = sync.usersConsidered;
  console.log(
    `[StaffTrainingSync] users=${sync.usersConsidered} ` +
      `created=${sync.assignmentsCreated} updated=${sync.assignmentsUpdated} ` +
      `errors=${sync.errors}`
  );

  const trainingPortalUrl = `${APP_URL}/training`;
  const now = new Date();
  const reminderWindow = 33; // anything more than ~33 days out is ignored

  const upcoming = await db.trainingAssignment.findMany({
    where: {
      status: { in: ["ASSIGNED", "IN_PROGRESS", "OVERDUE"] },
      dueDate: { not: null },
    },
    include: {
      user: { select: { id: true, email: true, displayName: true, isActive: true } },
      course: { select: { title: true } },
    },
  });

  for (const a of upcoming) {
    if (!a.dueDate || !a.user.isActive || !a.user.email) continue;
    const days = Math.ceil(
      (a.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
    );
    if (days > reminderWindow) continue;

    const tier = pickTier(days);
    if (tier == null) continue;

    // De-duplicate: skip if we already sent a reminder for this tier today.
    if (
      a.lastReminderSentAt &&
      now.getTime() - a.lastReminderSentAt.getTime() < 23 * 60 * 60 * 1000
    ) {
      continue;
    }

    summary.remindersAttempted += 1;
    const result = await tryEmail(() =>
      sendStaffTrainingReminder({
        to: a.user.email,
        staffName: a.user.displayName ?? a.user.email,
        courseTitle: a.course.title,
        dueDate: a.dueDate!,
        daysUntilDue: days,
        trainingPortalUrl,
      })
    );
    if (result.delivered) {
      summary.remindersDelivered += 1;
    }
    await db.trainingAssignment.update({
      where: { id: a.id },
      data: {
        remindersSent: { increment: 1 },
        lastReminderSentAt: now,
      },
    });
  }

  console.log(
    `[StaffTrainingSync] reminders attempted=${summary.remindersAttempted} ` +
      `delivered=${summary.remindersDelivered}`
  );
  return summary;
}
