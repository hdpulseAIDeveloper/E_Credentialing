import { NextRequest, NextResponse } from "next/server";
import { db } from "@/server/db";
import type { DeliveryStatus } from "@prisma/client";

interface SendGridEvent {
  email: string;
  event: "delivered" | "bounce" | "blocked" | "dropped" | "deferred" | "open" | "click";
  sg_message_id?: string;
  timestamp: number;
  reason?: string;
}

export async function POST(req: NextRequest) {
  try {
    const events: SendGridEvent[] = await req.json() as SendGridEvent[];

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
          continue; // Skip other events
      }

      if (deliveryStatus) {
        // Find communication by searching for the message ID in metadata
        // In a real implementation, we'd store the SendGrid message ID on the Communication record
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
