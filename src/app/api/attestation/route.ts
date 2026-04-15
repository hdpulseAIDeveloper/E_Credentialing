import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { queuePsvBotsForProvider } from "@/lib/automation/psv-auto-queue";
import { writeAuditLog } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, attestations, electronicSignature } = body;

    if (!token || !electronicSignature) {
      return NextResponse.json({ error: "Token and signature are required" }, { status: 400 });
    }

    const provider = await db.provider.findFirst({
      where: { inviteToken: token },
    });

    if (!provider) {
      return NextResponse.json({ error: "Invalid or expired token" }, { status: 404 });
    }

    // Update provider with attestation data and transition status
    await db.provider.update({
      where: { id: provider.id },
      data: {
        applicationSubmittedAt: new Date(),
        status: "VERIFICATION_IN_PROGRESS",
      },
    });

    await writeAuditLog({
      action: "provider.attestation.submitted",
      entityType: "Provider",
      entityId: provider.id,
      providerId: provider.id,
      afterState: {
        electronicSignature,
        attestationCount: attestations?.length ?? 0,
        submittedAt: new Date().toISOString(),
      },
    });

    // Auto-queue PSV bots
    const queuedBots = await queuePsvBotsForProvider(provider.id);

    await writeAuditLog({
      action: "provider.psv.auto_queued",
      entityType: "Provider",
      entityId: provider.id,
      providerId: provider.id,
      afterState: { botsQueued: queuedBots.length },
    });

    return NextResponse.json({
      success: true,
      message: "Application submitted successfully",
      botsQueued: queuedBots.length,
    });
  } catch (error) {
    console.error("[Attestation API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
