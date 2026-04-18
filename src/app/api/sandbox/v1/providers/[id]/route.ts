/**
 * Wave 5.2 — public sandbox API: single provider detail.
 *
 * Returns the full envelope for a deterministic synthetic provider.
 * 404s on any id outside the synthetic set so the contract is honest.
 */
import { NextResponse } from "next/server";
import { synthProviderById } from "@/lib/sandbox/synth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const provider = synthProviderById(params.id);
  if (!provider) {
    return NextResponse.json(
      { error: "not_found", message: `Sandbox provider ${params.id} does not exist.` },
      { status: 404, headers: { "X-Sandbox": "ecred-v1" } },
    );
  }
  return NextResponse.json(provider, {
    headers: {
      "Cache-Control": "public, max-age=60, s-maxage=300",
      "X-Sandbox": "ecred-v1",
    },
  });
}
