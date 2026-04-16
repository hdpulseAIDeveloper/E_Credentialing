/**
 * POST /api/upload
 *
 * Authenticated document upload. Two auth paths:
 *  1. Staff session (Auth.js) — any authenticated non-provider role.
 *  2. Provider invite token (?token=...) — provider can only upload to their
 *     own providerId; we verify the token's providerId matches the form field.
 *
 * The blob URL is NOT returned. Downloads are gated through
 * /api/document/[id]/download which mints a short-lived SAS URL.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { uploadDocument } from "@/lib/azure/blob";
import { documentBlobPath } from "@/lib/blob-naming";
import { writeAuditLog } from "@/lib/audit";
import { ProviderTokenError, verifyProviderInviteToken } from "@/lib/auth/provider-token";
import type { DocumentType, DocumentSource } from "@prisma/client";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const STAFF_ROLES = new Set(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"]);

interface AuthContext {
  uploadedById: string | null;
  actorRole: string;
  ownedProviderId: string | null; // when set, uploader is a provider and must match
}

async function authorize(req: NextRequest, providerId: string): Promise<AuthContext | NextResponse> {
  const session = await auth();
  if (session?.user && STAFF_ROLES.has(session.user.role)) {
    return { uploadedById: session.user.id, actorRole: session.user.role, ownedProviderId: null };
  }

  // Provider path — must include token in query string or body
  const tokenFromQuery = req.nextUrl.searchParams.get("token");
  const tokenHeader = req.headers.get("x-provider-token");
  const token = tokenFromQuery ?? tokenHeader;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const verified = await verifyProviderInviteToken(token);
    if (verified.providerId !== providerId) {
      return NextResponse.json({ error: "Forbidden: provider mismatch" }, { status: 403 });
    }
    return { uploadedById: null, actorRole: "PROVIDER", ownedProviderId: verified.providerId };
  } catch (e) {
    const status = e instanceof ProviderTokenError ? e.status : 401;
    return NextResponse.json({ error: "Unauthorized" }, { status });
  }
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  const providerId = formData.get("providerId") as string | null;
  const documentType = formData.get("documentType") as string | null;
  const source = (formData.get("source") as string) ?? "PROVIDER_UPLOAD";

  if (!file || !providerId || !documentType) {
    return NextResponse.json(
      { error: "Missing required fields: file, providerId, documentType" },
      { status: 400 }
    );
  }

  const authResult = await authorize(req, providerId);
  if (authResult instanceof NextResponse) return authResult;

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
      { status: 400 }
    );
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return NextResponse.json(
      { error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  // Confirm provider exists before allocating a blob path or DB row.
  const provider = await db.provider.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Create document record first to get a stable id for the blob path.
  const doc = await db.document.create({
    data: {
      providerId,
      documentType: documentType as DocumentType,
      originalFilename: file.name,
      blobUrl: "",
      blobContainer: process.env.AZURE_BLOB_CONTAINER ?? "essen-credentialing",
      blobPath: "",
      fileSizeBytes: file.size,
      mimeType: file.type,
      uploadedById: authResult.uploadedById,
      uploaderType: authResult.actorRole === "PROVIDER" ? "PROVIDER" : "STAFF",
      source: source as DocumentSource,
      ocrStatus: "PENDING",
    },
  });

  const blobPath = documentBlobPath(providerId, doc.id, file.name);

  try {
    await uploadDocument({
      blobPath,
      content: buffer,
      contentType: file.type,
      metadata: {
        providerId,
        documentType,
        documentId: doc.id,
        uploadedBy: authResult.uploadedById ?? "provider",
      },
    });
  } catch (uploadError) {
    await db.document.delete({ where: { id: doc.id } });
    console.error("[Upload] Blob upload failed:", uploadError);
    return NextResponse.json({ error: "File upload failed" }, { status: 500 });
  }

  // Persist blob coordinates only — no public URL is stored or returned.
  const updatedDoc = await db.document.update({
    where: { id: doc.id },
    data: { blobUrl: "", blobPath },
  });

  const checklistItem = await db.checklistItem.findFirst({
    where: { providerId, documentType: documentType as DocumentType },
  });
  if (checklistItem) {
    await db.checklistItem.update({
      where: { id: checklistItem.id },
      data: {
        status: "RECEIVED",
        documentId: doc.id,
        receivedAt: new Date(),
      },
    });
  }

  await writeAuditLog({
    actorId: authResult.uploadedById,
    actorRole: authResult.actorRole,
    action: "document.uploaded",
    entityType: "Document",
    entityId: doc.id,
    providerId,
    afterState: {
      documentType,
      filename: file.name,
      fileSize: file.size,
      source,
    },
  });

  return NextResponse.json({
    success: true,
    document: {
      id: updatedDoc.id,
      documentType: updatedDoc.documentType,
      originalFilename: updatedDoc.originalFilename,
      fileSizeBytes: updatedDoc.fileSizeBytes,
      uploadedAt: updatedDoc.uploadedAt,
    },
  });
}
