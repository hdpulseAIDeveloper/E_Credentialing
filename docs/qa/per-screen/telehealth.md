# Per-screen card: `/telehealth`

| Field | Value |
| --- | --- |
| Route(s) | `/telehealth` |
| Source file | `src/app/(staff)/telehealth/page.tsx` |
| Dynamic | no (server component) |
| Group | staff |
| Roles allowed | every authenticated staff role (CREDENTIALER, MANAGER, ADMIN, MEDICAL_DIRECTOR, COMPLIANCE_OFFICER, BILLING_SPECIALIST, PRIVILEGES_MANAGER, AUDITOR_READONLY) |
| Roles denied (must redirect/403) | PROVIDER (redirect to signin) |
| PHI fields rendered | Provider legal first/last name, provider type abbreviation, declared telehealth states, license states, telehealth-platform name, training completion date, IMLC LoQ status |

## Key actions / mutations

- **List view** — summary cards (total telehealth providers, certified, pending training, multi-state) + per-provider table with covered/uncovered state badges.
- **Per-provider deep dive** (via `TelehealthPanel`, opened on `/providers/[id]?tab=telehealth`):
  - **State coverage analysis** — declared vs. licensed vs. IMLC member-state grants.
  - **IMLC eligibility** — pure rule evaluation (`evaluateImlcEligibility`).
  - **Letter of Qualification record** — Wave 3.4. Form captures SPL, granted member states (CSV), issued date, expiry, and document blob URL. Persists via `telehealth.updateImlcRecord` and triggers `telehealth.syncExpirables` so the LoQ shows up on the central `/expirables` board.
  - **Platform certifications** — add / edit / delete per-platform certs (`telehealth.upsertCert`, `telehealth.deleteCert`). Each save also fires the Expirables sync so certs surface on `/expirables`.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` — Pillar A static route smoke
- `tests/e2e/all-roles/pillar-b-rbac.spec.ts` — Pillar B role gating
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` — Pillar E axe scan
- `tests/unit/server/services/telehealth-expirables.test.ts` — Wave 3.4 reconciliation helpers (10 cases)
- `tests/unit/lib/telehealth.test.ts` — IMLC eligibility + coverage gap helpers (existing)

## Linked OpenAPI / tRPC procedures

- `telehealth.listCerts`, `telehealth.upsertCert`, `telehealth.deleteCert`
- `telehealth.evaluateImlc`, `telehealth.updateImlcRecord`
- `telehealth.coverage`
- `telehealth.syncExpirables` *(Wave 3.4)*

## Linked workers / jobs

- `src/workers/jobs/telehealth-compliance.ts` — nightly sweep raises monitoring alerts AND calls `TelehealthExpirablesService.syncAll()` so platform certs and IMLC LoQs are mirrored onto `/expirables`.

## Known defects

_None recorded. Reference `docs/qa/defects/index.md` if a card opens._

## Last verified

2026-04-18 by Wave 3.4 buildout — IMLC LoQ form added, Expirables board integration wired, 10 reconciler unit tests added.
