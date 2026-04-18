# Per-flow card: Curriculum Vitae auto-generation

> **STANDARD.md §5 (per-flow).** End-to-end auto-CV pipeline used by
> staff, by the public `/api/v1` API, and (in Wave 5.4) by the auditor
> package. Anchors NCQA CR-2 / CR-4 evidence and JC OPPE indicator
> reporting.

| Field | Value |
| --- | --- |
| Flow id | `flow.cv-generation` |
| Owner | Credentialing Operations × Engineering |
| Standards covered | NCQA CR-2 (work history), CR-4 (education), JC OPPE indicator surface |
| Trigger surfaces | `/cme` "Download CV" button; `/providers/[id]?tab=cme`; `cme.generateCv*` tRPC; `GET /api/v1/providers/[id]/cv.pdf` |
| Service of record | `src/server/services/cme.ts` (`CmeService`) |
| Pure pipeline | `src/lib/cv/builder.ts` → `render-text.ts` / `render-markdown.ts` / `render-pdf.ts` |

## Architecture

```
                ┌──────────────────────────────┐
                │  CmeService.loadCvSnapshot   │
                │   (only file that knows      │
                │    about Prisma)             │
                └──────────────┬───────────────┘
                               │ CvSnapshot
                               ▼
                    ┌──────────────────┐
                    │  buildCv (pure)  │
                    └────────┬─────────┘
                             │ Cv
              ┌──────────────┼──────────────────┐
              ▼              ▼                  ▼
      renderCvText   renderCvMarkdown    renderCvPdf
        (string)        (string)         (Uint8Array)
              │              │                  │
              ▼              ▼                  ▼
     cme.generateCv  cme.generateCv*    /api/v1/providers/
                     Markdown            [id]/cv.pdf
                                         /api/providers/
                                         [id]/cv.pdf
```

The whole pipeline below `loadCvSnapshot` is **pure**: every renderer
produces deterministic output for a given `Cv` object, so a single
fixture covers every renderer's contract.

## Step-by-step

### (1) Snapshot load

`CmeService.loadCvSnapshot(providerId)` issues:

- one `provider.findUnique` with `profile + licenses + privileges +
  cmeCredits + providerType` includes,
- one `verificationRecord.findMany` for board certifications,
- one `workHistoryVerification.findMany` for employment history.

Three round-trips total. 404 if the provider is missing.

### (2) Build (pure)

`buildCv(snapshot, options?)` returns:

- a `header` (full name, NPI, provider-type label, contact),
- six fixed-order `sections` (Education, Licenses, Board certifications,
  Hospital privileges, Work history, CME credits),
- a `generatedAtIso` timestamp (override-able for deterministic tests),
- a `footerBrand` line (override-able for white-label customers).

Every empty section emits a `"No X on file."` entry so the renderers
never have to special-case empties.

### (3) Render

| Renderer | Output | Use case |
| --- | --- | --- |
| `renderCvText` | ASCII string | legacy `cme.generateCv` text contract; staff "view as text" preview; email templates |
| `renderCvMarkdown` | GFM string with escaped controls | in-app preview; future `/api/v1/providers/[id]/cv.md` |
| `renderCvPdf` | Letter-size PDF byte buffer (`pdf-lib`, Helvetica family, page footer brand) | `/api/providers/[id]/cv.pdf` (session-gated) and `/api/v1/providers/[id]/cv.pdf` (scope `providers:cv`) |

### (4) Audit chain

`CmeService.renderProviderCvPdf` writes `cme.cv_generated` with
`{ format, bytes, sections }` after each successful render. The audit
row's `actorId` differs by caller path:

- staff session route: `session.user.id`
- public `/api/v1` route: `apikey:<keyId>`
- internal `/api/providers/[id]/cv.pdf`: `session.user.id`

The downstream `auditApiRequest` row from the v1 middleware is
*additionally* written so reviewers see both the request envelope
and the CV chain-of-custody event.

## Failure modes & alarms

| Failure | Detection | Mitigation |
| --- | --- | --- |
| Provider missing | `loadCvSnapshot` throws `TRPCError NOT_FOUND`. REST routes return `404`. | Caller should surface a friendly 404. |
| API key missing `providers:cv` scope | `requireScope` returns `403 insufficient_scope`. | Customer rotates key with the new scope. |
| `pdf-lib` failure | PDF route catches and returns `500`; audit row still written with `status=500`. | Logs include the underlying error; investigate via Sentry once Wave 4.1 lands. |
| Snapshot too sparse | Renderer still produces a CV with `"No X on file."` entries. | Operational; not auto-resolved. |

## Test surface

- Builder + renderers: `tests/unit/lib/cv/builder.test.ts` (12 cases,
  including PDF magic bytes assertion).
- Service: `tests/unit/server/services/cme-service.test.ts` (18 cases,
  including the audit chain assertion on PDF render).
- Per-screen: [`docs/qa/per-screen/cme.md`](../per-screen/cme.md).
- Compliance E2E: covered indirectly by the Pillar P JC NPG-12 spec
  (CME totals are an OPPE indicator).

## Last verified

2026-04-18 — Wave 3.2 service-layer extraction + CV pipeline +
public/internal PDF endpoints.
