# Pillar U — Public changelog (`/changelog` + RSS)

> **Wave:** 5.5
> **ADR:** [0018 — Public changelog](../../dev/adr/0018-public-changelog.md)

## Surface

| Surface | Path | Auth | Output |
| ------- | ---- | ---- | ------ |
| Public web page | `/changelog` | none (anonymous) | HTML release cards |
| RSS 2.0 feed | `/changelog.rss` | none (anonymous) | `application/rss+xml` |
| Source of truth | `docs/changelog/public.md` | repo write | curated Markdown |
| Marketing nav | `/` (header + footer) | none | link to `/changelog` |

## Source-file format

```
## YYYY-MM-DD — vMAJOR.MINOR.PATCH

### Added | Improved | Fixed | Security | Breaking
- **Bold title.** Customer-language sentence or two.
```

- The release heading regex is strict: `## YYYY-MM-DD — vMAJOR.MINOR.PATCH`
  (en-dash `—` or hyphen `-` are both accepted).
- Sub-section names outside the known set fall through to `Other`.
  Content is **never silently dropped**.
- The first `**bold**` run of each bullet is treated as the title used
  in the RSS feed and SEO meta.

## Pure helpers (covered by unit tests)

| Module | Tests |
| ------ | ----- |
| `src/lib/changelog/parser.ts` | `tests/unit/lib/changelog/parser.test.ts` (8 tests) |
| `src/lib/changelog/rss.ts` | `tests/unit/lib/changelog/rss.test.ts` (7 tests) |

Total: **15 unit tests** — all green at the time of writing.

## Anti-weakening rules

1. **`/changelog` is a Server Component.** No `"use client"`,
   no client-side `fetch` of changelog data. The whole point of this
   surface is that it is statically renderable from a file shipped with
   the bundle.
2. **Unknown sections must NOT be discarded.** They are bucketed into
   `Other`. (`parser.test.ts › falls back to 'Other' for unknown section names`)
3. **RSS output MUST be XML-escaped.** Any `<`, `>`, `&`, `"`, `'`
   coming from the source Markdown is encoded.
   (`rss.test.ts › escapes XML special characters …`)
4. **Slugs MUST be deterministic and length-bounded.** Same title →
   same anchor and GUID, ≤ 64 chars. (`rss.test.ts › slugify …`)
5. **The source file MUST live under `docs/`** so it is included in
   the auditor package automatically.
6. **No raw HTML in bullets.** The page renders bullets as plain text
   with a tiny inline `**bold**` shim — no Markdown library, no
   `dangerouslySetInnerHTML`.

## Failure modes covered

| Failure mode | Behavior |
| ------------ | -------- |
| Empty source file | Page renders the header + zero release cards; RSS feed renders an empty `<channel>` |
| Malformed release heading | Skipped silently — never partially rendered |
| Unknown section header (`### Other things …`) | Bucketed into `Other` group |
| Bullet missing a bold title | Title falls back to a truncated body (≤ 96 chars) |
| Special characters in titles | Properly escaped in both HTML and RSS |
| Very long titles in slugs | Clamped to 64 chars |
| `NEXT_PUBLIC_APP_URL` unset | RSS falls back to `request.url`'s origin |

## Manual verification

1. `curl http://localhost:6015/changelog | grep "v1.5.0"` → present.
2. `curl -H "Accept: application/rss+xml" http://localhost:6015/changelog.rss`
   → starts with `<?xml`, validates in any RSS reader.
3. Visit `/changelog#v1.5.0` → page scrolls to that release card.
4. Open marketing landing `/` → header has a "Changelog" link;
   footer has a "Changelog" link.

## Future work

- Atom feed (when a partner asks).
- Cross-link from FHIR `CapabilityStatement` `documentation` field.
- Search box (only worthwhile once we have ≥ 30 releases).
