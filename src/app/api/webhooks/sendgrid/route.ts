import { NextRequest, NextResponse } from "next/server";
import * as crypto from "node:crypto";
import { db } from "@/server/db";
import type { DeliveryStatus } from "@prisma/client";

interface SendGridEvent {
  email: string;
  event: "delivered" | "bounce" | "blocked" | "dropped" | "deferred" | "open" | "click";
  sg_message_id?: string;
  timestamp: number;
  reason?: string;
}

const SIGNATURE_HEADER = "x-twilio-email-event-webhook-signature";
const TIMESTAMP_HEADER = "x-twilio-email-event-webhook-timestamp";

function verifySignature(rawBody: string, signature: string, timestamp: string, publicKey: string): boolean {
  try {
    const payload = timestamp + rawBody;
    const verifier = crypto.createVerify("SHA256");
    verifier.update(payload);
    verifier.end();
    const formattedKey = publicKey.includes("BEGIN PUBLIC KEY")
      ? publicKey
      : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;
    return verifier.verify(formattedKey, signature, "base64");
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const publicKey = process.env.SENDGRID_WEBHOOK_PUBLIC_KEY;
  const enforce = process.env.SENDGRID_WEBHOOK_ENFORCE !== "false";

  const rawBody = await req.text();
  const signature = req.headers.get(SIGNATURE_HEADER);
  const timestamp = req.headers.get(TIMESTAMP_HEADER);

  if (publicKey) {
    if (!signature || !timestamp) {
      return NextResponse.json(
        { error: "Missing signature headers" },
        { status: 401 },
      );
    }
    if (!verifySignature(rawBody, signature, timestamp, publicKey)) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 },
      );
    }
    const tsNum = Number.parseInt(timestamp, 10);
    if (Number.isFinite(tsNum)) {
      const skew = Math.abs(Date.now() / 1000 - tsNum);
      if (skew > 600) {
        return NextResponse.json(
          { error: "Timestamp outside acceptable window" },
          { status: 401 },
        );
      }
    }
  } else if (enforce) {
    return NextResponse.json(
      {
        error:
          "SENDGRID_WEBHOOK_PUBLIC_KEY not configured; refusing unsigned webhook. " +
          "Set SENDGRID_WEBHOOK_ENFORCE=false to opt out (not recommended).",
      },
      { status: 401 },
    );
  }

  try {
    const events: SendGridEvent[] = JSON.parse(rawBody) as SendGridEvent[];

    for (const event of events) {
      const messageId = event.sg_message_id?.split(".")[0];
      if (!messageId) continue;

      let deliveryStatus: DeliveryStatus | null = null;

      switch (event.event) {
        case "delivered":
          deliveryStatus = "DELIVERED";
          break;
        case "bounce":
        case "blocked":
        case "dropped":
          deliveryStatus = "BOUNCED";
          break;
        default:
          continue;
      }

      if (deliveryStatus) {
        await db.communication.updateMany({
          where: {
            channel: "EMAIL",
            deliveryStatus: "SENT",
          },
          data: {
            deliveryStatus,
            deliveryConfirmedAt: deliveryStatus === "DELIVERED" ? new Date() : undefined,
          },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[SendGrid Webhook] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
