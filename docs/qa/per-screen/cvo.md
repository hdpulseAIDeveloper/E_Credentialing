# Per-screen card: `/cvo`

| Field | Value |
| --- | --- |
| Route(s) | `/cvo` |
| Source file | `src/app/cvo/page.tsx` |
| Dynamic | no |
| Group | public / marketing |
| Roles allowed | **anonymous** (public), every authenticated role |
| Roles denied (must redirect/403) | none — fully public |
| PHI fields rendered | none |

## Key actions / mutations

- Read-only product explainer for the Credentialing Verification
  Organization (CVO) positioning.
- CTAs link to `/sandbox`, `/pricing`, and `/auth/signin`.
- Lists NCQA / TJC NPG-12 / CMS-0057-F coverage matrix.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` (Pillar A, every static route)
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` (Pillar E, axe scan)
- `tests/visual/anonymous.visual.spec.ts` (Pillar F, visual baseline)

## Linked OpenAPI / tRPC procedures

None. Static Server Component.

## Known defects

_None recorded._

## Last verified

2026-04-18 by Wave 5.2 (CVO positioning launch).
