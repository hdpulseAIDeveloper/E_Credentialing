/**
 * Unit tests for RosterService (Wave 2.1) and the pure CSV helpers.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { RosterService, csvEscape, toCsv } from "@/server/services/roster";
import type { AuditWriter } from "@/server/services/document";

const ACTOR = { id: "actor-1", role: "MANAGER" };

interface MockDb {
  payerRoster: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  rosterSubmission: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
  };
  enrollment: { findMany: ReturnType<typeof vi.fn> };
}

function makeDb(): MockDb {
  return {
    payerRoster: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    rosterSubmission: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      deleteMany: vi.fn().mockResolvedValue({}),
    },
    enrollment: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService(db: MockDb) {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new RosterService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

describe("RosterService CSV helpers", () => {
  it("csvEscape doubles embedded quotes per RFC 4180", () => {
    expect(csvEscape('She said "hi"')).toBe('"She said ""hi"""');
  });

  it("toCsv joins headers and rows with the right separator", () => {
    expect(toCsv(["a", "b"], [["1", "2"], ["3", "4"]])).toBe(
      `"a","b"\n"1","2"\n"3","4"`,
    );
  });
});

describe("RosterService", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("getRoster 404s on missing", async () => {
    db.payerRoster.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(svc.getRoster("missing")).rejects.toBeInstanceOf(TRPCError);
  });

  it("createRoster persists defaults and audits", async () => {
    db.payerRoster.create.mockResolvedValue({ id: "r1", payerName: "Aetna" });
    const { svc, audit } = makeService(db);
    await svc.createRoster({ payerName: "Aetna" });
    expect(db.payerRoster.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ payerName: "Aetna", rosterFormat: "csv" }),
      }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({ action: "roster.created" });
  });

  it("generateSubmission returns CSV + submissionId + provider count", async () => {
    db.payerRoster.findUnique.mockResolvedValue({ id: "r1", payerName: "Aetna" });
    db.enrollment.findMany.mockResolvedValue([
      {
        provider: {
          legalLastName: "Doe",
          legalFirstName: "Jane",
          npi: "1234567890",
          dateOfBirth: "1980-01-01",
          profile: { specialtyPrimary: "Cardiology" },
        },
        effectiveDate: new Date("2025-01-15T00:00:00Z"),
      },
    ]);
    db.rosterSubmission.create.mockResolvedValue({ id: "sub-1" });
    const { svc } = makeService(db);

    const r = await svc.generateSubmission("r1");
    expect(r.providerCount).toBe(1);
    expect(r.submissionId).toBe("sub-1");
    expect(r.csv.split("\n")).toHaveLength(2);
    expect(r.csv).toContain("Doe");
    expect(r.csv).toContain("2025-01-15");
  });

  it("validateSubmission flags rows missing NPI or effective date", async () => {
    db.rosterSubmission.findUnique.mockResolvedValue({
      id: "sub-1",
      roster: { payerName: "Aetna" },
    });
    db.enrollment.findMany.mockResolvedValue([
      {
        provider: { id: "p1", legalLastName: "A", legalFirstName: "X", npi: null },
        effectiveDate: new Date(),
      },
      {
        provider: { id: "p2", legalLastName: "B", legalFirstName: "Y", npi: "1" },
        effectiveDate: null,
      },
    ]);
    const { svc } = makeService(db);

    const r = await svc.validateSubmission("sub-1");
    expect(r.valid).toBe(false);
    expect(r.status).toBe("ERROR");
    expect(r.errors).toEqual([
      { providerId: "p1", providerName: "A, X", issue: "Missing NPI" },
      { providerId: "p2", providerName: "B, Y", issue: "Missing effective date" },
    ]);
  });

  it("validateSubmission returns VALIDATED when every row is clean", async () => {
    db.rosterSubmission.findUnique.mockResolvedValue({
      id: "sub-1",
      roster: { payerName: "Aetna" },
    });
    db.enrollment.findMany.mockResolvedValue([
      {
        provider: { id: "p1", legalLastName: "A", legalFirstName: "X", npi: "1234567890" },
        effectiveDate: new Date(),
      },
    ]);
    const { svc } = makeService(db);
    const r = await svc.validateSubmission("sub-1");
    expect(r.valid).toBe(true);
    expect(r.status).toBe("VALIDATED");
    expect(r.errors).toHaveLength(0);
  });

  it("submitRoster stamps submittedBy + lastSubmittedAt and audits", async () => {
    db.rosterSubmission.findUnique.mockResolvedValue({
      id: "sub-1",
      rosterId: "r1",
      providerCount: 5,
    });
    const { svc, audit } = makeService(db);
    await svc.submitRoster("sub-1", "Sent via SFTP");
    expect(db.rosterSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "SUBMITTED",
          submittedBy: "actor-1",
          notes: "Sent via SFTP",
        }),
      }),
    );
    expect(db.payerRoster.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" } }),
    );
    expect(audit.mock.calls[0]?.[0]).toMatchObject({ action: "roster.submitted" });
  });

  it("deleteRoster cascades submissions and audits", async () => {
    db.payerRoster.findUnique.mockResolvedValue({
      id: "r1",
      payerName: "Aetna",
      submissions: [{ id: "s1" }, { id: "s2" }],
    });
    const { svc, audit } = makeService(db);
    await svc.deleteRoster("r1");
    expect(db.rosterSubmission.deleteMany).toHaveBeenCalledWith({ where: { rosterId: "r1" } });
    expect(db.payerRoster.delete).toHaveBeenCalledWith({ where: { id: "r1" } });
    expect(audit.mock.calls[0]?.[0]).toMatchObject({
      action: "roster.deleted",
      beforeState: { payerName: "Aetna", submissionCount: 2 },
    });
  });
});
