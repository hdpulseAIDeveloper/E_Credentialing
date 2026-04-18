/**
 * Unit tests for SanctionsService (Wave 2.1).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { SanctionsService } from "@/server/services/sanctions";
import type { AuditWriter } from "@/server/services/document";

const ACTOR = { id: "actor-1", role: "ADMIN" };

interface MockDb {
  sanctionsCheck: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  botRun: { create: ReturnType<typeof vi.fn> };
  provider: { findUnique: ReturnType<typeof vi.fn> };
}

function makeDb(): MockDb {
  return {
    sanctionsCheck: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn().mockResolvedValue({}),
    },
    botRun: { create: vi.fn() },
    provider: { findUnique: vi.fn() },
  };
}

function makeService(db: MockDb, queue: { add: ReturnType<typeof vi.fn> } | null) {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new SanctionsService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
    queue,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

describe("SanctionsService", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("triggerCheck 404s when the provider is missing", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db, { add: vi.fn() });
    await expect(svc.triggerCheck("missing", "OIG")).rejects.toBeInstanceOf(TRPCError);
  });

  it("triggerCheck enqueues the OIG job and writes the audit row", async () => {
    db.provider.findUnique.mockResolvedValue({
      id: "p1",
      npi: "1",
      legalFirstName: "A",
      legalLastName: "B",
    });
    db.botRun.create.mockResolvedValue({ id: "run-1" });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const { svc, audit } = makeService(db, queue);

    await svc.triggerCheck("p1", "OIG");

    expect(queue.add).toHaveBeenCalledWith(
      "oig-sanctions",
      expect.objectContaining({ providerId: "p1" }),
      expect.any(Object),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "sanctions.check.triggered",
      afterState: { source: "OIG", botRunId: "run-1" },
    });
  });

  it("triggerCheck enqueues SAM job for SAM_GOV source", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1", npi: "1", legalFirstName: "A", legalLastName: "B" });
    db.botRun.create.mockResolvedValue({ id: "run-2" });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const { svc } = makeService(db, queue);

    await svc.triggerCheck("p1", "SAM_GOV");
    expect(queue.add).toHaveBeenCalledWith(
      "sam-sanctions",
      expect.any(Object),
      expect.any(Object),
    );
  });

  it("triggerCheck swallows enqueue errors (non-fatal by design)", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1", npi: "1", legalFirstName: "A", legalLastName: "B" });
    db.botRun.create.mockResolvedValue({ id: "run-3" });
    const queue = { add: vi.fn().mockRejectedValue(new Error("redis down")) };
    const { svc, audit } = makeService(db, queue);

    const r = await svc.triggerCheck("p1", "OIG");
    expect(r).toEqual({ id: "run-3" });
    expect(audit).toHaveBeenCalled();
  });

  it("acknowledge writes the audit row with provider ID", async () => {
    db.sanctionsCheck.findUnique.mockResolvedValue({ id: "s1", providerId: "p1" });
    const { svc, audit } = makeService(db, null);
    await svc.acknowledge("s1");
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "sanctions.acknowledged",
      providerId: "p1",
    });
  });
});
