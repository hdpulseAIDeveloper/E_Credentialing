import { describe, expect, it } from "vitest";
import { renderManifest, type AuditorManifest } from "@/lib/auditor/manifest";

const sample: AuditorManifest = {
  generatedAt: "2026-04-18T12:00:00.000Z",
  packageFormatVersion: "1.0.0",
  organizationId: "org_essen",
  organizationName: "Essen Medical Services",
  summary: {
    auditLogRows: 10,
    auditChainOk: true,
    auditChainNullHashes: 0,
    ncqaSnapshotCount: 1,
    providerCount: 5,
    licenseCount: 7,
  },
  artifacts: [
    { path: "z-last.md", description: "z", digestSha256: "z", bytes: 1 },
    { path: "a-first.md", description: "a", digestSha256: "a", bytes: 1 },
    { path: "controls/CC6.1.md", description: "c", digestSha256: "c", bytes: 1 },
  ],
};

describe("renderManifest", () => {
  it("sorts artifacts by path for byte-stability", () => {
    const out = JSON.parse(renderManifest(sample)) as AuditorManifest;
    expect(out.artifacts.map((a) => a.path)).toEqual([
      "a-first.md",
      "controls/CC6.1.md",
      "z-last.md",
    ]);
  });

  it("ends with a trailing newline (POSIX)", () => {
    expect(renderManifest(sample).endsWith("\n")).toBe(true);
  });

  it("preserves summary + organization fields", () => {
    const out = JSON.parse(renderManifest(sample)) as AuditorManifest;
    expect(out.organizationId).toBe("org_essen");
    expect(out.summary.auditLogRows).toBe(10);
    expect(out.packageFormatVersion).toBe("1.0.0");
  });
});
