/**
 * P3 Gap #23 — Readiness scoring helpers.
 *
 * Computes a single "readiness percentage" per framework based on:
 *   • Number of controls with status IMPLEMENTED (full credit)
 *   • PARTIAL controls (half credit)
 *   • IN_PROGRESS controls (quarter credit)
 *   • NOT_APPLICABLE controls excluded from denominator
 *
 * Also surfaces:
 *   • Open gap counts by severity
 *   • Controls with stale or missing reviews (review > 365 days)
 *   • Controls with no evidence in the past 365 days
 *   • The currently-active audit period (if any)
 */

import {
  ComplianceFramework,
  type PrismaClient,
  ComplianceControlStatus,
  ComplianceGapStatus,
  ComplianceGapSeverity,
} from "@prisma/client";

export interface ReadinessSummary {
  framework: ComplianceFramework;
  totalControls: number;
  applicableControls: number;
  byStatus: Record<ComplianceControlStatus, number>;
  readinessPercent: number;
  openGapsBySeverity: Record<ComplianceGapSeverity, number>;
  staleReviewControls: number;
  staleEvidenceControls: number;
  activeAuditPeriodId: string | null;
  nextAuditPeriodStart: Date | null;
}

const STATUS_WEIGHT: Record<ComplianceControlStatus, number> = {
  IMPLEMENTED: 1,
  PARTIAL: 0.5,
  IN_PROGRESS: 0.25,
  NOT_STARTED: 0,
  NOT_APPLICABLE: 0,
};

export async function getReadinessSummary(
  db: PrismaClient,
  framework: ComplianceFramework
): Promise<ReadinessSummary> {
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const controls = await db.complianceControl.findMany({
    where: { framework },
    include: {
      _count: {
        select: {
          evidence: { where: { addedAt: { gte: oneYearAgo } } },
          gaps: { where: { status: { not: ComplianceGapStatus.CLOSED } } },
        },
      },
    },
  });

  const byStatus: Record<ComplianceControlStatus, number> = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0,
    IMPLEMENTED: 0,
    PARTIAL: 0,
    NOT_APPLICABLE: 0,
  };
  let weightedScore = 0;
  let staleReview = 0;
  let staleEvidence = 0;

  for (const control of controls) {
    byStatus[control.status]++;
    if (control.status !== "NOT_APPLICABLE") {
      weightedScore += STATUS_WEIGHT[control.status];
    }
    if (
      !control.lastReviewedAt ||
      control.lastReviewedAt < oneYearAgo ||
      (control.nextReviewDue && control.nextReviewDue < now)
    ) {
      staleReview++;
    }
    if (control._count.evidence === 0 && control.status !== "NOT_APPLICABLE") {
      staleEvidence++;
    }
  }

  const applicableControls =
    controls.length - byStatus.NOT_APPLICABLE;
  const readinessPercent =
    applicableControls === 0
      ? 0
      : Math.round((weightedScore / applicableControls) * 100);

  const gaps = await db.complianceGap.groupBy({
    by: ["severity"],
    where: {
      status: { in: ["OPEN", "IN_REMEDIATION", "PENDING_VALIDATION"] },
      control: { framework },
    },
    _count: true,
  });
  const openGapsBySeverity: Record<ComplianceGapSeverity, number> = {
    LOW: 0,
    MODERATE: 0,
    HIGH: 0,
    CRITICAL: 0,
  };
  for (const g of gaps) openGapsBySeverity[g.severity] = g._count;

  const activeAudit = await db.complianceAuditPeriod.findFirst({
    where: { framework, status: { in: ["PLANNING", "FIELDWORK", "REPORTING"] } },
    orderBy: { periodStart: "asc" },
  });

  const nextAudit = await db.complianceAuditPeriod.findFirst({
    where: { framework, periodStart: { gt: now }, status: "PLANNING" },
    orderBy: { periodStart: "asc" },
  });

  return {
    framework,
    totalControls: controls.length,
    applicableControls,
    byStatus,
    readinessPercent,
    openGapsBySeverity,
    staleReviewControls: staleReview,
    staleEvidenceControls: staleEvidence,
    activeAuditPeriodId: activeAudit?.id ?? null,
    nextAuditPeriodStart: nextAudit?.periodStart ?? null,
  };
}
