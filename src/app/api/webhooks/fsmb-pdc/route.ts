/**
 * P3 Gap #21 — FSMB Practitioner Data Center webhook receiver.
 *
 * FSMB pushes events here as they are filed. The body is verified with an
 * HMAC-SHA256 signature using `FSMB_PDC_WEBHOOK_SECRET` (matching the
 * pattern of the exclusions webhook). Both single events and batched
 * arrays are accepted to make replays / backfills easy.
 *
 * Headers:
 *   x-fsmb-pdc-timestamp  — Unix ms timestamp
 *   x-fsmb-pdc-signature  — hex(HMAC_SHA256(secret, `${timestamp}.${rawBody}`))
 */

import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/server/db";
import {
  ingestFsmbPdcBatch,
  ingestFsmbPdcEvent,
  type FsmbPdcRawEvent,
} from "@/lib/fsmb-pdc";

const REPLAY_WINDOW_MS = 5 * 60 * 1000;

function verifySignature(
  rawBody: string,
  signature: string | null,
  timestamp: string | null
): boolean {
  const secret = process.env.FSMB_PDC_WEBHOOK_SECRET;
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

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-fsmb-pdc-signature");
  const timestamp = req.headers.get("x-fsmb-pdc-timestamp");

  if (!verifySignature(rawBody, signature, timestamp)) {
    return NextResponse.json(
      { error: "invalid_signature" },
      { status: 401 }
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (Array.isArray(payload)) {
    const events = payload as FsmbPdcRawEvent[];
    const result = await ingestFsmbPdcBatch(db, events);
    return NextResponse.json({ ok: true, ...result });
  }

  const single = payload as FsmbPdcRawEvent;
  const result = await ingestFsmbPdcEvent(db, single);
  return NextResponse.json({ ok: true, ...result });
}
