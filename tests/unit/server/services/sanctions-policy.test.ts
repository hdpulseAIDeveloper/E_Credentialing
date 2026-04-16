import { describe, expect, it } from "vitest";
import {
  isDueForRecheck,
  isFlagged,
  requiresReview,
  sanctionsCadenceDays,
  SANCTIONS_CADENCE_DAYS,
} from "@/server/services/sanctions-policy";

describe("SANCTIONS_CADENCE_DAYS", () => {
  it("OIG and SAM.gov are checked weekly (exceeds NCQA monthly minimum)", () => {
    expect(SANCTIONS_CADENCE_DAYS.OIG).toBe(7);
    expect(SANCTIONS_CADENCE_DAYS.SAM_GOV).toBe(7);
  });
});

describe("sanctionsCadenceDays", () => {
  it("returns the configured cadence", () => {
    expect(sanctionsCadenceDays("OIG")).toBe(7);
    expect(sanctionsCadenceDays("SAM_GOV")).toBe(7);
  });
});

describe("isFlagged", () => {
  it("is true only for FLAGGED", () => {
    expect(isFlagged("FLAGGED")).toBe(true);
    expect(isFlagged("CLEAR")).toBe(false);
  });
});

describe("requiresReview", () => {
  it("flags any FLAGGED sanctions result for human review", () => {
    expect(requiresReview("FLAGGED")).toBe(true);
    expect(requiresReview("CLEAR")).toBe(false);
  });
});

describe("isDueForRecheck", () => {
  const NOW = new Date("2026-04-16T12:00:00Z");
  const minus = (days: number) =>
    new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000);

  it("is due when never checked", () => {
    expect(isDueForRecheck("OIG", null, NOW)).toBe(true);
    expect(isDueForRecheck("SAM_GOV", undefined, NOW)).toBe(true);
  });

  it("is due once cadence has elapsed", () => {
    expect(isDueForRecheck("OIG", minus(7), NOW)).toBe(true);
    expect(isDueForRecheck("OIG", minus(8), NOW)).toBe(true);
  });

  it("is not due while within cadence window", () => {
    expect(isDueForRecheck("OIG", minus(6), NOW)).toBe(false);
    expect(isDueForRecheck("SAM_GOV", minus(5), NOW)).toBe(false);
  });
});
