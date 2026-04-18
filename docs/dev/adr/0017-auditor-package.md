# ADR 0017 — One-click auditor package + SOC 2 Type I gap analysis

**Status:** Accepted — implemented (W5.4 landed 2026-04-18)
**Date:** 2026-04-18
**Deciders:** Engineering (autonomous lock-in per user directive 2026-04-18)
**Related:** Wave 5.4 in the local Cursor plan
`unblock_+_commercialize_ecred` (commercial readiness — auditor self-service).

## Context

Customers shopping for a CVO platform inevitably ask: *"How do you
handle SOC 2?"* and *"Can our auditor verify your controls?"* Today
the answer is "we'll prepare a package by hand" — that's not a
commercial answer.

Two needs:

1. A **one-click auditor package**: a single zip an admin can hand
   to an external auditor that contains the chained audit log, NCQA
   compliance snapshots, and per-control evidence files.
2. A **SOC 2 Type I gap analysis**: an honest, in-product view of
   which AICPA TSC controls are implemented, partial, or a gap, so
   sales can answer the auditor question with specifics rather than
   marketing.

## Decision

1. Add `src/lib/auditor/` containing pure helpers
   (`sections.ts`, `soc2-controls.ts`, `manifest.ts`) and the
   builder (`build-package.ts`) that uses JSZip in memory.
2. SOC 2 control catalog (`SOC2_CONTROLS`) is a hard-coded TypeScript
   array — auditors need to see the same set every export, and the
   catalog only changes via PR with a clear status delta. Statuses
   are honest: `implemented`, `partial`, or `gap`.
3. Output zip is **byte-stable** for the same inputs:
   - JSZip entries pinned to `generatedAt`.
   - Manifest artifacts sorted by path.
   - CSV rows sorted by `sequence` (audit log) and `takenAt` (NCQA).
   This lets an auditor diff two exports to verify history hasn't
   moved.
4. `withTenant({ organizationId })` instead of
   `dangerouslyBypassTenantScope` — the auditor package always knows
   which tenant it's exporting for, and the existing tenant Prisma
   extension auto-filters all queries inside that scope. No new
   bypass callers introduced.
5. Two surfaces:
   - `GET /api/compliance/auditor-package` for the in-app download
     button (admin-only, returns `application/zip`).
   - `npm run compliance:auditor-package` for nightly automation /
     ad-hoc auditor requests.
6. Every export writes a `AUDITOR_PACKAGE_EXPORTED` audit row that
   includes the zip's SHA-256 — so we can prove later which export
   went to which auditor at which time.

## Consequences

- New audit action: `AUDITOR_PACKAGE_EXPORTED` with `zipDigestSha256`
  metadata.
- New npm script: `compliance:auditor-package`.
- New admin-only page: `/settings/compliance` (download + gap view).
- Three pure modules, ~17 unit tests; no external services touched.

## Alternatives considered

- **Run the export in the worker queue and email a signed URL.**
  Right answer for very large tenants; today's tenants are
  small enough that an in-memory zip in the route handler is fine.
  Switch when the largest tenant exceeds ~500 MB of audit + evidence.
- **Generate PDFs instead of Markdown.** Auditors prefer machine-
  readable evidence (CSV + JSON manifest); PDFs are a presentation
  layer they apply themselves. The `cover.md` and `gap-analysis.md`
  are short on purpose.
- **Pull SOC 2 control catalog from a database table.** Rejected —
  the catalog needs PR-level review for every status change. A code
  review trail is the audit trail.

## Anti-weakening

- DO NOT bump a SOC 2 control status without a PR linking the
  implementation evidence.
- DO NOT remove fields from the manifest; add new fields instead.
- DO NOT change CSV header order.
- DO NOT introduce new callers of `dangerouslyBypassTenantScope`
  from the auditor path.
