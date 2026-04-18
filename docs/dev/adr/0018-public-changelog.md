# ADR 0018 — public, customer-facing changelog at `/changelog`

- **Status:** Accepted
- **Date:** 2026-04-18
- **Wave:** 5.5
- **Supersedes:** —
- **Related:** ADR 0016 (Stripe billing), ADR 0017 (auditor package), CHANGELOG.md
  (engineering-internal)

## Context

The platform now ships a public marketing surface (landing page,
`/cvo`, `/pricing`, `/sandbox`) and is positioned as a CVO platform that
prospective customers and partners are expected to evaluate without an
account. Several stakeholder asks converged on the same gap:

1. **Sales / partnerships** want a single URL they can point at to
   prove the product is alive and improving — the engineering
   `CHANGELOG.md` reads as internal noise (refactors, ADR numbers,
   migration files).
2. **Existing customers** want to know what changed before each release
   without reading internal commits.
3. **Auditors / NCQA** want a reproducible record of when
   compliance-relevant capabilities (auditor package, multi-tenancy
   shim, FHIR endpoints) shipped — date + version + plain language.
4. **CMS-0057-F / DaVinci PDex** consumers occasionally need to track
   when the FHIR contract evolves — they cannot read internal docs.

We need a single, durable, plain-English surface for this and we need
it to live next to the product, not on a separate marketing site
controlled by a different team.

## Decision

We add a curated public changelog with three pieces:

1. **Source of truth — `docs/changelog/public.md`.**
   - Markdown, hand-curated, customer-language only.
   - One section per release: `## YYYY-MM-DD — vMAJOR.MINOR.PATCH`.
   - Sub-sections `### Added | Improved | Fixed | Security | Breaking`.
   - Every bullet starts with a `**bold title.**` so the parser can
     extract a stable plain-text title for RSS / SEO.
   - Lives under `docs/` so it ships in the repo, in PR review, and in
     the auditor package; never edited at runtime.

2. **Pure parser — `src/lib/changelog/parser.ts`.**
   - Zero I/O. Consumes the Markdown string, returns a typed
     `Release[]` with `groups` keyed by category.
   - Unknown sub-sections fall through to `Other` rather than being
     silently dropped (anti-weakening: we never hide content from
     consumers).
   - Malformed release headings are skipped, never partially rendered.

3. **Public surfaces:**
   - **`/changelog`** — Server Component page. Renders one card per
     release, with category badges, anchor-stable IDs, and an "RSS"
     link. No client JavaScript beyond what Next.js needs for `Link`
     prefetch.
   - **`/changelog.rss`** — RSS 2.0 feed rendered by
     `src/lib/changelog/rss.ts`. One `<item>` per entry per release so
     readers can subscribe at the granularity they care about. URL
     mirrors the existing `cv.pdf` segment convention (a literal dot is
     a valid Next.js path segment).

## Why a curated file instead of the engineering CHANGELOG.md

`CHANGELOG.md` records every PR-level change and is consumed by
engineers; many entries refer to internal modules, ADR numbers, or
refactor steps that have no customer meaning. Mechanically reformatting
it would either dump engineering jargon onto customers or lose
provenance. A second, smaller, hand-curated file is cheaper to maintain
than a transformer with rules to drop "internal" entries, and it gives
PMs / docs a real review surface.

## Why a flat-file source instead of a CMS

- One source of truth, versioned with the code, reviewable in PR.
- No runtime DB dependency for the public site (the page is a Server
  Component reading a file shipped with the bundle).
- No new admin UI, no new auth surface, no new RBAC.
- Auditors get a single artifact in `docs/changelog/public.md` they can
  diff over time.

## Why pure helpers split into `parser.ts` and `rss.ts`

- The parser is unit-tested without any HTTP / FS mocks.
- The RSS renderer is unit-tested by feeding it a synthetic
  `Release[]`, which means we cover XML escaping and slug stability
  without touching the file system.
- The route handler does the I/O and is therefore tiny and
  uninteresting to test in unit form (covered by smoke E2E in
  `pillar-u-changelog.md`).

## Consequences

### Positive

- Customers, sales, auditors, and FHIR consumers now have one URL.
- RSS feed unblocks "subscribe" requests from partners.
- Source file is a first-class artifact in the auditor package by
  virtue of living under `docs/`.
- Adding a release is a one-line PR for non-engineers (PM / DocOps).

### Negative

- Two changelog files (engineering `CHANGELOG.md` and public
  `docs/changelog/public.md`). Mitigated by a release-checklist item:
  every release must update both before the tag is cut.
- Renderer is intentionally minimal (no nested lists, no images, no
  tables). If we ever need richer formatting we revisit and pick a
  proper Markdown library — explicitly out of scope today.

## Anti-weakening rules

The following invariants must be preserved and are enforced by tests
in `tests/unit/lib/changelog/`:

1. **Unknown sections must NOT be dropped** — they fall back to
   `Other`. (`parser.test.ts › falls back to 'Other' …`)
2. **RSS items MUST be XML-escaped** — `<script>` etc. are encoded.
   (`rss.test.ts › escapes XML special characters …`)
3. **Slugs MUST be deterministic** — same title always produces the
   same anchor / GUID. (`rss.test.ts › slugify …`)
4. **The `/changelog` page is a Server Component** — no `"use client"`,
   no client-side fetch of changelog data. Reviewers should reject any
   PR that adds a client-side data layer here; a static file does not
   need one.

## Alternatives considered

- **Auto-derive from git log / `CHANGELOG.md`.** Rejected: noise + no
  curation gate for customer-facing language.
- **Use Notion / a CMS.** Rejected: adds an outside-of-repo source of
  truth and an extra runtime dependency for a public page.
- **Reuse `CHANGELOG.md` directly.** Rejected: leaks internal
  vocabulary and makes engineering rewrites a customer-visible event.

## Future work

- Per-release Atom feed (in addition to RSS) when a partner asks for
  it.
- Tag releases with `@since` markers in the OpenAPI / FHIR
  CapabilityStatement so the changelog cross-links to the affected
  endpoint docs.
