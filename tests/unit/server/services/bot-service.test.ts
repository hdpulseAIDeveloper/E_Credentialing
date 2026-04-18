/**
 * Unit tests for BotService (Wave 2.1).
 *
 * Verifies queue interaction, the FAILED-on-enqueue-error rollback path,
 * and audit shape. The Prisma client AND the BullMQ queue are mocks.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { BotService, BOT_JOB_NAME, TRIGGERABLE_BOT_TYPES } from "@/server/services/bot";
import type { AuditWriter } from "@/server/services/document";

const ACTOR = { id: "actor-1", role: "MANAGER" };

interface MockDb {
  botRun: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
  };
  provider: { findUnique: ReturnType<typeof vi.fn> };
  verificationRecord: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
}

function makeDb(): MockDb {
  return {
    botRun: {
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    provider: { findUnique: vi.fn() },
    verificationRecord: {
      findUnique: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function makeService(db: MockDb, queue: { add: ReturnType<typeof vi.fn> } | null) {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new BotService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
    queue,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

describe("BotService", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("BOT_JOB_NAME has an entry for every TRIGGERABLE_BOT_TYPES value", () => {
    for (const t of TRIGGERABLE_BOT_TYPES) {
      expect(BOT_JOB_NAME[t]).toBeDefined();
      expect(BOT_JOB_NAME[t]).toMatch(/^[a-z0-9-]+$/);
    }
  });

  it("triggerBot 404s when the provider does not exist", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db, { add: vi.fn() });
    await expect(
      svc.triggerBot({ providerId: "missing", botType: "LICENSE_VERIFICATION" }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("triggerBot enqueues a job with the mapped name and high priority", async () => {
    db.provider.findUnique.mockResolvedValue({
      id: "p1",
      npi: "1234567890",
      legalFirstName: "Jane",
      legalLastName: "Doe",
      providerType: { abbreviation: "MD" },
      licenses: [{ state: "NY", licenseNumber: "L-1" }],
    });
    db.botRun.create.mockResolvedValue({ id: "run-1" });
    const queue = { add: vi.fn().mockResolvedValue(undefined) };
    const { svc, audit } = makeService(db, queue);

    const r = await svc.triggerBot({
      providerId: "p1",
      botType: "DEA_VERIFICATION",
    });

    expect(r).toEqual({ id: "run-1" });
    expect(queue.add).toHaveBeenCalledWith(
      "dea-verification",
      { botRunId: "run-1", providerId: "p1" },
      expect.objectContaining({ priority: 1, attempts: 3 }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "bot.triggered",
      entityId: "run-1",
    });
  });

  it("triggerBot marks the run FAILED and rethrows when enqueue throws", async () => {
    db.provider.findUnique.mockResolvedValue({
      id: "p1",
      npi: "1",
      legalFirstName: "A",
      legalLastName: "B",
      providerType: { abbreviation: "MD" },
      licenses: [],
    });
    db.botRun.create.mockResolvedValue({ id: "run-2" });
    const queue = { add: vi.fn().mockRejectedValue(new Error("Redis down")) };
    const { svc, audit } = makeService(db, queue);

    await expect(
      svc.triggerBot({ providerId: "p1", botType: "OIG_SANCTIONS" }),
    ).rejects.toBeInstanceOf(TRPCError);

    expect(db.botRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "run-2" },
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
    // No audit row on failed enqueue — the bot was never actually triggered.
    expect(audit).not.toHaveBeenCalled();
  });

  it("acknowledgeFlag stamps actor + timestamp and audits", async () => {
    db.verificationRecord.findUnique.mockResolvedValue({
      id: "vr-1",
      providerId: "p1",
    });
    const { svc, audit } = makeService(db, null);
    await svc.acknowledgeFlag("vr-1");

    expect(db.verificationRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "vr-1" },
        data: expect.objectContaining({ acknowledgedById: "actor-1" }),
      }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "bot.flag.acknowledged",
      providerId: "p1",
    });
  });

  it("getLatestByProvider folds runs to one-per-type, latest first", async () => {
    db.botRun.findMany.mockResolvedValue([
      { id: "r1", botType: "LICENSE_VERIFICATION", verificationRecords: [] },
      { id: "r2", botType: "LICENSE_VERIFICATION", verificationRecords: [] },
      { id: "r3", botType: "OIG_SANCTIONS", verificationRecords: [] },
    ]);
    const { svc } = makeService(db, null);
    const result = await svc.getLatestByProvider("p1");
    const license = result.find((r) => r.botType === "LICENSE_VERIFICATION");
    const oig = result.find((r) => r.botType === "OIG_SANCTIONS");
    const sam = result.find((r) => r.botType === "SAM_SANCTIONS");
    expect(license?.run?.id).toBe("r1");
    expect(oig?.run?.id).toBe("r3");
    expect(sam?.run).toBeNull();
  });
});
