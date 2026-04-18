import { describe, expect, it } from "vitest";
import { parseChangelog } from "@/lib/changelog/parser";
import { renderChangelogRss, slugify } from "@/lib/changelog/rss";

const SAMPLE = `## 2026-04-18 — v1.5.0

### Added
- **Stripe Billing scaffolding.** Behind a feature flag.

### Security
- **CSP hardening & <script> escaping.** Tightened.
`;

describe("renderChangelogRss", () => {
  it("emits a valid RSS 2.0 envelope", () => {
    const releases = parseChangelog(SAMPLE);
    const xml = renderChangelogRss(releases, { baseUrl: "https://app.example.com" });
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain("<channel>");
    expect(xml).toContain("</rss>");
    expect(xml).toContain("<atom:link");
    expect(xml).toContain("https://app.example.com/changelog.rss");
  });

  it("emits one item per entry, tagged by category", () => {
    const releases = parseChangelog(SAMPLE);
    const xml = renderChangelogRss(releases, { baseUrl: "https://x" });
    const items = xml.match(/<item>/g) ?? [];
    expect(items).toHaveLength(2);
    expect(xml).toContain("<category>Added</category>");
    expect(xml).toContain("<category>Security</category>");
    expect(xml).toContain("[1.5.0] Added: Stripe Billing scaffolding.");
  });

  it("escapes XML special characters in titles and bodies", () => {
    const releases = parseChangelog(SAMPLE);
    const xml = renderChangelogRss(releases, { baseUrl: "https://x" });
    expect(xml).toContain("&lt;script&gt;");
    expect(xml).not.toMatch(/<script>/);
  });

  it("renders a fallback lastBuildDate when no releases", () => {
    const xml = renderChangelogRss([], { baseUrl: "https://x" });
    expect(xml).toContain("<lastBuildDate>");
    expect(xml).not.toContain("<item>");
  });
});

describe("slugify", () => {
  it("lowercases, hyphenates, and strips punctuation", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  Foo  Bar  ")).toBe("foo-bar");
  });

  it("clamps to 64 chars", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(64);
  });

  it("handles empty / pure-punctuation inputs", () => {
    expect(slugify("")).toBe("");
    expect(slugify("!!!")).toBe("");
  });
});
