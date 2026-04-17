/**
 * P3 Gap #21 — FSMB PDC daily NDJSON pull.
 *
 * Runs nightly. When `FSMB_PDC_FEED_URL` is configured, pulls the daily
 * NDJSON file (one JSON event per line) and feeds each event through the
 * shared `ingestFsmbPdcEvent` path. The poll job is idempotent: events
 * that have already been ingested by the webhook (same `externalEventId`)
 * are skipped.
 *
 * Deployment note: in real environments FSMB ships these files via SFTP
 * with key-pair auth. To keep this job self-contained we accept either
 * a `FSMB_PDC_FEED_URL` (HTTPS endpoint with bearer token) OR a local
 * file path under `FSMB_PDC_FEED_FILE` (useful for dev fixtures).
 */

import { PrismaClient } from "@prisma/client";
import { readFile } from "fs/promises";
import {
  ingestFsmbPdcBatch,
  type FsmbPdcRawEvent,
} from "../../lib/fsmb-pdc";

const db = new PrismaClient();

interface RunSummary {
  source: "url" | "file" | "none";
  fetched: number;
  processed: number;
  duplicates: number;
  ignored: number;
  failed: number;
  errorMessage?: string;
}

function parseNdjson(text: string): FsmbPdcRawEvent[] {
  const out: FsmbPdcRawEvent[] = [];
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed) as FsmbPdcRawEvent);
    } catch {
      // ignore malformed lines but keep going so one bad row doesn't kill
      // the whole batch
    }
  }
  return out;
}

async function fetchFromUrl(url: string): Promise<string> {
  const token = process.env.FSMB_PDC_FEED_TOKEN;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    throw new Error(`FSMB feed responded ${res.status}: ${res.statusText}`);
  }
  return res.text();
}

export async function runFsmbPdcPoll(): Promise<RunSummary> {
  const url = process.env.FSMB_PDC_FEED_URL;
  const file = process.env.FSMB_PDC_FEED_FILE;

  if (!url && !file) {
    console.log(
      "[FSMB-PDC] no FSMB_PDC_FEED_URL or FSMB_PDC_FEED_FILE set — skipping"
    );
    return {
      source: "none",
      fetched: 0,
      processed: 0,
      duplicates: 0,
      ignored: 0,
      failed: 0,
    };
  }

  let text = "";
  let source: "url" | "file" = url ? "url" : "file";
  try {
    text = url ? await fetchFromUrl(url) : await readFile(file!, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[FSMB-PDC] feed fetch failed:", message);
    return {
      source,
      fetched: 0,
      processed: 0,
      duplicates: 0,
      ignored: 0,
      failed: 0,
      errorMessage: message,
    };
  }

  const events = parseNdjson(text);
  console.log(`[FSMB-PDC] ${events.length} events parsed from ${source}`);
  const result = await ingestFsmbPdcBatch(db, events);

  // Stamp lastSyncedAt on every active subscription so the dashboard
  // shows when the most recent feed pull happened.
  await db.fsmbPdcSubscription
    .updateMany({
      where: { status: "ACTIVE" },
      data: { lastSyncedAt: new Date() },
    })
    .catch(() => undefined);

  return {
    source,
    fetched: events.length,
    processed: result.processed,
    duplicates: result.duplicates,
    ignored: result.ignored,
    failed: result.failed,
  };
}
