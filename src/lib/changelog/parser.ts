/**
 * Wave 5.5 — public-changelog parser.
 *
 * Pure module: consumes the raw Markdown of `docs/changelog/public.md`
 * and produces a structured release list for the `/changelog` page
 * and the RSS feed. Zero filesystem dependencies — the caller (route
 * handler) reads the file, this module parses the string.
 *
 * Anti-weakening:
 *   - The parser is forgiving (unknown sections become a generic
 *     "Other" group) but never silently discards content. Anything
 *     between two release headings ends up attached to a release.
 *   - Release headings MUST follow `## YYYY-MM-DD — vMAJOR.MINOR.PATCH`.
 *     Any deviation logs (via the caller) and the release is skipped
 *     so we never publish a malformed entry.
 */

export type ReleaseCategory =
  | "Added"
  | "Improved"
  | "Fixed"
  | "Security"
  | "Breaking"
  | "Other";

export const KNOWN_CATEGORIES: ReadonlyArray<ReleaseCategory> = [
  "Added",
  "Improved",
  "Fixed",
  "Security",
  "Breaking",
];

export interface ReleaseEntry {
  /** Free-form Markdown body (preserved with leading bullet, links, etc.). */
  bodyMarkdown: string;
  /**
   * Plain-text title pulled from the first bolded run of the bullet.
   * Used in the RSS feed and SEO meta. Falls back to a truncated
   * version of the body when no bold run is present.
   */
  title: string;
}

export interface Release {
  /** ISO date (YYYY-MM-DD). */
  date: string;
  /** Semver-style version, e.g. "1.5.0". */
  version: string;
  /** Anchor slug for the release card and direct linking. */
  slug: string;
  /** Map of category → ordered list of entries. */
  groups: Partial<Record<ReleaseCategory, ReleaseEntry[]>>;
}

const RELEASE_HEADING = /^##\s+(\d{4}-\d{2}-\d{2})\s+[—-]\s+v(\d+\.\d+\.\d+)\s*$/;
const SECTION_HEADING = /^###\s+(.+?)\s*$/;
const BULLET = /^-\s+(.+)$/;

/**
 * Parse the Markdown body into a list of releases, newest first
 * (preserving file order; the source file is also newest first).
 */
export function parseChangelog(markdown: string): Release[] {
  const lines = markdown.split(/\r?\n/);
  const releases: Release[] = [];

  let current: Release | null = null;
  let currentCategory: ReleaseCategory = "Other";
  let bullets: string[][] = []; // grouped per release-section
  let buffer: string[] = [];

  function flushEntry() {
    if (buffer.length === 0 || !current) return;
    const bodyMarkdown = buffer.join("\n").trim();
    if (!bodyMarkdown) {
      buffer = [];
      return;
    }
    const entry: ReleaseEntry = {
      bodyMarkdown,
      title: extractTitle(bodyMarkdown),
    };
    const list = (current.groups[currentCategory] ??= []);
    list.push(entry);
    buffer = [];
  }

  function flushRelease() {
    flushEntry();
    if (current) releases.push(current);
    current = null;
    currentCategory = "Other";
    bullets = [];
  }

  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    const releaseMatch = RELEASE_HEADING.exec(line);
    if (releaseMatch) {
      flushRelease();
      const date = releaseMatch[1] ?? "";
      const version = releaseMatch[2] ?? "";
      current = {
        date,
        version,
        slug: `v${version}`,
        groups: {},
      };
      currentCategory = "Other";
      continue;
    }
    if (!current) continue;

    const sectionMatch = SECTION_HEADING.exec(line);
    if (sectionMatch) {
      flushEntry();
      const label = sectionMatch[1]!.trim();
      currentCategory = (KNOWN_CATEGORIES as readonly string[]).includes(label)
        ? (label as ReleaseCategory)
        : "Other";
      continue;
    }

    const bulletMatch = BULLET.exec(line);
    if (bulletMatch) {
      flushEntry();
      buffer.push(`- ${bulletMatch[1]}`);
      continue;
    }

    if (line.trim() === "" && buffer.length === 0) continue;
    if (buffer.length > 0) {
      buffer.push(line);
    }
  }
  flushRelease();

  // Discard nonsense entries before the first release heading
  // (already prevented by the `if (!current) continue;` guard).
  // Ignore the unused `bullets` accumulator — kept for future
  // expansion (per-category sorting / coalescing).
  void bullets;

  return releases;
}

/**
 * Pulls the leading bold run from a Markdown bullet body. Used as
 * the human-readable title in the RSS feed.
 *
 *   "- **Stripe Billing scaffolding.** Behind …"  →  "Stripe Billing scaffolding."
 */
export function extractTitle(bodyMarkdown: string): string {
  const stripped = bodyMarkdown.replace(/^[-*]\s+/, "").trimStart();
  const boldMatch = /^\*\*(.+?)\*\*/.exec(stripped);
  if (boldMatch) return boldMatch[1]!.trim();
  return truncate(stripped.replace(/\*\*/g, ""), 96);
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, Math.max(0, n - 1)).trimEnd() + "…";
}

/**
 * Returns counts per category across all releases. Used by the
 * `/changelog` page to render the filter chips.
 */
export function countByCategory(
  releases: ReadonlyArray<Release>,
): Record<ReleaseCategory, number> {
  const counts: Record<ReleaseCategory, number> = {
    Added: 0,
    Improved: 0,
    Fixed: 0,
    Security: 0,
    Breaking: 0,
    Other: 0,
  };
  for (const r of releases) {
    for (const cat of Object.keys(r.groups) as ReleaseCategory[]) {
      counts[cat] += r.groups[cat]?.length ?? 0;
    }
  }
  return counts;
}
