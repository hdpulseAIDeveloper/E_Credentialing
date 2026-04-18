/**
 * Unit tests for EvaluationService (Wave 3.1).
 *
 * Covers:
 *   - list / getById / listByProvider / getDashboard
 *   - create + cross-tenant privilege validation + period-date validation
 *   - update + COMPLETED-is-terminal guard + completedAt stamping
 *   - delete + SCHEDULED-only precondition
 *   - createAutoFppeForPrivilege (JC MS.08.01.01) — idempotent, skips
 *     already-existing FPPE rows, falls back to approvedDate / now()
 *   - runAutoOppeSchedule (JC MS.08.01.03) — seeds initial cycle, queues
 *     next cycle within lookahead, idempotency, error isolation per provider
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  EvaluationService,
  FPPE_DEFAULT_PERIOD_DAYS,
  OPPE_LOOKAHEAD_DAYS,
  OPPE_PERIOD_MONTHS,
} from "@/server/services/evaluation";
import type { AuditWriter } from "@/server/services/document";

const ACTOR = { id: "user-1", role: "MANAGER" };
const NOW = new Date("2026-04-18T00:00:00.000Z");

interface MockDb {
  practiceEvaluation: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  provider: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  hospitalPrivilege: {
    findUnique: ReturnType<typeof vi.fn>;
  };
}

function makeDb(): MockDb {
  return {
    practiceEvaluation: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
      count: vi.fn().mockResolvedValue(0),
    },
    provider: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    hospitalPrivilege: {
      findUnique: vi.fn(),
    },
  };
}

function makeService(db: MockDb) {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new EvaluationService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

describe("EvaluationService — CRUD", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("list applies providerId / type / status filters and paginates", async () => {
    db.practiceEvaluation.count.mockResolvedValue(7);
    db.practiceEvaluation.findMany.mockResolvedValue([{ id: "e1" }]);
    const { svc } = makeService(db);
    const out = await svc.list({
      providerId: "p1",
      evaluationType: "OPPE",
      status: "SCHEDULED",
      page: 2,
      limit: 5,
    });
    expect(out.total).toBe(7);
    expect(out.evaluations).toHaveLength(1);
    expect(db.practiceEvaluation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { providerId: "p1", evaluationType: "OPPE", status: "SCHEDULED" },
        skip: 5,
        take: 5,
        orderBy: { dueDate: "asc" },
      }),
    );
  });

  it("getById 404s when row missing", async () => {
    db.practiceEvaluation.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(svc.getById("missing")).rejects.toBeInstanceOf(TRPCError);
  });

  it("create 404s when provider missing", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "missing",
        evaluationType: "OPPE",
        periodStart: "2026-04-01",
        periodEnd: "2026-10-01",
        dueDate: "2026-10-15",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("create rejects a privilege belonging to another provider", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });
    db.hospitalPrivilege.findUnique.mockResolvedValue({
      id: "priv-1",
      providerId: "OTHER",
    });
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "p1",
        evaluationType: "FPPE",
        privilegeId: "priv-1",
        periodStart: "2026-04-01",
        periodEnd: "2026-07-01",
        dueDate: "2026-07-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.practiceEvaluation.create).not.toHaveBeenCalled();
  });

  it("create rejects periodEnd <= periodStart", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "p1",
        evaluationType: "OPPE",
        periodStart: "2026-04-01",
        periodEnd: "2026-04-01",
        dueDate: "2026-04-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create writes audit row and returns the created evaluation", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });
    db.practiceEvaluation.create.mockResolvedValue({ id: "ev-1" });
    const { svc, audit } = makeService(db);
    const out = await svc.create({
      providerId: "p1",
      evaluationType: "OPPE",
      periodStart: "2026-04-01",
      periodEnd: "2026-10-01",
      dueDate: "2026-10-15",
    });
    expect(out).toEqual({ id: "ev-1" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "evaluation.created",
        entityId: "ev-1",
        providerId: "p1",
      }),
    );
  });

  it("update refuses to reopen a COMPLETED evaluation", async () => {
    db.practiceEvaluation.findUnique.mockResolvedValue({
      id: "ev-1",
      providerId: "p1",
      status: "COMPLETED",
    });
    const { svc } = makeService(db);
    await expect(
      svc.update({ id: "ev-1", status: "IN_PROGRESS" }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
  });

  it("update stamps completedAt only on the COMPLETED transition", async () => {
    db.practiceEvaluation.findUnique.mockResolvedValue({
      id: "ev-1",
      providerId: "p1",
      status: "IN_PROGRESS",
    });
    db.practiceEvaluation.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => Promise.resolve({ id: "ev-1", ...data }),
    );
    const { svc } = makeService(db);
    const out = await svc.update({ id: "ev-1", status: "COMPLETED", findings: "ok" });
    expect(out).toMatchObject({ status: "COMPLETED" });
    const call = db.practiceEvaluation.update.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.completedAt).toBeInstanceOf(Date);
  });

  it("delete refuses to delete a non-SCHEDULED evaluation", async () => {
    db.practiceEvaluation.findUnique.mockResolvedValue({
      id: "ev-1",
      providerId: "p1",
      status: "IN_PROGRESS",
      evaluationType: "FPPE",
    });
    const { svc } = makeService(db);
    await expect(svc.delete("ev-1")).rejects.toMatchObject({
      code: "PRECONDITION_FAILED",
    });
    expect(db.practiceEvaluation.delete).not.toHaveBeenCalled();
  });

  it("getDashboard returns the five aggregate counts", async () => {
    db.practiceEvaluation.count
      .mockResolvedValueOnce(10) // totalScheduled
      .mockResolvedValueOnce(2) //  overdue
      .mockResolvedValueOnce(5) //  oppePending
      .mockResolvedValueOnce(3) //  fppePending
      .mockResolvedValueOnce(7); // completedThisMonth
    const { svc } = makeService(db);
    const out = await svc.getDashboard();
    expect(out).toEqual({
      totalScheduled: 10,
      overdue: 2,
      oppePending: 5,
      fppePending: 3,
      completedThisMonth: 7,
    });
  });
});

describe("EvaluationService — JC MS.08.01.01 auto-FPPE", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("returns null when the privilege does not exist", async () => {
    db.hospitalPrivilege.findUnique.mockResolvedValue(null);
    const { svc, audit } = makeService(db);
    const out = await svc.createAutoFppeForPrivilege("missing");
    expect(out).toBeNull();
    expect(audit).not.toHaveBeenCalled();
  });

  it("is idempotent — skips create when a prior FPPE exists for the privilege", async () => {
    db.hospitalPrivilege.findUnique.mockResolvedValue({
      id: "priv-1",
      providerId: "p1",
      facilityName: "St. Whatever",
      privilegeType: "Cardiology",
      effectiveDate: NOW,
      approvedDate: NOW,
      status: "APPROVED",
    });
    db.practiceEvaluation.findFirst.mockResolvedValue({ id: "existing-fppe" });
    const { svc, audit } = makeService(db);
    const out = await svc.createAutoFppeForPrivilege("priv-1");
    expect(out).toBe("existing-fppe");
    expect(db.practiceEvaluation.create).not.toHaveBeenCalled();
    expect(audit).not.toHaveBeenCalled();
  });

  it("creates a new FPPE row using the JC default 90-day window and writes audit", async () => {
    const grantDate = new Date("2026-01-15T00:00:00.000Z");
    db.hospitalPrivilege.findUnique.mockResolvedValue({
      id: "priv-2",
      providerId: "p1",
      facilityName: "St. Whatever",
      privilegeType: "Cardiology",
      effectiveDate: grantDate,
      approvedDate: null,
      status: "APPROVED",
    });
    db.practiceEvaluation.findFirst.mockResolvedValue(null);
    db.practiceEvaluation.create.mockResolvedValue({
      id: "fppe-new",
      providerId: "p1",
    });
    const { svc, audit } = makeService(db);
    const out = await svc.createAutoFppeForPrivilege("priv-2");
    expect(out).toBe("fppe-new");
    const call = db.practiceEvaluation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.evaluationType).toBe("FPPE");
    expect(call.data.privilegeId).toBe("priv-2");
    expect(call.data.triggerRefId).toBe("priv-2");
    const periodEnd = call.data.periodEnd as Date;
    const expectedEnd = new Date(grantDate);
    expectedEnd.setDate(expectedEnd.getDate() + FPPE_DEFAULT_PERIOD_DAYS);
    expect(periodEnd.getTime()).toBe(expectedEnd.getTime());
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "evaluation.auto_fppe_created",
        entityId: "fppe-new",
        providerId: "p1",
      }),
    );
  });

  it("respects an explicit periodDays override", async () => {
    const grantDate = new Date("2026-01-15T00:00:00.000Z");
    db.hospitalPrivilege.findUnique.mockResolvedValue({
      id: "priv-3",
      providerId: "p1",
      facilityName: "St. X",
      privilegeType: "Surgery",
      effectiveDate: grantDate,
      approvedDate: null,
      status: "APPROVED",
    });
    db.practiceEvaluation.findFirst.mockResolvedValue(null);
    db.practiceEvaluation.create.mockResolvedValue({ id: "f1", providerId: "p1" });
    const { svc } = makeService(db);
    await svc.createAutoFppeForPrivilege("priv-3", { periodDays: 180 });
    const call = db.practiceEvaluation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    const periodEnd = call.data.periodEnd as Date;
    const expectedEnd = new Date(grantDate);
    expectedEnd.setDate(expectedEnd.getDate() + 180);
    expect(periodEnd.getTime()).toBe(expectedEnd.getTime());
  });
});

describe("EvaluationService — JC MS.08.01.03 auto-OPPE schedule", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("seeds an initial OPPE for a provider with no OPPE history", async () => {
    db.provider.findMany.mockResolvedValue([
      { id: "p1", practiceEvaluations: [] },
    ]);
    db.practiceEvaluation.create.mockResolvedValue({ id: "ev-init" });
    const { svc, audit } = makeService(db);

    const out = await svc.runAutoOppeSchedule(NOW);
    expect(out).toEqual({ providersConsidered: 1, oppesCreated: 1, errors: 0 });

    const call = db.practiceEvaluation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.evaluationType).toBe("OPPE");
    expect(call.data.trigger).toMatch(/initial cycle/i);
    const ps = call.data.periodStart as Date;
    const pe = call.data.periodEnd as Date;
    expect(pe.getMonth() - ps.getMonth() + (pe.getFullYear() - ps.getFullYear()) * 12)
      .toBe(OPPE_PERIOD_MONTHS);
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "evaluation.auto_oppe_created",
        entityId: "ev-init",
      }),
    );
  });

  it("queues the next-cycle OPPE when the latest cycle ends within the lookahead window", async () => {
    const latestEnd = new Date(NOW);
    latestEnd.setDate(latestEnd.getDate() + (OPPE_LOOKAHEAD_DAYS - 1));
    db.provider.findMany.mockResolvedValue([
      {
        id: "p1",
        practiceEvaluations: [{ periodEnd: latestEnd }],
      },
    ]);
    db.practiceEvaluation.findFirst.mockResolvedValue(null);
    db.practiceEvaluation.create.mockResolvedValue({ id: "ev-next" });
    const { svc } = makeService(db);
    const out = await svc.runAutoOppeSchedule(NOW);
    expect(out.oppesCreated).toBe(1);
    const call = db.practiceEvaluation.create.mock.calls[0]![0] as {
      data: Record<string, unknown>;
    };
    expect(call.data.trigger).toMatch(/next routine cycle/i);
    const start = call.data.periodStart as Date;
    expect(start.getTime()).toBe(latestEnd.getTime() + 24 * 60 * 60 * 1000);
  });

  it("does NOT create a duplicate when a next-cycle OPPE already exists", async () => {
    const latestEnd = new Date(NOW);
    latestEnd.setDate(latestEnd.getDate() + (OPPE_LOOKAHEAD_DAYS - 1));
    db.provider.findMany.mockResolvedValue([
      {
        id: "p1",
        practiceEvaluations: [{ periodEnd: latestEnd }],
      },
    ]);
    db.practiceEvaluation.findFirst.mockResolvedValue({ id: "already-there" });
    const { svc } = makeService(db);
    const out = await svc.runAutoOppeSchedule(NOW);
    expect(out.oppesCreated).toBe(0);
    expect(db.practiceEvaluation.create).not.toHaveBeenCalled();
  });

  it("does NOT pre-create when the latest cycle is well outside the lookahead window", async () => {
    const latestEnd = new Date(NOW);
    latestEnd.setDate(latestEnd.getDate() + (OPPE_LOOKAHEAD_DAYS + 60));
    db.provider.findMany.mockResolvedValue([
      {
        id: "p1",
        practiceEvaluations: [{ periodEnd: latestEnd }],
      },
    ]);
    const { svc } = makeService(db);
    const out = await svc.runAutoOppeSchedule(NOW);
    expect(out.oppesCreated).toBe(0);
    expect(db.practiceEvaluation.create).not.toHaveBeenCalled();
  });

  it("isolates per-provider errors and continues processing remaining providers", async () => {
    db.provider.findMany.mockResolvedValue([
      { id: "p-bad", practiceEvaluations: [] },
      { id: "p-good", practiceEvaluations: [] },
    ]);
    db.practiceEvaluation.create
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({ id: "ev-good" });
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { svc } = makeService(db);
    const out = await svc.runAutoOppeSchedule(NOW);
    expect(out.providersConsidered).toBe(2);
    expect(out.oppesCreated).toBe(1);
    expect(out.errors).toBe(1);
    errSpy.mockRestore();
  });
});
