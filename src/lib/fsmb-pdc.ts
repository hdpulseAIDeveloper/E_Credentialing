/**
 * P3 Gap #21 — FSMB Practitioner Data Center (PDC) ingestion helpers.
 *
 * Two delivery modes are supported by FSMB:
 *
 *   1. Webhook push — FSMB POSTs an event payload to our endpoint as soon
 *      as a board action / license-status change is filed. This file
 *      provides the parsing + normalization logic; the route at
 *      `src/app/api/webhooks/fsmb-pdc/route.ts` handles auth.
 *
 *   2. Daily NDJSON file pull — FSMB drops a daily file at a configured
 *      SFTP location. The nightly `fsmb-pdc-poll` worker reads new lines
 *      and feeds each one through the same `ingestFsmbPdcEvent` path.
 *
 * The helper:
 *   • normalizes the raw payload into a `FsmbPdcEvent` row
 *   • upserts the matching `MonitoringAlert` (one per actionable event)
 *   • marks the event PROCESSED / IGNORED / FAILED
 *   • is idempotent: replays of the same `external_event_id` are no-ops
 */

import {
  FsmbPdcEventProcessingStatus,
  FsmbPdcEventSeverity,
  FsmbPdcEventType,
  MonitoringAlertSeverity,
  MonitoringAlertType,
  type Prisma,
  type PrismaClient,
} from "@prisma/client";
import { createMonitoringAlert } from "./monitoring-alerts";

export interface FsmbPdcRawEvent {
  externalEventId?: string;
  npi?: string;
  fsmbId?: string;
  firstName?: string;
  lastName?: string;
  state?: string;
  /** Free text from FSMB describing the event, e.g. "Probation imposed by NY OPMC". */
  description?: string;
  occurredAt?: string;
  /** FSMB classifies events using a 4-letter code; we map them to our enum. */
  eventCode?: string;
  /** Optional severity hint from FSMB. */
  severity?: "INFO" | "WARNING" | "CRITICAL";
  raw?: unknown;
}

interface NormalizedFsmbEvent {
  eventType: FsmbPdcEventType;
  severity: FsmbPdcEventSeverity;
  alertType: MonitoringAlertType | null;
  monitoringSeverity: MonitoringAlertSeverity | null;
  summary: string;
}

const EVENT_CODE_MAP: Record<string, NormalizedFsmbEvent> = {
  // Board actions: revocation, suspension, probation, surrender, etc.
  BACT: {
    eventType: "BOARD_ACTION",
    severity: "CRITICAL",
    alertType: "FSMB_BOARD_ACTION",
    monitoringSeverity: "CRITICAL",
    summary: "Board action reported by FSMB",
  },
  // License status: expirations, lapses, status flag changes.
  LSTC: {
    eventType: "LICENSE_STATUS_CHANGE",
    severity: "WARNING",
    alertType: "FSMB_LICENSE_STATUS_CHANGE",
    monitoringSeverity: "WARNING",
    summary: "License status change reported by FSMB",
  },
  // Disciplinary report (often duplicated with board actions but separate
  // delivery channel).
  DRPT: {
    eventType: "DISCIPLINARY_REPORT",
    severity: "CRITICAL",
    alertType: "FSMB_DISCIPLINARY_REPORT",
    monitoringSeverity: "CRITICAL",
    summary: "Disciplinary report received from FSMB",
  },
  ADRC: {
    eventType: "ADDRESS_UPDATE",
    severity: "INFO",
    alertType: null,
    monitoringSeverity: null,
    summary: "FSMB address change",
  },
  DEMO: {
    eventType: "DEMOGRAPHIC_UPDATE",
    severity: "INFO",
    alertType: null,
    monitoringSeverity: null,
    summary: "FSMB demographic change",
  },
  EDUC: {
    eventType: "EDUCATION_UPDATE",
    severity: "INFO",
    alertType: null,
    monitoringSeverity: null,
    summary: "FSMB education change",
  },
};

export function normalizeFsmbEvent(
  raw: FsmbPdcRawEvent
): NormalizedFsmbEvent {
  if (raw.eventCode && EVENT_CODE_MAP[raw.eventCode.toUpperCase()]) {
    return EVENT_CODE_MAP[raw.eventCode.toUpperCase()]!;
  }
  return {
    eventType: "OTHER",
    severity: (raw.severity as FsmbPdcEventSeverity) ?? "INFO",
    alertType: null,
    monitoringSeverity: null,
    summary: raw.description ?? "FSMB PDC event",
  };
}

export interface IngestResult {
  eventId: string | null;
  status: FsmbPdcEventProcessingStatus;
  reason?: string;
}

/**
 * Match an FSMB event back to one of our providers. NPI is preferred,
 * fsmb_id second, then a fuzzy first+last name fallback (only when state
 * is also supplied to keep the search tight).
 */
async function findProviderForEvent(
  db: PrismaClient,
  raw: FsmbPdcRawEvent
): Promise<string | null> {
  if (raw.npi) {
    const byNpi = await db.provider.findUnique({
      where: { npi: raw.npi },
      select: { id: true },
    });
    if (byNpi) return byNpi.id;
  }
  if (raw.fsmbId) {
    const sub = await db.fsmbPdcSubscription.findFirst({
      where: { fsmbId: raw.fsmbId },
      select: { providerId: true },
    });
    if (sub) return sub.providerId;
  }
  if (raw.firstName && raw.lastName && raw.state) {
    const byName = await db.provider.findFirst({
      where: {
        legalFirstName: { equals: raw.firstName, mode: "insensitive" },
        legalLastName: { equals: raw.lastName, mode: "insensitive" },
        licenses: { some: { state: raw.state.toUpperCase() } },
      },
      select: { id: true },
    });
    if (byName) return byName.id;
  }
  return null;
}

/**
 * Ingest a single FSMB PDC event. Idempotent on `externalEventId`.
 */
export async function ingestFsmbPdcEvent(
  db: PrismaClient,
  raw: FsmbPdcRawEvent
): Promise<IngestResult> {
  // De-duplicate by external id when provided.
  if (raw.externalEventId) {
    const existing = await db.fsmbPdcEvent.findUnique({
      where: { externalEventId: raw.externalEventId },
      select: { id: true, processingStatus: true },
    });
    if (existing) {
      return {
        eventId: existing.id,
        status: existing.processingStatus,
        reason: "duplicate (already ingested)",
      };
    }
  }

  const providerId = await findProviderForEvent(db, raw);
  if (!providerId) {
    console.warn(
      "[FSMB-PDC] dropped event — no matching provider:",
      JSON.stringify({
        externalEventId: raw.externalEventId,
        npi: raw.npi,
        fsmbId: raw.fsmbId,
        state: raw.state,
      })
    );
    return {
      eventId: null,
      status: "IGNORED",
      reason: "no matching provider",
    };
  }

  const normalized = normalizeFsmbEvent(raw);
  const occurredAt = raw.occurredAt ? new Date(raw.occurredAt) : new Date();

  // Insert the event row first.
  const event = await db.fsmbPdcEvent.create({
    data: {
      providerId,
      externalEventId: raw.externalEventId ?? null,
      eventType: normalized.eventType,
      severity: normalized.severity,
      occurredAt,
      state: raw.state?.toUpperCase() ?? null,
      summary: normalized.summary,
      rawPayload: raw as unknown as Prisma.InputJsonValue,
      processingStatus: "RECEIVED",
    },
    select: { id: true },
  });

  // Update the subscription's lastEventReceivedAt.
  await db.fsmbPdcSubscription
    .updateMany({
      where: { providerId },
      data: { lastEventReceivedAt: new Date() },
    })
    .catch(() => undefined);

  // Raise a MonitoringAlert if this event type maps to one.
  let alertId: string | null = null;
  if (normalized.alertType && normalized.monitoringSeverity) {
    try {
      alertId = await createMonitoringAlert(db, {
        providerId,
        type: normalized.alertType,
        severity: normalized.monitoringSeverity,
        source: "FSMB_PDC",
        title: normalized.summary,
        description: raw.description ?? normalized.summary,
        evidence: {
          fsmbEventId: event.id,
          externalEventId: raw.externalEventId ?? null,
          state: raw.state ?? null,
          eventCode: raw.eventCode ?? null,
          occurredAt: occurredAt.toISOString(),
        },
      });
    } catch (err) {
      console.error("[FSMB-PDC] alert creation failed:", err);
    }
  }

  await db.fsmbPdcEvent.update({
    where: { id: event.id },
    data: {
      processingStatus: "PROCESSED",
      monitoringAlertId: alertId,
    },
  });

  return { eventId: event.id, status: "PROCESSED" };
}

/**
 * Bulk ingestion helper used by the daily NDJSON puller.
 * Returns aggregate counts so workers can log a single line.
 */
export async function ingestFsmbPdcBatch(
  db: PrismaClient,
  events: FsmbPdcRawEvent[]
): Promise<{
  processed: number;
  ignored: number;
  duplicates: number;
  failed: number;
}> {
  let processed = 0;
  let ignored = 0;
  let duplicates = 0;
  let failed = 0;
  for (const raw of events) {
    try {
      const r = await ingestFsmbPdcEvent(db, raw);
      if (r.reason?.startsWith("duplicate")) duplicates++;
      else if (r.status === "PROCESSED") processed++;
      else if (r.status === "IGNORED") ignored++;
      else failed++;
    } catch (err) {
      console.error("[FSMB-PDC] event failed:", err);
      failed++;
    }
  }
  return { processed, ignored, duplicates, failed };
}
