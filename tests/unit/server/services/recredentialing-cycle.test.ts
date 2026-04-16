import { describe, expect, it } from "vitest";
import {
  nextRecredentialingDueDate,
  recredentialingUrgency,
  RECREDENTIALING_CYCLE_MONTHS,
} from "@/server/services/recredentialing-cycle";

describe("nextRecredentialingDueDate", () => {
  it("adds exactly 36 months to the approval date", () => {
    expect(RECREDENTIALING_CYCLE_MONTHS).toBe(36);
    const approval = new Date("2024-01-15T00:00:00Z");
    const due = nextRecredentialingDueDate(approval);
    expect(due?.toISOString()).toBe("2027-01-15T00:00:00.000Z");
  });

  it("returns null when the provider has never been approved", () => {
    expect(nextRecredentialingDueDate(null)).toBeNull();
    expect(nextRecredentialingDueDate(undefined)).toBeNull();
  });

  it("rolls forward across month-end correctly (Feb 29 edge case)", () => {
    // Approving on a leap day moves to the same calendar day 3 years later,
    // which is March 1 on the next non-leap year.
    const leap = new Date("2024-02-29T00:00:00Z");
    const due = nextRecredentialingDueDate(leap);
    expect(due).not.toBeNull();
    expect(due!.getUTCFullYear()).toBe(2027);
    // JS Date rolls Feb 29 + 36 months into March 1 — this is intentional
    // and mirrors what the DB + dashboard display.
    expect(due!.getUTCMonth()).toBe(2); // March (0-indexed)
    expect(due!.getUTCDate()).toBe(1);
  });
});

describe("recredentialingUrgency", () => {
  const NOW = new Date("2026-04-16T12:00:00Z");
  const addDays = (d: Date, n: number) => {
    const out = new Date(d.getTime());
    out.setDate(out.getDate() + n);
    return out;
  };

  it("flags past-due cycles as OVERDUE", () => {
    expect(recredentialingUrgency(addDays(NOW, -1), NOW)).toBe("OVERDUE");
    expect(recredentialingUrgency(addDays(NOW, -100), NOW)).toBe("OVERDUE");
  });

  it("labels within 30 days as DUE_SOON_30", () => {
    expect(recredentialingUrgency(addDays(NOW, 1), NOW)).toBe("DUE_SOON_30");
    expect(recredentialingUrgency(addDays(NOW, 30), NOW)).toBe("DUE_SOON_30");
  });

  it("labels 31-60 days as DUE_SOON_60", () => {
    expect(recredentialingUrgency(addDays(NOW, 31), NOW)).toBe("DUE_SOON_60");
    expect(recredentialingUrgency(addDays(NOW, 60), NOW)).toBe("DUE_SOON_60");
  });

  it("labels 61-90 days as DUE_SOON_90", () => {
    expect(recredentialingUrgency(addDays(NOW, 61), NOW)).toBe("DUE_SOON_90");
    expect(recredentialingUrgency(addDays(NOW, 90), NOW)).toBe("DUE_SOON_90");
  });

  it("labels > 90 days as NOT_DUE", () => {
    expect(recredentialingUrgency(addDays(NOW, 91), NOW)).toBe("NOT_DUE");
    expect(recredentialingUrgency(addDays(NOW, 365), NOW)).toBe("NOT_DUE");
  });
});
