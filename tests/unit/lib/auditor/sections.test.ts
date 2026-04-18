import { describe, expect, it } from "vitest";
import {
  renderAuditLogCsv,
  renderCoverSheet,
  renderNcqaSnapshotsCsv,
} from "@/lib/auditor/sections";

describe("renderAuditLogCsv", () => {
  it("renders a header row even when empty", () => {
    const csv = renderAuditLogCsv([]);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(
      "sequence,timestamp,actorId,actorRole,action,entityType,entityId,providerId,previousHash,hash",
    );
  });

  it("renders rows with ISO timestamps and sequence numbers", () => {
    const csv = renderAuditLogCsv([
      {
        id: "log-1",
        sequence: 42,
        timestamp: new Date("2026-04-18T10:00:00Z"),
        actorId: "u1",
        actorRole: "ADMIN",
        action: "provider.created",
        entityType: "Provider",
        entityId: "p1",
        providerId: "p1",
        previousHash: "abc",
        hash: "def",
      },
    ]);
    const second = csv.trim().split("\n")[1];
    expect(second).toBe(
      "42,2026-04-18T10:00:00.000Z,u1,ADMIN,provider.created,Provider,p1,p1,abc,def",
    );
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = renderAuditLogCsv([
      {
        id: "log-1",
        sequence: BigInt(1),
        timestamp: new Date("2026-04-18T10:00:00Z"),
        actorId: "u,1",
        actorRole: 'role"with"quote',
        action: "weird\naction",
        entityType: "X",
        entityId: "y",
        providerId: null,
        previousHash: null,
        hash: null,
      },
    ]);
    expect(csv).toContain('"u,1"');
    expect(csv).toContain('"role""with""quote"');
    expect(csv).toContain('"weird\naction"');
  });
});

describe("renderNcqaSnapshotsCsv", () => {
  it("renders header + rows", () => {
    const csv = renderNcqaSnapshotsCsv([
      {
        id: "snap-1",
        takenAt: new Date("2026-01-01T00:00:00Z"),
        totalCriteria: 13,
        compliantCount: 10,
        partialCount: 2,
        nonCompliantCount: 0,
        notApplicableCount: 1,
        overallScore: 92,
      },
    ]);
    expect(csv.trim().split("\n")[0]).toBe(
      "takenAt,overallScore,totalCriteria,compliantCount,partialCount,nonCompliantCount,notApplicableCount",
    );
    expect(csv.trim().split("\n")[1]).toBe(
      "2026-01-01T00:00:00.000Z,92,13,10,2,0,1",
    );
  });
});

describe("renderCoverSheet", () => {
  it("includes the org name, audit chain status, and reporting period", () => {
    const md = renderCoverSheet({
      organizationName: "Essen Medical Services",
      organizationId: "org_essen",
      generatedAtIso: "2026-04-18T12:00:00.000Z",
      reportPeriod: {
        fromIso: "2026-01-01T00:00:00.000Z",
        toIso: "2026-04-18T12:00:00.000Z",
      },
      auditChainOk: true,
      auditChainNullHashes: 3,
      auditLogRows: 1234,
      ncqaSnapshotCount: 4,
      providerCount: 87,
      licenseCount: 142,
    });
    expect(md).toContain("Essen Medical Services");
    expect(md).toContain("org_essen");
    expect(md).toContain("Audit chain verified");
    expect(md).toContain("1,234");
    expect(md).toContain("2026-01-01T00:00:00.000Z");
  });

  it("flags audit chain failures explicitly", () => {
    const md = renderCoverSheet({
      organizationName: "Org",
      organizationId: "o",
      generatedAtIso: "2026-04-18T12:00:00.000Z",
      auditChainOk: false,
      auditChainNullHashes: 0,
      auditLogRows: 1,
      ncqaSnapshotCount: 0,
      providerCount: 0,
      licenseCount: 0,
    });
    expect(md).toContain("INTEGRITY FAILURE");
  });
});
