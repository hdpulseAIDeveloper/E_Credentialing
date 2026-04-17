/**
 * P2 Gap #17 — Joint Commission NPG 12 OPPE auto-scheduling job.
 *
 * The Joint Commission Medical Staff standard MS.08.01.03 requires
 * Ongoing Professional Practice Evaluation on a routine basis (industry
 * convention is every 6 months). For every approved provider with active
 * hospital privileges we ensure there is always a SCHEDULED OPPE
 * evaluation pointing at the current period and a follow-on OPPE
 * pre-scheduled for the next period.
 *
 * The job is idempotent: it never creates a duplicate OPPE for an
 * existing window.
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const OPPE_PERIOD_MONTHS = 6;
const OPPE_LOOKAHEAD_DAYS = 30;

interface RunSummary {
  providersConsidered: number;
  oppesCreated: number;
  errors: number;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

export async function runOppeAutoSchedule(): Promise<RunSummary> {
  const summary: RunSummary = {
    providersConsidered: 0,
    oppesCreated: 0,
    errors: 0,
  };

  const providers = await db.provider.findMany({
    where: {
      status: "APPROVED",
      hospitalPrivileges: {
        some: { status: "APPROVED" },
      },
    },
    select: {
      id: true,
      legalFirstName: true,
      legalLastName: true,
      practiceEvaluations: {
        where: { evaluationType: "OPPE" },
        orderBy: { periodEnd: "desc" },
        take: 5,
      },
    },
  });

  const now = new Date();

  for (const provider of providers) {
    summary.providersConsidered += 1;
    try {
      // Find the most recent OPPE row.
      const latest = provider.practiceEvaluations[0];

      // If no OPPE has ever been created, seed one for the current period.
      if (!latest) {
        const periodStart = new Date(now);
        const periodEnd = addMonths(periodStart, OPPE_PERIOD_MONTHS);
        await db.practiceEvaluation.create({
          data: {
            providerId: provider.id,
            evaluationType: "OPPE",
            periodStart,
            periodEnd,
            dueDate: periodEnd,
            trigger: "Auto-scheduled OPPE — initial cycle",
          },
        });
        summary.oppesCreated += 1;
        continue;
      }

      // If the latest OPPE will end within OPPE_LOOKAHEAD_DAYS, queue
      // the next one immediately so it never lapses.
      const daysUntilLatestEnds = Math.ceil(
        (latest.periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
      );

      if (daysUntilLatestEnds <= OPPE_LOOKAHEAD_DAYS) {
        const nextStart = new Date(latest.periodEnd);
        nextStart.setDate(nextStart.getDate() + 1);
        const nextEnd = addMonths(nextStart, OPPE_PERIOD_MONTHS);

        // Idempotency: skip if a scheduled OPPE for that window already exists.
        const exists = await db.practiceEvaluation.findFirst({
          where: {
            providerId: provider.id,
            evaluationType: "OPPE",
            periodStart: nextStart,
          },
          select: { id: true },
        });
        if (!exists) {
          await db.practiceEvaluation.create({
            data: {
              providerId: provider.id,
              evaluationType: "OPPE",
              periodStart: nextStart,
              periodEnd: nextEnd,
              dueDate: nextEnd,
              trigger: "Auto-scheduled OPPE — next routine cycle",
            },
          });
          summary.oppesCreated += 1;
        }
      }
    } catch (error) {
      summary.errors += 1;
      console.error(
        `[OppeAutoSchedule] error for provider ${provider.id}:`,
        error
      );
    }
  }

  console.log(
    `[OppeAutoSchedule] providers=${summary.providersConsidered} ` +
      `created=${summary.oppesCreated} errors=${summary.errors}`
  );
  return summary;
}
