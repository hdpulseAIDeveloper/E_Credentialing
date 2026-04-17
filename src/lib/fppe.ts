/**
 * P2 Gap #17 — Joint Commission NPG 12 helpers.
 *
 * The Joint Commission (MS.08.01.01) requires Focused Professional Practice
 * Evaluation (FPPE) for every newly granted clinical privilege so that
 * competence is demonstrably evaluated within a defined period after the
 * grant. This helper auto-creates that FPPE evaluation row when staff mark
 * a hospital privilege as APPROVED, with the appropriate trigger metadata
 * so the chain of custody is auditable.
 */

import type { PrismaClient } from "@prisma/client";

const FPPE_DEFAULT_PERIOD_DAYS = 90; // standard JC FPPE window after grant

export interface CreateAutoFppeOptions {
  /** Override default 90-day window. */
  periodDays?: number;
  /** Override the stored trigger label. */
  trigger?: string;
}

export async function createAutoFppeForPrivilege(
  db: PrismaClient,
  privilegeId: string,
  options: CreateAutoFppeOptions = {}
): Promise<string | null> {
  const privilege = await db.hospitalPrivilege.findUnique({
    where: { id: privilegeId },
    select: {
      id: true,
      providerId: true,
      facilityName: true,
      privilegeType: true,
      effectiveDate: true,
      approvedDate: true,
      status: true,
    },
  });
  if (!privilege) return null;

  // Avoid double-creation: skip if any FPPE for this privilege already exists.
  const existing = await db.practiceEvaluation.findFirst({
    where: {
      providerId: privilege.providerId,
      privilegeId,
      evaluationType: "FPPE",
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  const grantDate =
    privilege.effectiveDate ?? privilege.approvedDate ?? new Date();
  const periodDays = options.periodDays ?? FPPE_DEFAULT_PERIOD_DAYS;
  const periodEnd = new Date(grantDate);
  periodEnd.setDate(periodEnd.getDate() + periodDays);

  const trigger =
    options.trigger ??
    `Auto-FPPE for newly granted privilege "${privilege.privilegeType}" at ${privilege.facilityName}`;

  const created = await db.practiceEvaluation.create({
    data: {
      providerId: privilege.providerId,
      evaluationType: "FPPE",
      privilegeId,
      periodStart: grantDate,
      periodEnd,
      dueDate: periodEnd,
      trigger,
      triggerRefId: privilegeId,
    },
    select: { id: true },
  });

  return created.id;
}
