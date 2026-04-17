/**
 * P1 Gap #9 — Exclusions ingestion webhook.
 *
 * Receives daily/near-real-time exclusion diffs from federal sources
 * (SAM.gov Public Extract, OIG LEIE) or third-party brokers
 * (ProviderTrust, Verisys, etc.). For each delta, looks up matching
 * providers by NPI and raises a MonitoringAlert so staff act within
 * hours instead of waiting for the next 30-day sweep.
 *
 * Auth model: HMAC-SHA256 of the raw body using EXCLUSIONS_WEBHOOK_SECRET,
 * sent in the `x-exclusions-signature` header. Requests without a valid
 * signature are rejected with 401. Replays of bodies older than 5 minutes
 * (timestamp header) are rejected with 401.
 *
 * Payload contract (POST application/json):
 * {
 *   "source": "SAM_GOV" | "OIG" | "STATE_MEDICAID",
 *   "state": "NY",                       // optional, required for STATE_MEDICAID
 *   "extractedAt": "2026-04-16T05:00:00Z",
 *   "changes": [
 *     {
 *       "action": "ADDED" | "REMOVED",
 *       "npi": "1234567890",             // preferred match key
 *       "firstName": "Jane",             // fallback match
 *       "lastName": "Doe",
 *       "dateOfBirth": "1980-01-15",     // optional
 *       "exclusionType": "Mandatory",
 *       "exclusionDate": "2026-04-10",
 *       "sourceUrl": "https://..."
 *     }
 *   ]
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/server/db";
import { createMonitoringAlert } from "@/lib/monitoring-alerts";
import type { MonitoringAlertType } from "@prisma/client";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

interface ExclusionChange {
  action: "ADDED" | "REMOVED";
  npi?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  exclusionType?: string;
  exclusionDate?: string;
  sourceUrl?: string;
}

interface ExclusionPayload {
  source: "SAM_GOV" | "OIG" | "STATE_MEDICAID";
  state?: string;
  extractedAt?: string;
  changes: ExclusionChange[];
}

function verifySignature(rawBody: string, signature: string | null, timestamp: string | null): boolean {
  const secret = process.env.EXCLUSIONS_WEBHOOK_SECRET;
  if (!secret) return false;
  if (!signature || !timestamp) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  if (Math.abs(Date.now() - ts) > REPLAY_WINDOW_MS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

function alertTypeFor(source: ExclusionPayload["source"], action: "ADDED" | "REMOVED"): MonitoringAlertType {
  if (source === "OIG") return "OIG_EXCLUSION_ADDED";
  if (source === "STATE_MEDICAID") return "STATE_MEDICAID_EXCLUSION_ADDED";
  return action === "ADDED" ? "SAM_EXCLUSION_ADDED" : "SAM_EXCLUSION_REMOVED";
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-exclusions-signature");
  const timestamp = req.headers.get("x-exclusions-timestamp");

  if (!verifySignature(rawBody, signature, timestamp)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: ExclusionPayload;
  try {
    payload = JSON.parse(rawBody) as ExclusionPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!payload.source || !Array.isArray(payload.changes)) {
    return NextResponse.json(
      { error: "Missing required fields: source, changes" },
      { status: 400 }
    );
  }

  const summary = {
    received: payload.changes.length,
    matched: 0,
    alertsCreated: 0,
    skipped: 0,
  };

  for (const change of payload.changes) {
    // Match by NPI first (strongest), then fall back to legal name + DOB.
    let providers: { id: string }[] = [];

    // We deliberately INCLUDE in-pipeline providers, not just APPROVED, so a
    // SAM hit on someone mid-credentialing surfaces immediately rather than
    // waiting until they're approved.
    const ACTIVE_PROVIDER_STATUSES = [
      "APPROVED",
      "VERIFICATION_IN_PROGRESS",
      "COMMITTEE_READY",
      "COMMITTEE_IN_REVIEW",
      "DOCUMENTS_PENDING",
      "ONBOARDING_IN_PROGRESS",
    ] as const;

    if (change.npi) {
      providers = await db.provider.findMany({
        where: { npi: change.npi, status: { in: ACTIVE_PROVIDER_STATUSES as unknown as never } },
        select: { id: true },
      });
    }

    if (providers.length === 0 && change.firstName && change.lastName) {
      const where: Record<string, unknown> = {
        legalFirstName: { equals: change.firstName, mode: "insensitive" },
        legalLastName: { equals: change.lastName, mode: "insensitive" },
        status: { in: ACTIVE_PROVIDER_STATUSES },
      };
      if (change.dateOfBirth) {
        const dob = new Date(change.dateOfBirth);
        if (!Number.isNaN(dob.getTime())) {
          where.dateOfBirth = dob;
        }
      }
      providers = await db.provider.findMany({
        where: where as never,
        select: { id: true },
      });
    }

    if (providers.length === 0) {
      summary.skipped += 1;
      continue;
    }

    summary.matched += providers.length;

    for (const provider of providers) {
      const type = alertTypeFor(payload.source, change.action);
      const isAdded = change.action === "ADDED";
      const sourceLabel =
        payload.source === "STATE_MEDICAID"
          ? `STATE_MEDICAID_${(payload.state ?? "UNKNOWN").toUpperCase()}_WEBHOOK`
          : `${payload.source}_WEBHOOK`;

      const alertId = await createMonitoringAlert(db, {
        providerId: provider.id,
        type,
        severity: isAdded ? "CRITICAL" : "INFO",
        source: sourceLabel,
        title: isAdded
          ? `${payload.source.replace("_", " ")} exclusion match`
          : `${payload.source.replace("_", " ")} exclusion removed`,
        description: isAdded
          ? `Provider matched a new ${payload.source} exclusion record (${change.exclusionType ?? "type unknown"}).`
          : `Provider was removed from the ${payload.source} exclusion list.`,
        evidence: {
          source: payload.source,
          state: payload.state ?? null,
          extractedAt: payload.extractedAt ?? null,
          action: change.action,
          npi: change.npi ?? null,
          firstName: change.firstName ?? null,
          lastName: change.lastName ?? null,
          exclusionType: change.exclusionType ?? null,
          exclusionDate: change.exclusionDate ?? null,
          sourceUrl: change.sourceUrl ?? null,
        },
      });

      if (alertId) summary.alertsCreated += 1;
    }
  }

  return NextResponse.json({ ok: true, summary });
}
