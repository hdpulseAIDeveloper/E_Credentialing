/**
 * Unit tests for RecredentialingService (Wave 2.1).
 *
 * Note: there's a separate `recredentialing-cycle.ts` file with pure date
 * helpers; that has its own test file. This file only covers the service
 * (cycle CRUD + status transitions + bulk-initiate).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { RecredentialingService } from "@/server/services/recredentialing";
import type { AuditWriter } from "@/server/services/document";

const ACTOR = { id: "actor-1", role: "MANAGER" };

interface MockDb {
  recredentialingCycle: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    aggregate: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  provider: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
}

function makeDb(): MockDb {
  return {
    recredentialingCycle: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn(),
      aggregate: vi.fn().mockResolvedValue({ _max: { cycleNumber: null } }),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    provider: { findUnique: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService(db: MockDb) {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new RecredentialingService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

describe("RecredentialingService", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("nextCycleNumber returns 1 for a brand-new provider", async () => {
    const { svc } = makeService(db);
    const n = await svc.nextCycleNumber("p1");
    expect(n).toBe(1);
  });

  it("nextCycleNumber returns max+1 for an existing provider", async () => {
    db.recredentialingCycle.aggregate.mockResolvedValue({ _max: { cycleNumber: 4 } });
    const { svc } = makeService(db);
    expect(await svc.nextCycleNumber("p1")).toBe(5);
  });

  it("create 404s when the provider does not exist", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(
      svc.create({ providerId: "missing", dueDate: "2027-01-15" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("create defaults cycleLengthMonths to 36 (NCQA CR-1)", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });
    db.recredentialingCycle.create.mockResolvedValue({ id: "c1" });
    const { svc } = makeService(db);
    await svc.create({ providerId: "p1", dueDate: "2027-01-15" });
    expect(db.recredentialingCycle.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ cycleLengthMonths: 36, cycleNumber: 1 }),
      }),
    );
  });

  it("updateStatus stamps startedAt only the first time entering IN_PROGRESS", async () => {
    db.recredentialingCycle.findUnique.mockResolvedValue({
      id: "c1",
      providerId: "p1",
      status: "PENDING",
      startedAt: null,
    });
    const { svc } = makeService(db);
    await svc.updateStatus({ id: "c1", status: "IN_PROGRESS" });

    const dataArg = db.recredentialingCycle.update.mock.calls[0]![0].data;
    expect(dataArg.startedAt).toBeInstanceOf(Date);
    expect(dataArg.completedAt).toBeUndefined();
  });

  it("updateStatus stamps completedAt on COMPLETED transition", async () => {
    db.recredentialingCycle.findUnique.mockResolvedValue({
      id: "c1",
      providerId: "p1",
      status: "IN_PROGRESS",
      startedAt: new Date(),
    });
    const { svc } = makeService(db);
    await svc.updateStatus({ id: "c1", status: "COMPLETED" });
    const dataArg = db.recredentialingCycle.update.mock.calls[0]![0].data;
    expect(dataArg.completedAt).toBeInstanceOf(Date);
  });

  it("delete refuses to delete a non-PENDING cycle (PRECONDITION_FAILED)", async () => {
    db.recredentialingCycle.findUnique.mockResolvedValue({
      id: "c1",
      providerId: "p1",
      status: "COMPLETED",
      cycleNumber: 1,
    });
    const { svc } = makeService(db);
    await expect(svc.delete("c1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(db.recredentialingCycle.delete).not.toHaveBeenCalled();
  });

  it("delete works for PENDING cycles and audits", async () => {
    db.recredentialingCycle.findUnique.mockResolvedValue({
      id: "c1",
      providerId: "p1",
      status: "PENDING",
      cycleNumber: 1,
    });
    const { svc, audit } = makeService(db);
    const r = await svc.delete("c1");
    expect(r).toEqual({ success: true });
    expect(audit.mock.calls[0]?.[0]).toMatchObject({ action: "recredentialing.deleted" });
  });

  it("initiateBulk skips providers with an active cycle", async () => {
    db.provider.findMany.mockResolvedValue([
      { id: "p1", initialApprovalDate: new Date("2020-01-01") },
      { id: "p2", initialApprovalDate: new Date("2020-01-01") },
    ]);
    db.recredentialingCycle.findFirst
      .mockResolvedValueOnce({ id: "active-1" }) // p1 has active cycle
      .mockResolvedValueOnce(null); // p2 does not
    db.recredentialingCycle.create.mockResolvedValue({ id: "new-cycle" });
    const { svc } = makeService(db);

    const r = await svc.initiateBulk();
    expect(r).toEqual({ created: 1 });
    expect(db.recredentialingCycle.create).toHaveBeenCalledTimes(1);
  });

  it("initiateBulk uses now+3mo when computed due date is in the past", async () => {
    db.provider.findMany.mockResolvedValue([
      { id: "p1", initialApprovalDate: new Date("2010-01-01") }, // 36mo from then is well past
    ]);
    db.recredentialingCycle.findFirst.mockResolvedValue(null);
    db.recredentialingCycle.create.mockResolvedValue({ id: "new-cycle" });
    const { svc } = makeService(db);

    await svc.initiateBulk();
    const dueDate = (db.recredentialingCycle.create.mock.calls[0]![0].data.dueDate as Date);
    expect(dueDate.getTime()).toBeGreaterThan(Date.now());
  });
});
