# Value Proposition

## Headline

> Credential a provider in **days**, not weeks. Stay continuously NCQA-ready.
> Replace PARCS and a stack of one-off tools with **one** auditable platform.

## Outcome metrics

| Outcome | Baseline (PARCS) | Target | How |
|---|---|---|---|
| Time-to-complete file | 30–45 days | ≤ 14 days for clean files | Bots run in parallel; no manual data entry |
| Staff hours per file | 12–18 | ≤ 4 | Automated PSV, document classification |
| Sanctions detection latency | weekly batch (manual) | < 24 h | Continuous sweeps + alerts |
| NCQA audit prep | 4 weeks | < 1 day | Auditor packet generator |
| Lost evidence rate | 5–10% | 0% | Every PSV captures source PDF |
| Roster errors / month | 6+ | < 1 | Generated from canonical state |
| Provider satisfaction (intake) | mixed | 4.5/5 | Modern, mobile-friendly portal |

## ROI summary (illustrative)

For a CVO managing 1,500 providers with annual recredentialing churn:

- Labor savings: 1,500 × 10 hrs saved × $45/hr = **$675K / yr**.
- Avoided sanctions risk (single missed exclusion = potential 6-figure recoupment).
- Audit prep avoidance: 4 weeks × 2 FTE per cycle = **~$45K / yr**.
- Faster billing start (avg 14 days earlier × downstream revenue).

Per-provider all-in cost target: **< $35 / month** including infra, labor, and licenses.

## Differentiators

1. **Open, hosted, single-tenant friendly.** Not locked to a vendor; deploy
   to your Azure tenant, own your data.
2. **Bot framework, not a black box.** Each PSV has source, status, evidence,
   and a re-run button. New sources are added in days, not quarters.
3. **AI with a paper trail.** Every AI suggestion writes a decision log,
   linked to the model card; reviewers always see and can override.
4. **NCQA criterion catalog inside the app.** Evidence is automatic and
   linked to the originating data, not a quarterly spreadsheet exercise.
5. **CMS-0057-F ready.** Practitioner FHIR endpoint live; payer interop is
   not a slide-ware promise.
6. **Modern stack.** Type-safe end-to-end (tRPC, zod, TypeScript). Next.js
   14 App Router. Prisma. Easy to staff and extend.
7. **Tamper-evident audit log.** HMAC-SHA256 chain; verifiable from CLI; DB
   blocks DELETE / TRUNCATE.

## Risks reduced

- **Compliance:** continuous monitoring + complete evidence reduce NCQA / CMS
  / state findings.
- **Operational:** no more "the PARCS server is down" or "the share is missing".
- **Security:** PHI encryption at rest, segregated PII handling, full audit.
- **Vendor lock-in:** reasonable to migrate off; standard stack and data model.

## Why now

- NCQA 2026 standards are in effect (NPDB Continuous Query, expanded sanctions, training tracking, AI governance).
- CMS-0057-F payer interop deadlines (2027) require FHIR R4 today.
- AI / OCR pricing is now sustainable at per-provider scale.
- Browser automation tooling (Playwright) is mature enough to replace fragile RPA.
