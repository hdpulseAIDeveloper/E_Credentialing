import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { queuePsvBotsForProvider } from "@/lib/automation/psv-auto-queue";
import { writeAuditLog } from "@/lib/audit";
import { ProviderTokenError, verifyProviderInviteToken } from "@/lib/auth/provider-token";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, attestations, electronicSignature } = body;

    if (!token || !electronicSignature) {
      return NextResponse.json({ error: "Token and signature are required" }, { status: 400 });
    }

    let providerId: string;
    try {
      const verified = await verifyProviderInviteToken(token);
      providerId = verified.providerId;
    } catch (e) {
      if (e instanceof ProviderTokenError) {
        return NextResponse.json({ error: e.message }, { status: e.status });
      }
      return NextResponse.json({ error: "Authorization failed" }, { status: 401 });
    }

    const provider = await db.provider.findUniqueOrThrow({
      where: { id: providerId },
    });

    // Single-use: revoke the invite token after successful attestation.
    await db.provider.update({
      where: { id: provider.id },
      data: {
        applicationSubmittedAt: new Date(),
        status: "VERIFICATION_IN_PROGRESS",
        inviteToken: null,
        inviteTokenExpiresAt: null,
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
