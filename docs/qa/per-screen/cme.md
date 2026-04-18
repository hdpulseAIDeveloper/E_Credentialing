# Per-screen card: `/cme`

> **STANDARD.md §5 covered.** Wave 3.2 hand-augmented the auto-scaffolded
> stub. The CME tracking page is the staff entry point for credential
> evidence used by JC OPPE indicators (CME totals are an OPPE input —
> see [`docs/compliance/jc-npg-12.md`](../../compliance/jc-npg-12.md))
> and by NCQA CR-7 ongoing competence reviews.

| Field | Value |
| --- | --- |
| Route(s) | `/cme` |
| Source file | `src/app/(staff)/cme/page.tsx` |
| Dynamic | no |
| Group | staff |
| Roles allowed | every authenticated staff role (CSR, CREDENTIALING_SPECIALIST, MANAGER, ADMIN, AUDITOR) |
| Roles denied (must redirect/403) | PROVIDER (redirect to `/auth/signin`), unauth (redirect to `/auth/signin`) |
| PHI fields rendered | Provider legal first/last name, total CME credits, category split, last-activity date. **No CME activity titles** are shown in the list — those live on the provider detail view. |

## Key actions / mutations

| Action | UI element | Backing surface |
| --- | --- | --- |
| Filter by provider name (`q`) | Search input | server-side query (Prisma) |
| Open provider record | "Provider name" link | navigate to `/providers/[id]` |
| Open CME tab | "Details" link | navigate to `/providers/[id]?tab=cme` |
| **Download CV PDF** | "Download CV" link (Wave 3.2) | `GET /api/providers/[id]/cv.pdf` (session-gated) |

The page itself does not call mutations — CRUD happens on the provider
detail page. Mutations and queries are mediated by `CmeService`.

## Linked specs

- `tests/e2e/all-roles/pillar-a-smoke.spec.ts` — Pillar A static smoke
- `tests/e2e/all-roles/pillar-b-rbac.spec.ts` — Pillar B role gating
- `tests/e2e/all-roles/pillar-e-a11y.spec.ts` — Pillar E axe scan
- `tests/unit/server/services/cme-service.test.ts` — service-layer unit tests (18 cases)
- `tests/unit/lib/cv/builder.test.ts` — CV builder + renderers (12 cases)
- _TODO (Wave 3.4):_ `tests/e2e/staff/cme-list.spec.ts` — filter + CV download

## Linked OpenAPI / tRPC procedures

- `cme.listByProvider`
- `cme.create` / `cme.update` / `cme.delete`
- `cme.getSummary`
- `cme.generateCv` — text CV (legacy contract)
- `cme.generateCvMarkdown` — markdown CV (Wave 3.2)
- `cme.generateCvPdfBase64` — base64-encoded PDF (Wave 3.2)
- REST: `GET /api/providers/[id]/cv.pdf` (internal, session-gated)
- REST: `GET /api/v1/providers/[id]/cv.pdf` (public, API-key-gated, scope `providers:cv`)

## Known defects

_None recorded. Reference `docs/qa/defects/index.md` if a card opens._

Open polish items tracked under **Wave 3.4 / 5.4**:

- CME CSV import (bulk upload from CME provider portal exports).
- Per-state / per-specialty CME annual requirement override.
- Watermark + tamper-evident HMAC stamp on the rendered PDF (lands with
  the auditor package in Wave 5.4).

## Last verified

2026-04-18 by **engineering autopilot (Wave 3.2)** — `CmeService`
extracted, CV builder + text/markdown/PDF renderers added, public
`/api/v1/providers/[id]/cv.pdf` (scope `providers:cv`) wired with
audit chain.
