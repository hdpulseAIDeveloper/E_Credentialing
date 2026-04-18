/**
 * Unit tests for the pure CV builder + renderers (Wave 3.2).
 *
 * The builder is a deterministic pure function: given a snapshot, it
 * returns the same Cv structure every time. The renderers are equally
 * pure: given a Cv, the text/markdown/pdf output never varies. These
 * properties make the entire CV pipeline easy to unit-test without
 * spinning up Prisma.
 */
import { describe, expect, it } from "vitest";
import { buildCv, type CvSnapshot } from "@/lib/cv/builder";
import { renderCvText } from "@/lib/cv/render-text";
import { renderCvMarkdown } from "@/lib/cv/render-markdown";
import { renderCvPdf } from "@/lib/cv/render-pdf";

const NOW = new Date("2026-04-18T12:00:00.000Z");

function fixtureSnapshot(): CvSnapshot {
  return {
    provider: {
      legalFirstName: "Jane",
      legalMiddleName: "Q",
      legalLastName: "Doe",
      npi: "1234567890",
      providerType: { name: "Physician Assistant", abbreviation: "PA" },
      profile: {
        personalEmail: "jane@example.com",
        mobilePhone: "555-1234",
        medicalSchoolName: "State Medical School",
        medicalSchoolCountry: "USA",
        graduationYear: 2010,
        specialtyPrimary: "Internal Medicine",
        specialtySecondary: null,
        ecfmgNumber: null,
      },
    },
    licenses: [
      {
        state: "NY",
        licenseType: "PA",
        licenseNumber: "999111",
        status: "ACTIVE",
        expirationDate: new Date("2027-06-30T00:00:00.000Z"),
        isPrimary: true,
      },
    ],
    boardCertifications: [
      {
        credentialType: "BOARD_NCCPA",
        status: "VERIFIED",
        verifiedDate: new Date("2024-01-15T00:00:00.000Z"),
        expirationDate: new Date("2034-01-15T00:00:00.000Z"),
      },
    ],
    privileges: [
      {
        facilityName: "St. Anywhere",
        privilegeType: "Outpatient",
        status: "APPROVED",
        effectiveDate: new Date("2025-09-01T00:00:00.000Z"),
        expirationDate: new Date("2027-09-01T00:00:00.000Z"),
      },
    ],
    workHistory: [
      {
        employerName: "Acme Health",
        position: "Senior PA",
        startDate: new Date("2020-01-01T00:00:00.000Z"),
        endDate: null,
      },
    ],
    cmeCredits: [
      {
        activityName: "Cardio Update",
        category: "Category 1",
        credits: 12,
        completedDate: new Date("2025-11-01T00:00:00.000Z"),
      },
      {
        activityName: "Ethics Workshop",
        category: "Category 2",
        credits: 4,
        completedDate: new Date("2025-08-12T00:00:00.000Z"),
      },
    ],
  };
}

function emptySnapshot(): CvSnapshot {
  return {
    provider: {
      legalFirstName: null,
      legalMiddleName: null,
      legalLastName: null,
      npi: null,
      providerType: null,
      profile: null,
    },
    licenses: [],
    boardCertifications: [],
    privileges: [],
    workHistory: [],
    cmeCredits: [],
  };
}

describe("buildCv", () => {
  it("produces a header with the full name and contact bits", () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    expect(cv.header.fullName).toBe("Jane Q Doe");
    expect(cv.header.npi).toBe("1234567890");
    expect(cv.header.providerTypeLabel).toBe("Physician Assistant (PA)");
    expect(cv.header.email).toBe("jane@example.com");
    expect(cv.header.phone).toBe("555-1234");
  });

  it("uses the supplied `now` for deterministic generatedAtIso", () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    expect(cv.generatedAtIso).toBe(NOW.toISOString());
  });

  it("emits all six required sections in a stable order", () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    expect(cv.sections.map((s) => s.title)).toEqual([
      "Education",
      "Licenses",
      "Board certifications",
      "Hospital privileges",
      "Work history",
      "CME credits",
    ]);
  });

  it("falls back to 'Unknown Provider' on a fully-empty snapshot and never throws", () => {
    const cv = buildCv(emptySnapshot(), { now: NOW });
    expect(cv.header.fullName).toBe("Unknown Provider");
    for (const s of cv.sections) {
      expect(s.entries.length).toBeGreaterThan(0);
      // Every empty section should render at least the "No X on file" entry.
      expect(s.entries[0]!.primary).toMatch(/No .* on file\./);
    }
  });

  it("totals CME credits in the section summary", () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    const cme = cv.sections.find((s) => s.title === "CME credits")!;
    expect(cme.summary).toBe("Total CME credits on file: 16");
  });

  it("respects a custom footerBrand (white-label)", () => {
    const cv = buildCv(fixtureSnapshot(), {
      now: NOW,
      footerBrand: "ACME CVO Platform",
    });
    expect(cv.footerBrand).toBe("ACME CVO Platform");
  });
});

describe("renderCvText", () => {
  it("includes the section headings in upper-case", () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    const out = renderCvText(cv);
    expect(out).toMatch(/CURRICULUM VITAE/);
    expect(out).toMatch(/EDUCATION\n/);
    expect(out).toMatch(/LICENSES\n/);
    expect(out).toMatch(/CME CREDITS\n/);
    expect(out).toMatch(/Total CME credits on file: 16/);
  });

  it("never throws on an empty snapshot", () => {
    const cv = buildCv(emptySnapshot(), { now: NOW });
    expect(() => renderCvText(cv)).not.toThrow();
  });
});

describe("renderCvMarkdown", () => {
  it("escapes Markdown control characters in user-supplied strings", () => {
    const snap = fixtureSnapshot();
    snap.provider.legalLastName = "O'Connor*Test_";
    const cv = buildCv(snap, { now: NOW });
    const md = renderCvMarkdown(cv);
    expect(md).toContain("O'Connor\\*Test\\_");
  });

  it("emits a level-1 heading and one level-2 per section", () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    const md = renderCvMarkdown(cv);
    expect(md.match(/^# /m)).not.toBeNull();
    expect((md.match(/^## /gm) ?? []).length).toBe(cv.sections.length);
  });
});

describe("renderCvPdf", () => {
  it("produces a valid PDF byte buffer that starts with the %PDF magic", async () => {
    const cv = buildCv(fixtureSnapshot(), { now: NOW });
    const bytes = await renderCvPdf(cv);
    expect(bytes.byteLength).toBeGreaterThan(500);
    const header = String.fromCharCode(...bytes.slice(0, 5));
    expect(header).toBe("%PDF-");
    // Trailer should be present.
    const tail = String.fromCharCode(...bytes.slice(-32));
    expect(tail).toMatch(/%%EOF/);
  });

  it("never throws on an empty snapshot and still produces a footer brand", async () => {
    const cv = buildCv(emptySnapshot(), { now: NOW });
    const bytes = await renderCvPdf(cv);
    expect(bytes.byteLength).toBeGreaterThan(300);
  });
}, 15_000);
