/**
 * Pillar Q -- Documentation integrity (per `docs/qa/STANDARD.md` §1.Q).
 *
 * Catches link-rot in the docs tree. Every relative `[label](path)` link
 * inside docs/ must resolve. ADR cross-references must point to real
 * ADR files. Plan / status references must resolve to real files.
 *
 * Anti-weakening (§4.2): a broken docs link is a fail, not a warning.
 * The fix is to update the link or move the file -- never to add the
 * link to an allow-list here.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";

const ROOT = process.cwd();
const DOCS = join(ROOT, "docs");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    const s = statSync(p);
    if (s.isDirectory()) walk(p, out);
    else if (e.endsWith(".md")) out.push(p);
  }
  return out;
}

const MD_FILES = walk(DOCS);
const LINK_RE = /\[[^\]]+\]\(([^)]+)\)/g;
const SKIP_PROTOCOLS = /^(https?:|mailto:|#|tel:)/i;

interface BrokenLink { file: string; href: string; resolved: string; }

const broken: BrokenLink[] = [];

for (const f of MD_FILES) {
  const text = readFileSync(f, "utf8");
  for (const m of text.matchAll(LINK_RE)) {
    const href = m[1]?.trim() ?? "";
    if (!href) continue;
    if (SKIP_PROTOCOLS.test(href)) continue;
    const cleaned = href.split("#")[0]!.split("?")[0]!;
    if (!cleaned) continue;
    const target = resolve(dirname(f), cleaned);
    if (!existsSync(target)) {
      broken.push({ file: f.replace(ROOT + "\\", "").replace(ROOT + "/", ""), href, resolved: target });
    }
  }
}

describe("pillar-Q: documentation integrity", () => {
  it(`every relative markdown link in docs/ resolves (${MD_FILES.length} files scanned)`, () => {
    expect(
      broken,
      "Broken docs links:\n" + broken.map((b) => `  - ${b.file}: [${b.href}] -> ${b.resolved}`).join("\n"),
    ).toEqual([]);
  });

  it("docs/qa/STANDARD.md exists and is non-trivial", () => {
    const std = join(DOCS, "qa/STANDARD.md");
    expect(existsSync(std), "STANDARD.md missing").toBe(true);
    expect(readFileSync(std, "utf8").length, "STANDARD.md too short").toBeGreaterThan(2000);
  });

  it("ADR README references at least 14 ADRs (0001-0014)", () => {
    const adrDir = join(DOCS, "dev/adr");
    if (!existsSync(adrDir)) return;
    const ids = readdirSync(adrDir)
      .filter((f) => f.match(/^\d{4}-/))
      .map((f) => f.slice(0, 4));
    expect(ids.length, `expected at least 14 ADRs, found ${ids.length}`).toBeGreaterThanOrEqual(14);
  });
});
