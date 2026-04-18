/**
 * Unit tests for DocumentService (Wave 2.1).
 *
 * The Prisma client is mocked end-to-end so the test exercises only the
 * service's branching, audit-write contracts, and TRPCError shape. There is
 * no DB I/O here — the integration test for the document flow lives in
 * tests/e2e/files/.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  DocumentService,
  type AuditWriter,
} from "@/server/services/document";

interface MockDb {
  document: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  checklistItem: {
    findUnique: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  provider: {
    findUnique: ReturnType<typeof vi.fn>;
  };
}

const ACTOR = { id: "actor-1", role: "MANAGER" };

function makeDb(): MockDb {
  return {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    checklistItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
    provider: { findUnique: vi.fn() },
  };
}

function makeService(db: MockDb): {
  svc: DocumentService;
  audit: ReturnType<typeof vi.fn>;
} {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new DocumentService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

describe("DocumentService", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("getById throws NOT_FOUND when the row is missing", async () => {
    db.document.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(svc.getById("00000000-0000-0000-0000-000000000000")).rejects.toBeInstanceOf(
      TRPCError,
    );
  });

  it("softDelete writes the audit row WITH the supplied reason", async () => {
    db.document.findUnique.mockResolvedValue({ id: "d1", providerId: "p1" });
    const { svc, audit } = makeService(db);

    const r = await svc.softDelete("d1", "Wrong file uploaded");

    expect(r).toEqual({ success: true });
    expect(db.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d1" }, data: expect.objectContaining({ isDeleted: true }) }),
    );
    expect(audit).toHaveBeenCalledOnce();
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "document.deleted",
      entityType: "Document",
      entityId: "d1",
      providerId: "p1",
      actorId: "actor-1",
      metadata: { reason: "Wrong file uploaded" },
    });
  });

  it("triggerOcr rejects when the doc is already PROCESSING", async () => {
    db.document.findUnique.mockResolvedValue({ id: "d1", providerId: "p1", ocrStatus: "PROCESSING" });
    const { svc, audit } = makeService(db);
    await expect(svc.triggerOcr("d1")).rejects.toBeInstanceOf(TRPCError);
    expect(db.document.update).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("triggerOcr transitions to PENDING and audits", async () => {
    db.document.findUnique.mockResolvedValue({ id: "d1", providerId: "p1", ocrStatus: "PENDING" });
    const { svc, audit } = makeService(db);
    await svc.triggerOcr("d1");
    expect(db.document.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { ocrStatus: "PENDING" } }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({ action: "document.ocr.triggered" });
  });

  it("createRecord auto-marks a matching checklist item as RECEIVED", async () => {
    db.document.create.mockResolvedValue({ id: "doc-1", providerId: "p1" });
    db.checklistItem.findFirst.mockResolvedValue({ id: "ci-1" });
    const { svc, audit } = makeService(db);

    await svc.createRecord({
      providerId: "p1",
      documentType: "DRIVERS_LICENSE",
      originalFilename: "x.pdf",
      blobUrl: "https://example/blob",
      blobContainer: "documents",
      blobPath: "p1/x.pdf",
      fileSizeBytes: 100,
      mimeType: "application/pdf",
      source: "PROVIDER_UPLOAD",
    });

    expect(db.checklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "ci-1" },
        data: expect.objectContaining({ status: "RECEIVED", documentId: "doc-1" }),
      }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "document.uploaded",
      providerId: "p1",
    });
  });

  it("createRecord skips checklist update when no matching item exists", async () => {
    db.document.create.mockResolvedValue({ id: "doc-1", providerId: "p1" });
    db.checklistItem.findFirst.mockResolvedValue(null);
    const { svc } = makeService(db);

    await svc.createRecord({
      providerId: "p1",
      documentType: "OTHER",
      originalFilename: "x.pdf",
      blobUrl: "https://example/blob",
      blobContainer: "documents",
      blobPath: "p1/x.pdf",
      fileSizeBytes: 100,
      mimeType: "application/pdf",
      source: "EMAIL_INGESTION",
    });

    expect(db.checklistItem.update).not.toHaveBeenCalled();
  });

  it("updateChecklistItem clears flaggedById when status is not NEEDS_ATTENTION", async () => {
    db.checklistItem.findUnique.mockResolvedValue({
      id: "ci-1",
      providerId: "p1",
      status: "NEEDS_ATTENTION",
    });
    const { svc, audit } = makeService(db);
    await svc.updateChecklistItem({ id: "ci-1", status: "RECEIVED" });

    expect(db.checklistItem.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RECEIVED",
          manuallyFlagged: false,
          flaggedById: null,
        }),
      }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "checklist.item.updated",
      beforeState: { status: "NEEDS_ATTENTION" },
      afterState: { status: "RECEIVED" },
    });
  });
});
