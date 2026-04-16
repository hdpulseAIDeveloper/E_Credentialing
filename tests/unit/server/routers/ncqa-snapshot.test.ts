/**
 * Snapshot scoring math for the NCQA router.
 *
 * The formula freezes how the Compliance dashboard trend is computed:
 *   overallScore = round(((compliant + 0.5*partial) / (total - NA)) * 100)
 *
 * Any change here is visible to auditors and must be documented in ADR 0012.
 */
import { describe, expect, it } from "vitest";

function score({
  compliant,
  partial,
  notApplicable,
  total,
}: {
  compliant: number;
  partial: number;
  notApplicable: number;
  total: number;
}): number {
  const denominator = total - notApplicable;
  if (denominator <= 0) return 0;
  return Math.round(((compliant + partial * 0.5) / denominator) * 100);
}

describe("NCQA snapshot scoring", () => {
  it("returns 100 when every applicable criterion is compliant", () => {
    expect(score({ compliant: 10, partial: 0, notApplicable: 0, total: 10 })).toBe(100);
  });

  it("returns 0 when no criteria are compliant or partial", () => {
    expect(score({ compliant: 0, partial: 0, notApplicable: 0, total: 10 })).toBe(0);
  });

  it("credits partial at half weight", () => {
    // 4 compliant + 2 partial out of 10 => (4 + 1) / 10 = 0.5 => 50
    expect(score({ compliant: 4, partial: 2, notApplicable: 0, total: 10 })).toBe(50);
  });

  it("excludes not-applicable criteria from the denominator", () => {
    // total 10, 4 NA => effective denom 6, compliant=3 => 50
    expect(score({ compliant: 3, partial: 0, notApplicable: 4, total: 10 })).toBe(50);
  });

  it("returns 0 when every criterion is not-applicable", () => {
    expect(score({ compliant: 0, partial: 0, notApplicable: 5, total: 5 })).toBe(0);
  });

  it("rounds half-values to nearest integer", () => {
    // 1 compliant + 1 partial out of 3 => 1.5 / 3 = 50 exactly, stable
    expect(score({ compliant: 1, partial: 1, notApplicable: 0, total: 3 })).toBe(50);
    // 2 compliant + 1 partial out of 4 => 2.5 / 4 = 62.5 => 63
    expect(score({ compliant: 2, partial: 1, notApplicable: 0, total: 4 })).toBe(63);
  });

  it("returns 0 on empty catalog without dividing by zero", () => {
    expect(score({ compliant: 0, partial: 0, notApplicable: 0, total: 0 })).toBe(0);
  });
});
