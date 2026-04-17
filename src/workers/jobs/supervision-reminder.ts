/**
 * P3 Gap #22 — Supervision attestation reminder job.
 *
 * Provisionally-licensed behavioral-health clinicians must keep a current
 * supervision attestation on file. This nightly sweep:
 *
 *   1. Finds every provisionally-licensed provider whose latest accepted
 *      attestation has expired or is expiring inside 30 days.
 *   2. Raises a SUPERVISION_ATTESTATION_OVERDUE MonitoringAlert (de-duped
 *      via the alert library).
 *   3. Flags upcoming provisional-license expirations so credentialing
 *      staff can extend supervision or upgrade the license type before the
 *      payer feed sees a lapse.
 */

import { PrismaClient } from "@prisma/client";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";

const db = new PrismaClient();

interface RunSummary {
  scanned: number;
  overdueAlerts: number;
  expiringLicenseAlerts: number;
  errors: number;
}

const ATTESTATION_DUE_WINDOW_DAYS = 30;
const LICENSE_EXPIRY_WINDOW_DAYS = 60;

export async function runSupervisionReminderSweep(): Promise<RunSummary> {
  const summary: RunSummary = {
    scanned: 0,
    overdueAlerts: 0,
    expiringLicenseAlerts: 0,
    errors: 0,
  };

  const now = new Date();
  const dueWindow = new Date(
    now.getTime() + ATTESTATION_DUE_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );
  const licenseWindow = new Date(
    now.getTime() + LICENSE_EXPIRY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  );

  const profiles = await db.providerProfile.findMany({
    where: {
      isProvisionallyLicensed: true,
      provider: {
        status: { notIn: ["DENIED", "TERMINATED", "WITHDRAWN", "INVITED"] },
      },
    },
    include: {
      provider: {
        include: {
          supervisionAttestations: {
            where: { status: "ACCEPTED" },
            orderBy: { periodEnd: "desc" },
            take: 1,
          },
        },
      },
    },
  });

  for (const profile of profiles) {
    summary.scanned++;
    try {
      const latest = profile.provider.supervisionAttestations[0];
      const attestationStale = !latest || latest.periodEnd <= dueWindow;
      if (attestationStale) {
        const isOverdue = !latest || latest.periodEnd <= now;
        await createMonitoringAlert(db, {
          providerId: profile.provider.id,
          type: "SUPERVISION_ATTESTATION_OVERDUE",
          source: "supervision-reminder",
          severity: isOverdue ? "CRITICAL" : "WARNING",
          title: isOverdue
            ? "Supervision attestation overdue"
            : "Supervision attestation due soon",
          description: latest
            ? `Most recent accepted attestation period ended ${latest.periodEnd
                .toISOString()
                .slice(0, 10)}. Provisional clinicians require a current attestation on file for billing eligibility.`
            : "No accepted supervision attestation on file. Provisional clinicians require a current attestation before billing.",
          evidence: {
            providerId: profile.provider.id,
            latestAttestationId: latest?.id ?? null,
            latestPeriodEnd: latest?.periodEnd?.toISOString() ?? null,
          },
        });
        summary.overdueAlerts++;
      }

      if (
        profile.provisionalLicenseExpires &&
        profile.provisionalLicenseExpires <= licenseWindow &&
        profile.provisionalLicenseExpires > now
      ) {
        await createMonitoringAlert(db, {
          providerId: profile.provider.id,
          type: "PROVISIONAL_LICENSE_EXPIRING",
          source: "supervision-reminder",
          severity: "WARNING",
          title: "Provisional license expiring",
          description: `Provisional license expires on ${profile.provisionalLicenseExpires
            .toISOString()
            .slice(0, 10)}. Confirm full licensure status or extend supervision plan.`,
          evidence: {
            providerId: profile.provider.id,
            expiresAt: profile.provisionalLicenseExpires.toISOString(),
          },
        });
        summary.expiringLicenseAlerts++;
      }
    } catch (err) {
      summary.errors++;
      console.error(
        `[SupervisionReminder] error for provider ${profile.provider.id}:`,
        err
      );
    }
  }

  console.log(
    `[SupervisionReminder] scanned=${summary.scanned} overdue=${summary.overdueAlerts} expiringLic=${summary.expiringLicenseAlerts} errors=${summary.errors}`
  );
  return summary;
}
