/**
 * src/server/services/document.ts
 *
 * Document domain service. Owns the business rules for document upload
 * records, OCR triggering, soft-delete, and checklist updates so the tRPC
 * router (`src/server/api/routers/document.ts`) becomes a thin pass-through
 * of `parse(input) -> service.method(input) -> return`.
 *
 * Why a service (Wave 2.1, plan §service-layer):
 *   - Business logic + audit-log writes are testable without spinning up tRPC.
 *   - Multiple callers (router, BullMQ worker, cron) reuse the same code path.
 *   - The router layer cannot drift from the audit shape because the audit
 *     write lives here.
 *
 * Constructor takes a Prisma client (real or mock), an audit-write function,
 * and an actor descriptor. This is plain dependency injection — no globals.
 */
import type { PrismaClient, DocumentType, ChecklistStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { AuditLogParams } from "@/lib/audit";

/**
 * The actor performing a service call. Pulled from `ctx.session.user` at the
 * router boundary. Both fields are required because every audit log entry
 * needs them.
 */
export interface ServiceActor {
  id: string;
  role: string;
}

/**
 * Audit writer function shape — matches `writeAuditLog` from `src/lib/audit`
 * but accepts a plain function so unit tests can pass a `vi.fn()`.
 */
export type AuditWriter = (params: AuditLogParams) => Promise<unknown>;

export interface DocumentServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
}

export interface ListDocumentsInput {
  providerId: string;
  documentType?: string;
  includeDeleted?: boolean;
}

export interface CreateDocumentRecordInput {
  providerId: string;
  documentType: string;
  originalFilename: string;
  blobUrl: string;
  blobContainer: string;
  blobPath: string;
  fileSizeBytes: number;
  mimeType: string;
  source: "PROVIDER_UPLOAD" | "HR_INGESTION" | "EMAIL_INGESTION" | "BOT_OUTPUT";
}

export interface UpdateChecklistItemInput {
  id: string;
  status: "RECEIVED" | "PENDING" | "NEEDS_ATTENTION";
  flagReason?: string;
}

export class DocumentService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;

  constructor(deps: DocumentServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
  }

  async listByProvider(input: ListDocumentsInput) {
    return this.db.document.findMany({
      where: {
        providerId: input.providerId,
        ...(input.documentType && { documentType: input.documentType as DocumentType }),
        ...(input.includeDeleted ? {} : { isDeleted: false }),
      },
      include: {
        uploadedBy: { select: { id: true, displayName: true, role: true } },
        verificationRecord: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getById(id: string) {
    const doc = await this.db.document.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, displayName: true } },
        verificationRecord: true,
      },
    });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    return doc;
  }

  async softDelete(id: string, reason?: string) {
    const doc = await this.db.document.findUnique({ where: { id } });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });

    await this.db.document.update({
      where: { id },
      data: { isDeleted: true, updatedAt: new Date() },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "document.deleted",
      entityType: "Document",
      entityId: id,
      providerId: doc.providerId,
      metadata: reason ? { reason } : undefined,
    });
    return { success: true };
  }

  /**
   * Schedule OCR for a document. Idempotent against PROCESSING — re-triggering
   * a doc that is currently being OCR'd is a 400 (BAD_REQUEST) so callers get
   * a clear signal instead of silently spawning duplicate worker jobs.
   */
  async triggerOcr(id: string) {
    const doc = await this.db.document.findUnique({ where: { id } });
    if (!doc) throw new TRPCError({ code: "NOT_FOUND" });
    if (doc.ocrStatus === "PROCESSING") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "OCR already in progress" });
    }
    await this.db.document.update({
      where: { id },
      data: { ocrStatus: "PENDING" },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "document.ocr.triggered",
      entityType: "Document",
      entityId: id,
      providerId: doc.providerId,
    });
    return { success: true };
  }

  async getChecklist(providerId: string) {
    const provider = await this.db.provider.findUnique({
      where: { id: providerId },
      include: {
        providerType: { include: { documentRequirements: true } },
        checklistItems: { include: { document: true } },
      },
    });
    if (!provider) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      requirements: provider.providerType.documentRequirements,
      items: provider.checklistItems,
    };
  }

  async updateChecklistItem(input: UpdateChecklistItemInput) {
    const item = await this.db.checklistItem.findUnique({ where: { id: input.id } });
    if (!item) throw new TRPCError({ code: "NOT_FOUND" });

    const updated = await this.db.checklistItem.update({
      where: { id: input.id },
      data: {
        status: input.status as ChecklistStatus,
        manuallyFlagged: input.status === "NEEDS_ATTENTION",
        flagReason: input.flagReason ?? null,
        flaggedById: input.status === "NEEDS_ATTENTION" ? this.actor.id : null,
        receivedAt: input.status === "RECEIVED" ? new Date() : undefined,
      },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "checklist.item.updated",
      entityType: "ChecklistItem",
      entityId: input.id,
      providerId: item.providerId,
      beforeState: { status: item.status },
      afterState: { status: input.status },
    });
    return updated;
  }

  /**
   * Persist a document row after the underlying file has been written to
   * blob storage. If the provider already has a checklist row for this
   * document type, mark it as RECEIVED in the same logical operation so the
   * UI reflects the new state without a second round-trip.
   */
  async createRecord(input: CreateDocumentRecordInput) {
    const doc = await this.db.document.create({
      data: {
        providerId: input.providerId,
        documentType: input.documentType as DocumentType,
        originalFilename: input.originalFilename,
        blobUrl: input.blobUrl,
        blobContainer: input.blobContainer,
        blobPath: input.blobPath,
        fileSizeBytes: input.fileSizeBytes,
        mimeType: input.mimeType,
        uploadedById: this.actor.id,
        source: input.source,
        ocrStatus: "PENDING",
      },
    });

    const checklistItem = await this.db.checklistItem.findFirst({
      where: {
        providerId: input.providerId,
        documentType: input.documentType as DocumentType,
      },
    });
    if (checklistItem) {
      await this.db.checklistItem.update({
        where: { id: checklistItem.id },
        data: {
          status: "RECEIVED",
          documentId: doc.id,
          receivedAt: new Date(),
        },
      });
    }

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "document.uploaded",
      entityType: "Document",
      entityId: doc.id,
      providerId: input.providerId,
      afterState: {
        documentType: input.documentType,
        filename: input.originalFilename,
        source: input.source,
      },
    });
    return doc;
  }
}
