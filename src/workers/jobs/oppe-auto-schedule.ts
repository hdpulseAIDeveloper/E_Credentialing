/**
 * src/workers/jobs/oppe-auto-schedule.ts
 *
 * P2 Gap #17 — Joint Commission NPG 12 OPPE auto-scheduling job.
 *
 * The Joint Commission Medical Staff standard MS.08.01.03 requires Ongoing
 * Professional Practice Evaluation on a routine basis (industry convention
 * is every 6 months). For every approved provider with active hospital
 * privileges we ensure there is always a SCHEDULED OPPE pointing at the
 * current period and a follow-on OPPE pre-scheduled for the next period.
 *
 * The job is idempotent: it never creates a duplicate OPPE for an existing
 * window.
 *
 * Wave 3.1 refactor: the actual scheduling logic now lives in
 * `EvaluationService.runAutoOppeSchedule` so it can be unit-tested without
 * spinning up Redis / BullMQ. This file is the BullMQ entry point only.
 */

import { PrismaClient } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";
import {
  EvaluationService,
  type AutoOppeSummary,
} from "@/server/services/evaluation";

const db = new PrismaClient();

/**
 * Single shared service instance — Prisma client is process-singleton so we
 * keep one EvaluationService alongside it.
 */
const service = new EvaluationService({
  db,
  audit: writeAuditLog,
  actor: { id: "system", role: "SYSTEM" },
});

export async function runOppeAutoSchedule(): Promise<AutoOppeSummary> {
  const summary = await service.runAutoOppeSchedule();
  console.log(
    `[OppeAutoSchedule] providers=${summary.providersConsidered} ` +
      `created=${summary.oppesCreated} errors=${summary.errors}`,
  );
  return summary;
}

export type { AutoOppeSummary };
