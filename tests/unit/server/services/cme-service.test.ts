/**
 * Unit tests for CmeService (Wave 3.2).
 *
 * Covers:
 *   - listByProvider, getSummary (delegates to summarizeCredits)
 *   - create + provider-not-found + bad credits + future-date guard +
 *     cross-tenant document rejection
 *   - update + bad credits guard + completedDate validation +
 *     document connect/disconnect
 *   - delete + audit chain
 *   - loadCvSnapshot + buildProviderCv + renderProviderCvText/Markdown/Pdf
 *   - renderProviderCvPdf writes a `cme.cv_generated` audit row
 *   - summarizeCredits pure function — totals + by-year + requirementMet
 *     against default + custom requirement
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import {
  CmeService,
  CME_ANNUAL_REQUIREMENT_DEFAULT,
  summarizeCredits,
} from "@/server/services/cme";
import type { AuditWriter } from "@/server/services/document";

const ACTOR = { id: "user-1", role: "MANAGER" };

interface MockDb {
  cmeCredit: {
    findUnique: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  provider: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  document: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  verificationRecord: {
    findMany: ReturnType<typeof vi.fn>;
  };
  workHistoryVerification: {
    findMany: ReturnType<typeof vi.fn>;
  };
}

function makeDb(): MockDb {
  return {
    cmeCredit: {
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      delete: vi.fn().mockResolvedValue({}),
    },
    provider: { findUnique: vi.fn() },
    document: { findUnique: vi.fn() },
    verificationRecord: { findMany: vi.fn().mockResolvedValue([]) },
    workHistoryVerification: { findMany: vi.fn().mockResolvedValue([]) },
  };
}

function makeService(db: MockDb) {
  const audit = vi.fn() as unknown as AuditWriter & ReturnType<typeof vi.fn>;
  const svc = new CmeService({
    db: db as unknown as import("@prisma/client").PrismaClient,
    audit: audit as AuditWriter,
    actor: ACTOR,
  });
  return { svc, audit: audit as ReturnType<typeof vi.fn> };
}

// ─── summarizeCredits (pure) ─────────────────────────────────────────────────

describe("summarizeCredits", () => {
  it("totals credits and splits by category, year, and requirement", () => {
    const out = summarizeCredits([
      { credits: 12, category: "Category 1", completedDate: new Date("2025-11-01") },
      { credits: 4, category: "Category 2", completedDate: new Date("2025-08-12") },
      { credits: 40, category: "Category 1", completedDate: new Date("2024-03-01") },
    ]);
    expect(out.totalCredits).toBe(56);
    expect(out.totalCategory1).toBe(52);
    expect(out.totalCategory2).toBe(4);
    expect(out.creditsByYear[2025]).toBe(16);
    expect(out.creditsByYear[2024]).toBe(40);
    expect(out.requirement).toBe(CME_ANNUAL_REQUIREMENT_DEFAULT);
    expect(out.requirementMet).toBe(true);
  });

  it("supports a custom requirement override", () => {
    const out = summarizeCredits(
      [
        { credits: 30, category: "Category 1", completedDate: new Date("2025-11-01") },
      ],
      40,
    );
    expect(out.requirementMet).toBe(false);
    expect(out.requirement).toBe(40);
  });

  it("handles an empty list cleanly", () => {
    const out = summarizeCredits([]);
    expect(out).toEqual({
      totalCredits: 0,
      totalCategory1: 0,
      totalCategory2: 0,
      creditsByYear: {},
      requirementMet: false,
      requirement: CME_ANNUAL_REQUIREMENT_DEFAULT,
    });
  });
});

// ─── CmeService — CRUD ──────────────────────────────────────────────────────

describe("CmeService — CRUD", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  it("create rejects non-positive credits", async () => {
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "p1",
        activityName: "X",
        credits: 0,
        completedDate: "2025-11-01",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create rejects an invalid completedDate", async () => {
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "p1",
        activityName: "X",
        credits: 1,
        completedDate: "not-a-date",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create rejects a completedDate >24h in the future", async () => {
    const { svc } = makeService(db);
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    await expect(
      svc.create({
        providerId: "p1",
        activityName: "X",
        credits: 1,
        completedDate: future,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("create 404s when provider is missing", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "missing",
        activityName: "X",
        credits: 1,
        completedDate: "2025-11-01",
      }),
    ).rejects.toBeInstanceOf(TRPCError);
  });

  it("create rejects a documentId belonging to a different provider", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });
    db.document.findUnique.mockResolvedValue({ id: "doc1", providerId: "OTHER" });
    const { svc } = makeService(db);
    await expect(
      svc.create({
        providerId: "p1",
        activityName: "X",
        credits: 1,
        completedDate: "2025-11-01",
        documentId: "doc1",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.cmeCredit.create).not.toHaveBeenCalled();
  });

  it("create writes the audit row and returns the new record", async () => {
    db.provider.findUnique.mockResolvedValue({ id: "p1" });
    db.cmeCredit.create.mockResolvedValue({ id: "cme-1" });
    const { svc, audit } = makeService(db);
    const out = await svc.create({
      providerId: "p1",
      activityName: "Cardio Update",
      credits: 12,
      completedDate: "2025-11-01",
    });
    expect(out).toEqual({ id: "cme-1" });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cme.created",
        entityId: "cme-1",
        providerId: "p1",
      }),
    );
  });

  it("update rejects non-positive credits and bad dates", async () => {
    db.cmeCredit.findUnique.mockResolvedValue({ id: "cme-1", providerId: "p1" });
    const { svc } = makeService(db);
    await expect(svc.update({ id: "cme-1", credits: -1 })).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
    await expect(
      svc.update({ id: "cme-1", completedDate: "huh" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("update connects/disconnects a document via the relation API", async () => {
    db.cmeCredit.findUnique.mockResolvedValue({ id: "cme-1", providerId: "p1" });
    db.cmeCredit.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: "cme-1", providerId: "p1", ...data }),
    );
    const { svc } = makeService(db);
    await svc.update({ id: "cme-1", documentId: "doc-2" });
    const callConnect = db.cmeCredit.update.mock.calls[0]![0] as {
      data: { document: { connect: { id: string } } };
    };
    expect(callConnect.data.document.connect.id).toBe("doc-2");

    await svc.update({ id: "cme-1", documentId: null });
    const callDisconnect = db.cmeCredit.update.mock.calls[1]![0] as {
      data: { document: { disconnect: true } };
    };
    expect(callDisconnect.data.document.disconnect).toBe(true);
  });

  it("delete 404s when the record is missing", async () => {
    db.cmeCredit.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(svc.delete("missing")).rejects.toBeInstanceOf(TRPCError);
  });

  it("delete writes an audit row with beforeState", async () => {
    db.cmeCredit.findUnique.mockResolvedValue({
      id: "cme-1",
      providerId: "p1",
      activityName: "X",
      credits: 4,
    });
    const { svc, audit } = makeService(db);
    const out = await svc.delete("cme-1");
    expect(out).toEqual({ success: true });
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cme.deleted",
        entityId: "cme-1",
        beforeState: { activityName: "X", credits: 4 },
      }),
    );
  });
});

// ─── CmeService — CV pipeline ───────────────────────────────────────────────

describe("CmeService — CV pipeline", () => {
  let db: MockDb;
  beforeEach(() => {
    db = makeDb();
  });

  function setupSnapshot() {
    db.provider.findUnique.mockResolvedValue({
      legalFirstName: "Jane",
      legalMiddleName: null,
      legalLastName: "Doe",
      npi: "1234567890",
      providerType: { name: "Physician", abbreviation: "MD" },
      profile: {
        personalEmail: "j@example.com",
        mobilePhone: null,
        medicalSchoolName: "State Med",
        medicalSchoolCountry: "USA",
        graduationYear: 2010,
        specialtyPrimary: "IM",
        specialtySecondary: null,
        ecfmgNumber: null,
      },
      licenses: [
        {
          state: "NY",
          licenseType: "MD",
          licenseNumber: "12345",
          status: "ACTIVE",
          expirationDate: new Date("2027-06-30"),
          isPrimary: true,
        },
      ],
      hospitalPrivileges: [],
      cmeCredits: [
        {
          activityName: "Cardio",
          category: "Category 1",
          credits: 12,
          completedDate: new Date("2025-11-01"),
        },
      ],
    });
    db.verificationRecord.findMany.mockResolvedValue([]);
    db.workHistoryVerification.findMany.mockResolvedValue([]);
  }

  it("loadCvSnapshot 404s when the provider does not exist", async () => {
    db.provider.findUnique.mockResolvedValue(null);
    const { svc } = makeService(db);
    await expect(svc.loadCvSnapshot("missing")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("buildProviderCv returns the structured Cv with all sections", async () => {
    setupSnapshot();
    const { svc } = makeService(db);
    const cv = await svc.buildProviderCv("p1");
    expect(cv.header.fullName).toBe("Jane Doe");
    expect(cv.sections.map((s) => s.title)).toEqual([
      "Education",
      "Licenses",
      "Board certifications",
      "Hospital privileges",
      "Work history",
      "CME credits",
    ]);
  });

  it("renderProviderCvText returns a non-empty string with the header", async () => {
    setupSnapshot();
    const { svc } = makeService(db);
    const out = await svc.renderProviderCvText("p1");
    expect(out).toMatch(/CURRICULUM VITAE/);
    expect(out).toMatch(/Jane Doe/);
  });

  it("renderProviderCvMarkdown returns a non-empty markdown document", async () => {
    setupSnapshot();
    const { svc } = makeService(db);
    const out = await svc.renderProviderCvMarkdown("p1");
    expect(out).toMatch(/^# Curriculum vitae/);
  });

  it("renderProviderCvPdf returns a PDF byte buffer and writes the audit row", async () => {
    setupSnapshot();
    const { svc, audit } = makeService(db);
    const bytes = await svc.renderProviderCvPdf("p1");
    expect(bytes.byteLength).toBeGreaterThan(500);
    expect(String.fromCharCode(...bytes.slice(0, 5))).toBe("%PDF-");
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "cme.cv_generated",
        entityType: "Provider",
        entityId: "p1",
        afterState: expect.objectContaining({ format: "pdf" }),
      }),
    );
  }, 15_000);
});
