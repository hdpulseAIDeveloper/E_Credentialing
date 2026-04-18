# Per-screen card: `/settings/compliance`

| Field | Value |
| --- | --- |
| Route(s) | `/settings/compliance` (HTML), `GET /api/compliance/auditor-package` |
| Source file | `src/app/settings/compliance/page.tsx`, `src/app/settings/compliance/auditor-export-button.tsx`, `src/app/api/compliance/auditor-package/route.ts` |
| Dynamic | yes — reads audit log, NCQA snapshots, controls catalog |
| Group | authenticated / admin-only |
| Roles allowed | `ADMIN`, `SUPER_ADMIN`, `COMPLIANCE_OFFICER` |
| Roles denied (must redirect/403) | every other role → 403 / redirect; unauthenticated → `/auth/signin` |
| PHI fields rendered | none. Audit log entries are metadata-only (actor, action, target ID); no PHI exposed in summary cards. The downloaded ZIP **does** contain audit-log details — protect the link. |

## Key actions / mutations

- "Download auditor package" button → `GET /api/compliance/auditor-package` →
  streams `application/zip`. The page surfaces the SHA-256 digest of
  the last download.
- Each download writes an `AUDITOR_PACKAGE_EXPORTED` audit event with
  the requesting actor, organization, and digest.
- Page also renders the SOC 2 Type I gap-analysis summary (counts +
  per-control status). See
  [ADR 0017 — Auditor package](../../dev/adr/0017-auditor-package.md)
  and [Pillar T](../per-pillar/pillar-t-auditor.md).

## Linked specs

- `tests/unit/lib/auditor/sections.test.ts` (6 tests, CSV/Markdown rendering)
- `tests/unit/lib/auditor/soc2-controls.test.ts` (8 tests, catalog + gap)
- `tests/unit/lib/auditor/manifest.test.ts` (3 tests, byte-stable manifest)

## Linked OpenAPI / tRPC procedures

- REST: `GET /api/compliance/auditor-package`. No tRPC.

## Known defects

_None recorded._

## Last verified

2026-04-18 by Wave 5.4 (auditor package + SOC 2 gap analysis launch).
