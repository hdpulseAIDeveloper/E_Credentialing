import { describe, expect, it } from "vitest";
import {
  countByCategory,
  extractTitle,
  parseChangelog,
} from "@/lib/changelog/parser";

const SAMPLE = `# Public changelog

## 2026-04-18 — v1.5.0

### Added
- **Big new feature.** Description here.
- **Another feature.** With more text.

### Security
- **Hardening.** Tightened CSP.

## 2026-04-15 — v1.4.0

### Improved
- **FHIR R4 directory.** Faster.

### Other things we tried
- **Internal cleanup.** Should land under "Other".
`;

describe("parseChangelog", () => {
  it("extracts releases in source order with date and version", () => {
    const releases = parseChangelog(SAMPLE);
    expect(releases.map((r) => r.version)).toEqual(["1.5.0", "1.4.0"]);
    expect(releases[0]!.date).toBe("2026-04-18");
    expect(releases[0]!.slug).toBe("v1.5.0");
  });

  it("groups bullets under their section", () => {
    const releases = parseChangelog(SAMPLE);
    const r150 = releases[0]!;
    expect(r150.groups.Added).toHaveLength(2);
    expect(r150.groups.Security).toHaveLength(1);
  });

  it("falls back to 'Other' for unknown section names", () => {
    const releases = parseChangelog(SAMPLE);
    const r140 = releases[1]!;
    expect(r140.groups.Other).toHaveLength(1);
    expect(r140.groups.Other?.[0]?.title).toBe("Internal cleanup.");
  });

  it("ignores content before the first release heading", () => {
    const releases = parseChangelog("# Title\n\nblah blah\n\n## 2026-01-01 — v0.1.0\n\n### Added\n- a\n");
    expect(releases).toHaveLength(1);
    expect(releases[0]!.version).toBe("0.1.0");
  });

  it("returns an empty list when no releases match", () => {
    expect(parseChangelog("just some text")).toEqual([]);
  });
});

describe("extractTitle", () => {
  it("pulls the first bold run", () => {
    expect(extractTitle("- **Hello world.** Body.")).toBe("Hello world.");
    expect(extractTitle("**No leading dash** but bold")).toBe("No leading dash");
  });

  it("falls back to a truncated body when no bold run", () => {
    const body = "- ".concat("a".repeat(200));
    expect(extractTitle(body).length).toBeLessThanOrEqual(96);
  });
});

describe("countByCategory", () => {
  it("sums entries across releases", () => {
    const releases = parseChangelog(SAMPLE);
    const counts = countByCategory(releases);
    expect(counts.Added).toBe(2);
    expect(counts.Security).toBe(1);
    expect(counts.Improved).toBe(1);
    expect(counts.Other).toBe(1);
    expect(counts.Fixed).toBe(0);
    expect(counts.Breaking).toBe(0);
  });
});
