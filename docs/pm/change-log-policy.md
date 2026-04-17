# Change Log Policy

## Source of truth

The repository's `CHANGELOG.md` (also linked from `docs/changelog.md`) is the
single source of truth for product changes.

## Format

We follow [Keep a Changelog](https://keepachangelog.com) and
[Semantic Versioning](https://semver.org).

```markdown
## [X.Y.Z] - YYYY-MM-DD
### Added
### Changed
### Deprecated
### Removed
### Fixed
### Security
```

- Patch: backwards-compatible bug fixes.
- Minor: backwards-compatible features.
- Major: breaking changes (requires 90-day deprecation notice on public APIs).

## What goes in the change log

- All user-visible changes.
- Public API additions, removals, deprecations.
- Security fixes (with severity).
- Notable internal changes only if they affect operations (deploy, migration,
  observability).

## What does **not** go in the change log

- Refactors with no behavioral change.
- Doc-only changes (these go in the doc-update commit instead).
- Internal test-only changes.

## Process

1. PR author drafts the changelog entry under `## [Unreleased]`.
2. Reviewer verifies the entry is accurate and on the right line.
3. Release manager renames `[Unreleased]` to `[X.Y.Z] - YYYY-MM-DD` at tag
   time and creates a new empty `[Unreleased]` block.
4. Tag with `git tag vX.Y.Z` and push; production deploy follows
   [release runbook](../dev/runbooks/release.md).

## Security advisories

If a security entry is published, also:

- Open an internal security ticket linking to the CHANGELOG entry.
- Notify affected API consumers within 7 days for medium issues, immediately
  for critical.
- File a CVE if applicable.

## Public API deprecation

- Mark deprecated in REST response with a `Deprecation: true` and `Sunset:
  <date>` header.
- Document in the OpenAPI spec.
- Provide migration guidance in the change log entry.
- Sunset window: 90 days minimum.
