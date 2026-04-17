/**
 * P1 Gap #15 — Nightly telehealth compliance sweep.
 *
 * For every active provider with declared telehealth states we:
 *   - Detect uncovered states (no active license + no IMLC grant)
 *     → TELEHEALTH_LICENSE_GAP
 *   - Detect any platform certification within 60d of expiry
 *     → TELEHEALTH_PLATFORM_CERT_EXPIRING
 *   - Detect any IMLC LoQ within 90d of expiry (LoQs auto-expire if
 *     unused; member-state grants then need re-issuance)
 *     → IMLC_LOQ_EXPIRING
 */

import { PrismaClient } from "@prisma/client";
import { evaluateTelehealthCoverage } from "../../lib/telehealth";
import { createMonitoringAlert } from "../../lib/monitoring-alerts";

const db = new PrismaClient();

const PLATFORM_CERT_EXPIRY_WARN_DAYS = 60;
const IMLC_LOQ_EXPIRY_WARN_DAYS = 90;

interface RunSummary {
  scanned: number;
  coverageGapsRaised: number;
  certExpiringRaised: number;
  loqExpiringRaised: number;
  errors: number;
}

export async function runTelehealthComplianceCheck(): Promise<RunSummary> {
  const summary: RunSummary = {
    scanned: 0,
    coverageGapsRaised: 0,
    certExpiringRaised: 0,
    loqExpiringRaised: 0,
    errors: 0,
  };

  const providers = await db.provider.findMany({
    where: {
      status: { notIn: ["DENIED", "TERMINATED", "WITHDRAWN", "INVITED"] },
    },
    include: {
      profile: {
        select: {
          teleHealthStates: true,
          imlcMemberStatesGranted: true,
          imlcLoqExpiresAt: true,
        },
      },
      licenses: { select: { state: true, status: true } },
      telehealthPlatformCerts: true,
    },
  });

  const now = new Date();

  for (const provider of providers) {
    summary.scanned += 1;

    try {
      // 1. Coverage gaps
      const declared = provider.profile?.teleHealthStates ?? [];
      if (declared.length > 0) {
        const coverage = evaluateTelehealthCoverage({
          declaredStates: declared,
          licenses: provider.licenses,
          imlcMemberStatesGranted: provider.profile?.imlcMemberStatesGranted ?? [],
        });

        if (coverage.uncoveredStates.length > 0) {
          const created = await createMonitoringAlert(db, {
            providerId: provider.id,
            type: "TELEHEALTH_LICENSE_GAP",
            severity: "WARNING",
            source: "TelehealthCompliance",
            title: `Telehealth declared without licensure in ${coverage.uncoveredStates.length} state(s)`,
            description: `Provider declared telehealth practice in ${declared.join(", ")} but has no active license or IMLC grant for ${coverage.uncoveredStates.join(", ")}. They cannot legally render telehealth visits to patients located in these states until licensure or IMLC member-state grants are in place.`,
            evidence: {
              declared,
              uncovered: coverage.uncoveredStates,
              imlcCovered: coverage.imlcCoveredStates,
            },
          });
          if (created) summary.coverageGapsRaised += 1;
        }
      }

      // 2. Platform certs expiring
      for (const cert of provider.telehealthPlatformCerts) {
        if (cert.status !== "CERTIFIED" || !cert.expiresAt) continue;
        const days = Math.ceil(
          (cert.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (days <= PLATFORM_CERT_EXPIRY_WARN_DAYS) {
          const created = await createMonitoringAlert(db, {
            providerId: provider.id,
            type: "TELEHEALTH_PLATFORM_CERT_EXPIRING",
            severity: days <= 0 ? "CRITICAL" : "WARNING",
            source: "TelehealthCompliance",
            title:
              days <= 0
                ? `${cert.platformName} platform certification expired`
                : `${cert.platformName} platform certification expires in ${days} day(s)`,
            description: `Telehealth platform certification ${cert.certificateNumber ? `(#${cert.certificateNumber}) ` : ""}for ${cert.platformName} ${days <= 0 ? "is expired" : `expires on ${cert.expiresAt.toLocaleDateString()}`}. Renew the certification before scheduling new visits on this platform.`,
            evidence: {
              platform: cert.platformName,
              certificateNumber: cert.certificateNumber,
              expiresAt: cert.expiresAt.toISOString(),
              daysUntilExpiry: days,
            },
          });
          if (created) summary.certExpiringRaised += 1;
        }
      }

      // 3. IMLC LoQ expiring
      const loqExp = provider.profile?.imlcLoqExpiresAt;
      if (loqExp) {
        const days = Math.ceil(
          (loqExp.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );
        if (days <= IMLC_LOQ_EXPIRY_WARN_DAYS) {
          const created = await createMonitoringAlert(db, {
            providerId: provider.id,
            type: "IMLC_LOQ_EXPIRING",
            severity: days <= 0 ? "CRITICAL" : "WARNING",
            source: "TelehealthCompliance",
            title:
              days <= 0
                ? "IMLC Letter of Qualification expired"
                : `IMLC Letter of Qualification expires in ${days} day(s)`,
            description:
              "The IMLC LoQ enables expedited licensure in IMLC member states. Once expired, the provider must re-apply through the SPL board before new member-state grants can be issued.",
            evidence: {
              expiresAt: loqExp.toISOString(),
              daysUntilExpiry: days,
            },
          });
          if (created) summary.loqExpiringRaised += 1;
        }
      }
    } catch (error) {
      summary.errors += 1;
      console.error(
        `[TelehealthCompliance] error for provider ${provider.id}:`,
        error
      );
    }
  }

  console.log(
    `[TelehealthCompliance] scanned=${summary.scanned} coverageGaps=${summary.coverageGapsRaised} ` +
      `certExpiring=${summary.certExpiringRaised} loqExpiring=${summary.loqExpiringRaised} ` +
      `errors=${summary.errors}`
  );

  return summary;
}
