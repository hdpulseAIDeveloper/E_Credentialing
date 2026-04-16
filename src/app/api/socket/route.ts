import { NextResponse } from "next/server";

/**
 * NOTE: Socket.io is currently dormant in production (Next.js standalone output
 * does not use the custom src/server.ts). The platform uses tRPC polling for
 * real-time bot status. This endpoint is preserved as a stable health probe.
 *
 * Re-enabling Socket.io is tracked in P1-5 (observability) — once the worker
 * pushes events through Redis pub/sub and a long-lived gateway process is added.
 */
export async function GET() {
  return NextResponse.json({
    status: "ok",
    realtime: "tRPC polling (Socket.io disabled in production)",
  });
}
