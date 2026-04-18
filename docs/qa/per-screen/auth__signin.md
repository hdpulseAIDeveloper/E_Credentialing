# Per-screen card: `/auth/signin`

> **STANDARD.md §5 stub.** Hand-augment the *Linked specs*,
> *Known defects*, and *Last verified* fields when you cover this
> route. The scaffold script will not overwrite this file once it
> exists.

| Field | Value |
| --- | --- |
| Route(s) | `/auth/signin` |
| Source file | `src/app/auth/signin/page.tsx` |
| Dynamic | no |
| Group | public |
| Roles allowed | anonymous, every authenticated role |
| Roles denied (must redirect/403) | (none) |
| PHI fields rendered | Verify: enumerate every column the page renders and confirm role gating on each. |

## Key actions / mutations

_TODO: enumerate the buttons, forms, and tRPC mutations this screen triggers._

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A, every static route)
- `tests/e2e/all-roles/pillar-b-rbac.spec.ts` (Pillar B, every role)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E, axe scan)
_TODO: add per-screen specs as they're written (e.g. `tests/e2e/public/auth__signin.spec.ts`)._

## Linked OpenAPI / tRPC procedures

_TODO: list every `<router>.<procedure>` this screen calls (see
`docs/qa/inventories/trpc-inventory.json`)._

## Known defects

_None recorded. Reference `docs/qa/defects/index.md` if a card opens._

## Last verified

2026-04-18 by scaffold-cards.ts (stub only -- mark with your initials when you cover the screen).
