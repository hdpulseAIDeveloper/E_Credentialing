/**
 * Wave 5.5 — public-changelog RSS feed renderer.
 *
 * Pure module — no I/O. The route handler is responsible for reading
 * the changelog file and choosing the absolute base URL.
 */
import type { Release } from "./parser";

const RSS_TITLE = "E-Credentialing CVO Platform — Changelog";
const RSS_DESCRIPTION =
  "Customer-facing release notes for the E-Credentialing CVO platform.";

export interface RssOptions {
  /** Absolute origin (e.g. https://app.example.com). No trailing slash. */
  baseUrl: string;
}

export function renderChangelogRss(
  releases: ReadonlyArray<Release>,
  opts: RssOptions,
): string {
  const items = releases
    .flatMap((r) => releaseToItems(r, opts.baseUrl))
    .join("");

  const lastBuildDate = releases[0]
    ? new Date(`${releases[0].date}T00:00:00Z`).toUTCString()
    : new Date().toUTCString();

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(RSS_TITLE)}</title>
    <link>${escapeXml(opts.baseUrl)}/changelog</link>
    <description>${escapeXml(RSS_DESCRIPTION)}</description>
    <language>en-us</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${escapeXml(opts.baseUrl)}/changelog.rss" rel="self" type="application/rss+xml" />
${items}  </channel>
</rss>
`;
}

function releaseToItems(release: Release, baseUrl: string): string[] {
  const out: string[] = [];
  const pubDate = new Date(`${release.date}T00:00:00Z`).toUTCString();
  for (const cat of Object.keys(release.groups)) {
    const list = release.groups[cat as keyof typeof release.groups] ?? [];
    for (const entry of list) {
      const guid = `${baseUrl}/changelog#${release.slug}-${slugify(entry.title)}`;
      const itemTitle = `[${release.version}] ${cat}: ${entry.title}`;
      out.push(
        `    <item>
      <title>${escapeXml(itemTitle)}</title>
      <link>${escapeXml(guid)}</link>
      <guid isPermaLink="false">${escapeXml(guid)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(entry.bodyMarkdown)}</description>
      <category>${escapeXml(cat)}</category>
    </item>
`,
      );
    }
  }
  return out;
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
