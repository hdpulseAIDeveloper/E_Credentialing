/**
 * Unit tests for the sanctions re-check job idempotency + env gating.
 *
 * The job has three observable rules:
 *   1. No-op when neither AZURE_BLOB_ACCOUNT_URL nor SAM_GOV_API_KEY is set.
 *   2. Skip providers who already have >= 2 OIG/SAM BotRuns within the last 24h.
 *   3. Otherwise, create 2 BotRun rows per eligible provider and enqueue 2 jobs.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const botRunRecords: Array<{ providerId: string; botType: string; createdAt: Date }> = [];
const addCalls: Array<{ name: string; data: Record<string, unknown> }> = [];

const mockQueueAdd = vi.fn(async (name: string, data: Record<string, unknown>) => {
  addCalls.push({ name, data });
  return { id: `job-${addCalls.length}` };
});
const mockQueueClose = vi.fn(async () => undefined);

vi.mock("bullmq", () => ({
  Queue: vi.fn(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

vi.mock("../../../src/lib/redis", () => ({
  createRedisConnection: vi.fn(() => ({})),
}));

const dbMock = {
  provider: {
    findMany: vi.fn(async () => []),
  },
  botRun: {
    count: vi.fn(async () => 0),
    create: vi.fn(async ({ data }: { data: { providerId: string; botType: string } }) => {
      const row = { ...data, id: `br-${botRunRecords.length + 1}`, createdAt: new Date() };
      botRunRecords.push(row);
      return row;
    }),
  },
};

vi.mock("../../../src/server/db", () => ({
  db: dbMock,
}));

const { runMonthlySanctionsCheck } = await import("../../../src/workers/jobs/sanctions-monthly");

describe("runMonthlySanctionsCheck", () => {
  beforeEach(() => {
    botRunRecords.length = 0;
    addCalls.length = 0;
    mockQueueAdd.mockClear();
    mockQueueClose.mockClear();
    dbMock.provider.findMany.mockReset();
    dbMock.botRun.count.mockReset();
    dbMock.botRun.create.mockReset();
    delete process.env.AZURE_BLOB_ACCOUNT_URL;
    delete process.env.SAM_GOV_API_KEY;
  });

  it("no-ops when both env kill-switches are unset", async () => {
    await runMonthlySanctionsCheck();
    expect(dbMock.provider.findMany).not.toHaveBeenCalled();
    expect(mockQueueAdd).not.toHaveBeenCalled();
  });

  it("queues 2 jobs per eligible approved provider when env is present", async () => {
    process.env.SAM_GOV_API_KEY = "test-key";
    dbMock.provider.findMany.mockResolvedValue([
      { id: "p1", legalFirstName: "A", legalLastName: "A", npi: "111" },
      { id: "p2", legalFirstName: "B", legalLastName: "B", npi: "222" },
    ]);
    dbMock.botRun.count.mockResolvedValue(0);
    dbMock.botRun.create.mockImplementation(async ({ data }) => ({
      ...(data as Record<string, unknown>),
      id: `br-${Math.random()}`,
    }));

    await runMonthlySanctionsCheck();

    expect(dbMock.botRun.create).toHaveBeenCalledTimes(4); // 2 providers * 2 checks
    expect(mockQueueAdd).toHaveBeenCalledTimes(4);
    const jobNames = addCalls.map((c) => c.name).sort();
    expect(jobNames).toEqual(["oig-sanctions", "oig-sanctions", "sam-sanctions", "sam-sanctions"]);
  });

  it("skips providers with >= 2 recent OIG/SAM checks (24h window)", async () => {
    process.env.SAM_GOV_API_KEY = "test-key";
    dbMock.provider.findMany.mockResolvedValue([
      { id: "p1", legalFirstName: "A", legalLastName: "A", npi: "111" },
      { id: "p2", legalFirstName: "B", legalLastName: "B", npi: "222" },
    ]);
    dbMock.botRun.count.mockImplementation(async ({ where }: { where: { providerId: string } }) => {
      return where.providerId === "p1" ? 2 : 0;
    });
    dbMock.botRun.create.mockImplementation(async ({ data }) => ({
      ...(data as Record<string, unknown>),
      id: `br-${Math.random()}`,
    }));

    await runMonthlySanctionsCheck();

    expect(dbMock.botRun.create).toHaveBeenCalledTimes(2); // only p2 ran
    expect(mockQueueAdd).toHaveBeenCalledTimes(2);
    const providersEnqueued = addCalls.map((c) => (c.data as { providerId: string }).providerId);
    expect(new Set(providersEnqueued)).toEqual(new Set(["p2"]));
  });

  it("closes the BullMQ queue even if an error is thrown", async () => {
    process.env.SAM_GOV_API_KEY = "test-key";
    dbMock.provider.findMany.mockRejectedValue(new Error("db down"));
    await expect(runMonthlySanctionsCheck()).rejects.toThrow("db down");
    expect(mockQueueClose).toHaveBeenCalled();
  });
});
