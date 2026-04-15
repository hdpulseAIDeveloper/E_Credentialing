import { NextRequest, NextResponse } from "next/server";

// Socket.io is initialized via a custom server or Next.js server action.
// For App Router, Socket.io requires a custom server.ts.
// This route provides a health endpoint and initialization status.
export async function GET(_req: NextRequest) {
  return NextResponse.json({
    status: "Socket.io is managed by the custom server",
    note: "Socket.io connections are handled at the server level, not via App Router route",
  });
}
