/**
 * GET /api/live — liveness probe.
 *
 * Returns 200 if the Node process is up and handling requests. This endpoint
 * MUST NOT touch the database or Redis — Kubernetes (or Azure Container Apps)
 * will restart a container that fails its liveness probe, and a transient DB
 * blip should not trigger a full container restart.
 */
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ status: "live", timestamp: new Date().toISOString() });
}
