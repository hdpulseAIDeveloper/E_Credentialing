import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { queuePsvBotsForProvider } from "@/lib/automation/psv-auto-queue";
import { writeAuditLog } from "@/lib/audit";
import { ProviderTokenError, verifyProviderInviteToken } from "@/lib/auth/provider-token";
import {
  ATTESTATION_QUESTIONS,
  LEGAL_COPY_STATUS,
  LEGAL_COPY_VERSION,
} from "@/lib/legal/copy";

interface AcknowledgementInput {
  questionId: number;
  accepted: boolean;
}

/** Read the original client IP through Vercel/Nginx-style forwarded headers. */
function getClientIp(request: Request): string | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }
  return (
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    null
  );
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      token,
      attestations,
      acknowledgements,
      electronicSignature,
      legalCopyVersion,
    } = body as {
      token?: string;
      attestations?: boolean[];
      acknowledgements?: AcknowledgementInput[];
      electronicSignature?: string;
      legalCopyVersion?: string;
    };

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

    // Reconcile what the client claims it acknowledged with the canonical
    // server-side question list. The server is the source of truth — if the
    // client failed to send a structured acknowledgements array, fall back
    // to the legacy boolean[] shape and pair it with the canonical questions.
    const canonicalAcks = ATTESTATION_QUESTIONS.map((question, index) => {
      const matchedById = acknowledgements?.find(
        (ack) => ack && ack.questionId === question.id,
      );
      const acceptedById = matchedById?.accepted === true;
      const acceptedByIndex =
        Array.isArray(attestations) && attestations[index] === true;
      return {
        questionId: question.id,
        text: question.text,
        accepted: acceptedById || acceptedByIndex,
      };
    });

    const allAccepted = canonicalAcks.every((ack) => ack.accepted);
    if (!allAccepted) {
      return NextResponse.json(
        { error: "All attestation statements must be acknowledged" },
        { status: 400 },
      );
    }

    // Refuse to record an attestation against a different copy version than
    // the server is currently serving — protects the audit trail from
    // races where the client cached an old bundle.
    if (legalCopyVersion && legalCopyVersion !== LEGAL_COPY_VERSION) {
      return NextResponse.json(
        {
          error:
            "Legal copy has been updated since you began this attestation. " +
            "Please refresh the page and re-acknowledge.",
        },
        { status: 409 },
      );
    }

    const submittedAt = new Date();
    const ipAddress = getClientIp(request);
    const userAgent = request.headers.get("user-agent");

    // Single-use: revoke the invite token after successful attestation.
    await db.provider.update({
      where: { id: provider.id },
      data: {
        applicationSubmittedAt: submittedAt,
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
      ipAddress,
      userAgent,
      afterState: {
        electronicSignature,
        attestationCount: canonicalAcks.length,
        submittedAt: submittedAt.toISOString(),
        // L4: bind every attestation to the legal copy bundle that was
        // in effect on the server at submission time. Acknowledgement
        // texts are persisted verbatim so the audit record is complete
        // even if the bundle is later revised.
        legalCopyVersion: LEGAL_COPY_VERSION,
        legalCopyStatus: LEGAL_COPY_STATUS,
        acknowledgements: canonicalAcks,
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
      legalCopyVersion: LEGAL_COPY_VERSION,
    });
  } catch (error) {
    console.error("[Attestation API] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
