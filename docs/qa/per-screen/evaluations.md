# Per-screen card: `/evaluations`

> **STANDARD.md §5 covered.** Wave 3.1 hand-augmented the auto-scaffolded
> stub. The OPPE / FPPE list page is the staff entry-point for Joint
> Commission Medical Staff standards MS.08.01.01 (FPPE) and MS.08.01.03
> (OPPE) evidence — see [`docs/compliance/jc-npg-12.md`](../../compliance/jc-npg-12.md).

| Field | Value |
| --- | --- |
| Route(s) | `/evaluations` |
| Source file | `src/app/(staff)/evaluations/page.tsx` |
| Dynamic | no |
| Group | staff |
| Roles allowed | every authenticated staff role (CSR, CREDENTIALING_SPECIALIST, MANAGER, ADMIN, AUDITOR) |
| Roles denied (must redirect/403) | PROVIDER (redirect to `/auth/signin`), unauth (redirect to `/auth/signin`) |
| PHI fields rendered | Provider legal first/last name, evaluation period, due date, evaluator displayName. **No clinical findings text** is shown in the list — those live on the detail view. |

## Key actions / mutations

| Action | UI element | Backing tRPC |
| --- | --- | --- |
| Filter by provider name (`q`) | Search input | server-side query (no tRPC; SSR Prisma) |
| Filter by `evaluationType` | `<select>` (All / OPPE / FPPE) | server-side query |
| Filter by `status` | `<select>` (All / Scheduled / In Progress / Completed / Overdue) | server-side query |
| Open provider record | "Provider name" link | navigate to `/providers/[id]` |
| View evaluation context | "View" link | navigate to `/providers/[id]?tab=evaluations` |

This page does **not** trigger mutations directly. Manager-level FPPE /
OPPE creation and update are mediated by the provider detail page or by
the auto-schedule worker; both delegate to `EvaluationService`.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` — Pillar A static smoke
- `tests/e2e/all-roles/pillar-b-rbac.spec.ts` — Pillar B role gating
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` — Pillar E axe scan
- `tests/e2e/compliance/jc-npg-12.spec.ts` — Pillar P JC NPG-12 evidence
- `tests/unit/server/services/evaluation-service.test.ts` — service-layer unit tests
- _TODO (Wave 3.4):_ `tests/e2e/staff/evaluations-list.spec.ts` — filter combinations + pagination

## Linked OpenAPI / tRPC procedures

- `evaluation.list` (queried by other surfaces; this page uses Prisma directly)
- `evaluation.getDashboard` (consumed by the dashboard summary cards on this page)
- `evaluation.create` (Wave 3.4 will move the staff "Create OPPE/FPPE" button onto this page)
- `evaluation.update`
- `evaluation.delete`
- `evaluation.createAutoFppeForPrivilege` (Wave 3.1 — manager rescue path)

See `docs/qa/inventories/trpc-inventory.json` for the canonical, generated
inventory.

## Known defects

_None recorded. Reference `docs/qa/defects/index.md` if a card opens._

Open polish items tracked under **Wave 3.4** (telehealth UI sweep):

- `/evaluations/[id]` detail / drill-down view (currently the page links
  to `/providers/[id]?tab=evaluations`).
- Per-`providerType` OPPE cadence overrides.
- Theming pass — the summary cards still use Tailwind chip palettes
  rather than the new semantic `--status-*` tokens; this is consistent
  with the rest of the staff list pages and will be batched.

## Last verified

2026-04-18 by **engineering autopilot (Wave 3.1)** — JC NPG-12 service
layer extracted, auto-FPPE + auto-OPPE moved to `EvaluationService`,
unit + compliance specs added.
