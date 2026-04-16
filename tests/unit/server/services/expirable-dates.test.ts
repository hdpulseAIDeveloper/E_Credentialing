import { describe, expect, it } from "vitest";
import {
  bucketExpiration,
  computeNextCheckDate,
  defaultCadenceDays,
} from "@/server/services/expirable-dates";

const NOW = new Date("2026-04-16T12:00:00Z");

function addDays(d: Date, n: number): Date {
  const out = new Date(d.getTime());
  out.setDate(out.getDate() + n);
  return out;
}

describe("bucketExpiration", () => {
  it("classifies past dates as EXPIRED", () => {
    expect(bucketExpiration(addDays(NOW, -1), NOW)).toBe("EXPIRED");
    expect(bucketExpiration(addDays(NOW, -90), NOW)).toBe("EXPIRED");
  });

  it("classifies today and within 7 days as IN_7_DAYS", () => {
    expect(bucketExpiration(addDays(NOW, 0), NOW)).toBe("IN_7_DAYS");
    expect(bucketExpiration(addDays(NOW, 7), NOW)).toBe("IN_7_DAYS");
  });

  it("classifies 8-30 days as IN_30_DAYS", () => {
    expect(bucketExpiration(addDays(NOW, 8), NOW)).toBe("IN_30_DAYS");
    expect(bucketExpiration(addDays(NOW, 30), NOW)).toBe("IN_30_DAYS");
  });

  it("classifies 31-60 days as IN_60_DAYS", () => {
    expect(bucketExpiration(addDays(NOW, 31), NOW)).toBe("IN_60_DAYS");
    expect(bucketExpiration(addDays(NOW, 60), NOW)).toBe("IN_60_DAYS");
  });

  it("classifies 61-90 days as IN_90_DAYS", () => {
    expect(bucketExpiration(addDays(NOW, 61), NOW)).toBe("IN_90_DAYS");
    expect(bucketExpiration(addDays(NOW, 90), NOW)).toBe("IN_90_DAYS");
  });

  it("classifies > 90 days as LATER", () => {
    expect(bucketExpiration(addDays(NOW, 91), NOW)).toBe("LATER");
    expect(bucketExpiration(addDays(NOW, 365), NOW)).toBe("LATER");
  });
});

describe("defaultCadenceDays", () => {
  it("returns a multi-year cadence for state license + board certification", () => {
    expect(defaultCadenceDays("STATE_LICENSE")).toBe(365 * 2);
    expect(defaultCadenceDays("DEA")).toBe(365 * 3);
    expect(defaultCadenceDays("BOARD_CERTIFICATION")).toBe(365 * 10);
  });

  it("returns 365 for unknown types", () => {
    // @ts-expect-error — deliberately passing an unknown value to exercise default
    expect(defaultCadenceDays("NOT_A_TYPE")).toBe(365);
  });
});

describe("computeNextCheckDate", () => {
  it("reschedules daily when already past expiration", () => {
    const next = computeNextCheckDate(addDays(NOW, -5), NOW);
    expect(Math.round((next.getTime() - NOW.getTime()) / 86_400_000)).toBe(1);
  });

  it("reschedules every 3 days when within 30 days of expiration", () => {
    const next = computeNextCheckDate(addDays(NOW, 20), NOW);
    expect(Math.round((next.getTime() - NOW.getTime()) / 86_400_000)).toBe(3);
  });

  it("reschedules weekly when within 90 days of expiration", () => {
    const next = computeNextCheckDate(addDays(NOW, 60), NOW);
    expect(Math.round((next.getTime() - NOW.getTime()) / 86_400_000)).toBe(7);
  });

  it("reschedules monthly when more than 90 days out", () => {
    const next = computeNextCheckDate(addDays(NOW, 200), NOW);
    expect(Math.round((next.getTime() - NOW.getTime()) / 86_400_000)).toBe(30);
  });
});
