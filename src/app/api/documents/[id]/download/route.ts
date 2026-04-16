/**
 * GET /api/documents/[id]/download
 *
 * Authenticated document download. Two auth paths:
 *   1. Staff session (SPECIALIST / MANAGER / COMMITTEE_MEMBER / ADMIN).
 *   2. Provider invite token (?token=... or x-provider-token header) whose
 *      providerId matches the document's providerId.
 *
 * On success, writes an audit-log row and 302-redirects to a short-lived
 * user-delegation SAS URL (5 minute TTL). The blob itself is served by Azure
 * directly, so large files do not traverse the app server.
 *
 * The route NEVER returns a SAS URL in JSON — the redirect target is only
 * followed by the browser that made the authenticated request. This avoids
 * leaking signed URLs in logs, intermediaries, or shared clipboards.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { generateSasUrl } from "@/lib/azure/blob";
import { writeAuditLog } from "@/lib/audit";
import { ProviderTokenError, verifyProviderInviteToken } from "@/lib/auth/provider-token";

const STAFF_ROLES = new Set(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"]);

interface Authorized {
  actorId: string | null;
  actorRole: string;
  sourceProviderId: string | null;
}

async function authorize(req: NextRequest, documentProviderId: string): Promise<Authorized | NextResponse> {
  const session = await auth();
  if (session?.user && STAFF_ROLES.has(session.user.role)) {
    return { actorId: session.user.id, actorRole: session.user.role, sourceProviderId: null };
  }

  const tokenFromQuery = req.nextUrl.searchParams.get("token");
  const tokenFromHeader = req.headers.get("x-provider-token");
  const token = tokenFromQuery ?? tokenFromHeader;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const verified = await verifyProviderInviteToken(token);
    if (verified.providerId !== documentProviderId) {
      return NextResponse.json({ error: "Forbidden: document belongs to another provider" }, { status: 403 });
    }
    return { actorId: null, actorRole: "PROVIDER", sourceProviderId: verified.providerId };
  } catch (e) {
    const status = e instanceof ProviderTokenError ? e.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }
}

export async function GET(req: NextRequest, ctx: { params: { id: string } }) {
  const documentId = ctx.params.id;
  if (!documentId) {
    return NextResponse.json({ error: "Missing document id" }, { status: 400 });
  }

  const doc = await db.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      providerId: true,
      blobPath: true,
      originalFilename: true,
      mimeType: true,
    },
  });
  if (!doc || !doc.blobPath) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const authResult = await authorize(req, doc.providerId);
  if (authResult instanceof NextResponse) return authResult;

  let sasUrl: string;
  try {
    sasUrl = await generateSasUrl(doc.blobPath, 5);
  } catch (err) {
    console.error("[document.download] Failed to mint SAS URL:", err);
    return NextResponse.json({ error: "Failed to generate download URL" }, { status: 500 });
  }

  await writeAuditLog({
    actorId: authResult.actorId,
    actorRole: authResult.actorRole,
    action: "document.downloaded",
    entityType: "Document",
    entityId: doc.id,
    providerId: doc.providerId,
    afterState: {
      originalFilename: doc.originalFilename,
      mimeType: doc.mimeType,
      sasTtlMinutes: 5,
    },
  });

  return NextResponse.redirect(sasUrl, { status: 302 });
}
