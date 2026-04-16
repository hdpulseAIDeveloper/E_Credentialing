/**
 * Contract tests for the CSV escaping logic used by every export
 * endpoint in the report router. Any regression here produces
 * malformed CSVs that Excel / Google Sheets will misinterpret
 * (data bleeding across columns, broken dates, etc.).
 */
import { describe, expect, it } from "vitest";

// Mirror of the helper at src/server/api/routers/report.ts. We don't
// import directly because the router pulls Prisma client into the
// module graph; these are pure-function tests.
function escape(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

function toCsv(headers: string[], rows: string[][]): string {
  return [headers.map(escape).join(","), ...rows.map(r => r.map(escape).join(","))].join("\n");
}

describe("report CSV escaping", () => {
  it("wraps every field in double quotes", () => {
    const out = toCsv(["A", "B"], [["x", "y"]]);
    expect(out).toBe(`"A","B"\n"x","y"`);
  });

  it("doubles embedded quotes per RFC 4180", () => {
    const out = toCsv(["name"], [[`He said "hi"`]]);
    expect(out).toBe(`"name"\n"He said ""hi"""`);
  });

  it("preserves commas inside fields without splitting columns", () => {
    const out = toCsv(["name"], [[`Doe, Jane`]]);
    expect(out).toBe(`"name"\n"Doe, Jane"`);
  });

  it("preserves newlines inside fields (valid per RFC 4180)", () => {
    const out = toCsv(["addr"], [[`123 Main\nApt 4`]]);
    expect(out).toBe(`"addr"\n"123 Main\nApt 4"`);
  });

  it("handles empty rows and headers", () => {
    expect(toCsv([], [])).toBe("");
    expect(toCsv(["A"], [])).toBe(`"A"`);
    expect(toCsv(["A"], [[""]])).toBe(`"A"\n""`);
  });

  it("separates rows with a single \\n (not CRLF)", () => {
    const out = toCsv(["A"], [["x"], ["y"]]);
    expect(out.split("\n")).toEqual([`"A"`, `"x"`, `"y"`]);
  });
});
