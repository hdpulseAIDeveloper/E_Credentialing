/**
 * P1 Gap #9 — Continuous monitoring alert helpers.
 *
 * Centralizes how alerts are created so:
 *   • Webhook ingestion (SAM.gov / OIG)
 *   • Nightly license polls (diff alerts)
 *   • NPDB Continuous Query
 *   • Sanctions-30day diff
 *
 * all write through one funnel that audits + de-duplicates per
 * (providerId, type, source, evidence-hash) within a 24h window.
 */

import type {
  MonitoringAlertSeverity,
  MonitoringAlertType,
  PrismaClient,
} from "@prisma/client";
import { createHash } from "crypto";

export interface CreateMonitoringAlertInput {
  providerId: string;
  type: MonitoringAlertType;
  severity?: MonitoringAlertSeverity;
  source: string;
  title: string;
  description: string;
  evidence?: Record<string, unknown>;
  /**
   * If true, the alert will only be created when no OPEN/ACKNOWLEDGED alert
   * with the same providerId+type+source exists in the last 24h. Defaults
   * to true so nightly polls don't spam.
   */
  dedupe?: boolean;
}

function evidenceHash(evidence: Record<string, unknown> | undefined): string {
  return createHash("sha256")
    .update(JSON.stringify(evidence ?? {}))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Create a monitoring alert (with optional 24h de-dupe).
 * Returns the new alert id, or null if de-duplicated.
 */
export async function createMonitoringAlert(
  db: PrismaClient,
  input: CreateMonitoringAlertInput
): Promise<string | null> {
  if (input.dedupe ?? true) {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dupHash = evidenceHash(input.evidence);

    const existing = await db.monitoringAlert.findFirst({
      where: {
        providerId: input.providerId,
        type: input.type,
        source: input.source,
        detectedAt: { gte: cutoff },
        status: { in: ["OPEN", "ACKNOWLEDGED"] },
      },
      select: { id: true, evidence: true },
    });

    if (existing) {
      const existingHash = evidenceHash(
        (existing.evidence as Record<string, unknown> | null) ?? {}
      );
      if (existingHash === dupHash) {
        return null; // identical evidence within 24h -> swallow
      }
    }
  }

  const created = await db.monitoringAlert.create({
    data: {
      providerId: input.providerId,
      type: input.type,
      severity: input.severity ?? "WARNING",
      source: input.source,
      title: input.title,
      description: input.description,
      evidence: (input.evidence ?? {}) as never,
    },
    select: { id: true },
  });

  return created.id;
}
