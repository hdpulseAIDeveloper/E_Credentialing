import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { uploadDocument } from "@/lib/azure/blob";
import { documentBlobPath } from "@/lib/blob-naming";
import { writeAuditLog } from "@/lib/audit";
import type { DocumentType, DocumentSource } from "@prisma/client";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/tiff",
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
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

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` },
        { status: 400 }
      );
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `File type not allowed. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Read file content
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Create document record first (to get ID for blob path)
    const doc = await db.document.create({
      data: {
        providerId,
        documentType: documentType as DocumentType,
        originalFilename: file.name,
        blobUrl: "", // Will be updated after upload
        blobContainer: process.env.AZURE_BLOB_CONTAINER ?? "essen-credentialing",
        blobPath: "", // Will be updated after upload
        fileSizeBytes: file.size,
        mimeType: file.type,
        uploadedById: session.user.id,
        source: source as DocumentSource,
        ocrStatus: "PENDING",
      },
    });

    // Generate blob path and upload
    const blobPath = documentBlobPath(providerId, doc.id, file.name);
    let blobUrl = "";

    try {
      blobUrl = await uploadDocument({
        blobPath,
        content: buffer,
        contentType: file.type,
        metadata: {
          providerId,
          documentType,
          documentId: doc.id,
          uploadedBy: session.user.id,
        },
      });
    } catch (uploadError) {
      // Clean up the document record if upload failed
      await db.document.delete({ where: { id: doc.id } });
      console.error("[Upload] Blob upload failed:", uploadError);
      return NextResponse.json({ error: "File upload failed" }, { status: 500 });
    }

    // Update document with blob URL and path
    const updatedDoc = await db.document.update({
      where: { id: doc.id },
      data: { blobUrl, blobPath },
    });

    // Update checklist item
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
      actorId: session.user.id,
      actorRole: session.user.role,
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
      document: updatedDoc,
    });
  } catch (error) {
    console.error("[Upload] Error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
