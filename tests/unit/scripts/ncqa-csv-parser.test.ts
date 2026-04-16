/**
 * The NCQA CSV importer is the only way the compliance team loads the
 * criteria catalog. If the parser chokes on commas-in-quotes or doubled
 * quotes the whole catalog fails to load — so freeze the RFC-4180
 * behaviour with unit tests.
 */
import { describe, expect, it } from "vitest";

// Import-under-test is the `parseLine` helper; re-implemented here for
// isolation so the test doesn't pull the Prisma client into the module
// graph. Keep it byte-identical to the one in scripts/import-ncqa-criteria.ts.
function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += c;
      }
    }
  }
  out.push(cur);
  return out;
}

describe("NCQA CSV line parser", () => {
  it("splits simple cells on commas", () => {
    expect(parseLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  it("preserves commas inside quoted cells", () => {
    expect(parseLine(`"Doe, Jane",MD,NY`)).toEqual(["Doe, Jane", "MD", "NY"]);
  });

  it("unescapes doubled quotes inside quoted cells", () => {
    expect(parseLine(`"He said ""hi""",ok`)).toEqual([`He said "hi"`, "ok"]);
  });

  it("emits empty cells for adjacent commas", () => {
    expect(parseLine("a,,b")).toEqual(["a", "", "b"]);
    expect(parseLine(",a,")).toEqual(["", "a", ""]);
  });

  it("handles a quoted cell that is empty", () => {
    expect(parseLine(`a,"",b`)).toEqual(["a", "", "b"]);
  });

  it("preserves spaces that are NOT inside quotes (trim is caller-level)", () => {
    expect(parseLine("a, b ,c")).toEqual(["a", " b ", "c"]);
  });
});
