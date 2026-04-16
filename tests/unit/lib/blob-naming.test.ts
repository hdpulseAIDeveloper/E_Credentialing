/**
 * Blob-naming contract tests.
 *
 * PSV bot output filenames are preserved verbatim from the legacy
 * K: drive convention (see CLAUDE.md). If these change, historical
 * bot output folders disagree with what the Compliance team expects
 * during an NCQA audit. Treat these tests as change-control.
 */
import { describe, expect, it } from "vitest";
import {
  boardVerificationFilename,
  botRunLogPath,
  committeeAgendaBlobPath,
  committeeSummaryBlobPath,
  deaVerificationFilename,
  documentBlobPath,
  enrollmentRosterBlobPath,
  licenseVerificationFilename,
  npdbQueryFilename,
  oigSanctionsFilename,
  samSanctionsFilename,
  verificationBlobPath,
} from "@/lib/blob-naming";

// Use timezone-neutral dates (noon UTC) so the MM.dd.yyyy formatter is
// deterministic regardless of the CI machine's timezone.
const date = (iso: string) => new Date(`${iso}T12:00:00Z`);

describe("PSV bot filename conventions", () => {
  it("formats the license verification filename exactly like the K: drive", () => {
    expect(
      licenseVerificationFilename("NY", date("2027-03-31")),
    ).toBe("NY License Verification, Exp. 03.31.2027");
  });

  it("formats the DEA verification filename", () => {
    expect(deaVerificationFilename(date("2026-06-30"))).toBe(
      "DEA Verification, Exp. 06.30.2026",
    );
  });

  it("formats the board verification filename", () => {
    expect(boardVerificationFilename("NCCPA", date("2027-12-31"))).toBe(
      "Boards Verification NCCPA exp 12.31.2027",
    );
  });

  it("formats OIG and SAM sanctions filenames", () => {
    expect(oigSanctionsFilename(date("2026-04-14"))).toBe(
      "OIG Sanctions Check 04.14.2026",
    );
    expect(samSanctionsFilename(date("2026-04-14"))).toBe(
      "SAM Sanctions Check 04.14.2026",
    );
  });

  it("formats NPDB query filename", () => {
    expect(npdbQueryFilename(date("2026-04-14"))).toBe("NPDB Query 04.14.2026");
  });
});

describe("blob path conventions", () => {
  it("places a verification PDF under providers/{id}/verifications/", () => {
    expect(
      verificationBlobPath("prov-1", "NY License Verification, Exp. 03.31.2027"),
    ).toBe(
      "providers/prov-1/verifications/NY License Verification, Exp. 03.31.2027.pdf",
    );
  });

  it("derives the document extension from the original filename", () => {
    expect(documentBlobPath("prov-1", "doc-1", "resume.pdf")).toBe(
      "providers/prov-1/documents/doc-1.pdf",
    );
    expect(documentBlobPath("prov-1", "doc-2", "scan.PNG")).toBe(
      "providers/prov-1/documents/doc-2.PNG",
    );
  });

  it("defaults the extension to pdf when the filename has no dot", () => {
    expect(documentBlobPath("prov-1", "doc-3", "untitled")).toBe(
      "providers/prov-1/documents/doc-3.pdf",
    );
  });

  it("scopes bot run logs per provider and run id", () => {
    expect(botRunLogPath("prov-1", "run-42")).toBe(
      "providers/prov-1/verifications/bot-logs/run-42.log",
    );
  });

  it("versions committee summary and agenda PDFs", () => {
    expect(committeeSummaryBlobPath("prov-1", "s-1", 2)).toBe(
      "providers/prov-1/summaries/committee_summary_s-1_v2.pdf",
    );
    expect(committeeAgendaBlobPath("s-1", 3)).toBe(
      "providers/committee/agenda_s-1_v3.pdf",
    );
  });

  it("scopes enrollment roster files per enrollment", () => {
    expect(enrollmentRosterBlobPath("enr-1", "roster.csv")).toBe(
      "enrollments/enr-1/roster.csv",
    );
  });
});
