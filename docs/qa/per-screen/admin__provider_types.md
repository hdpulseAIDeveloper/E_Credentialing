# Per-screen card: `/admin/provider-types`

> **STANDARD.md §5 stub.** Hand-augment the *Linked specs*,
> *Known defects*, and *Last verified* fields when you cover this
> route. The scaffold script will not overwrite this file once it
> exists.

| Field | Value |
| --- | --- |
| Route(s) | `/admin/provider-types` |
| Source file | `src/app/(staff)/admin/provider-types/page.tsx` |
| Dynamic | no |
| Group | staff |
| Roles allowed | ADMIN, MANAGER |
| Roles denied (must redirect/403) | SPECIALIST, COMMITTEE_MEMBER, PROVIDER (redirect to /dashboard) |
| PHI fields rendered | Name, DOB, NPI, DEA, license. SSN ADMIN-only. Home address ADMIN/MANAGER only. |

## Key actions / mutations

_TODO: enumerate the buttons, forms, and tRPC mutations this screen triggers._

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A, every static route)
- `tests/e2e/all-roles/pillar-b-rbac.spec.ts` (Pillar B, every role)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E, axe scan)
_TODO: add per-screen specs as they're written (e.g. `tests/e2e/staff/admin__provider_types.spec.ts`)._

## Linked OpenAPI / tRPC procedures

_TODO: list every `<router>.<procedure>` this screen calls (see
`docs/qa/inventories/trpc-inventory.json`)._

## Known defects

_None recorded. Reference `docs/qa/defects/index.md` if a card opens._

## Last verified

2026-04-18 by scaffold-cards.ts (stub only -- mark with your initials when you cover the screen).
