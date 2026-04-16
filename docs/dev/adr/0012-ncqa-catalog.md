# ADR 0012 — NCQA CVO criteria catalog, assessments, and compliance snapshots

**Status:** Accepted
**Date:** 2026-04-16
**Deciders:** Engineering + Compliance

## Context

NCQA CVO accreditation audits require Essen to demonstrate continuous compliance with ~80 criteria across credentialing, recredentialing, delegation, practitioner rights, confidentiality, operations, and quality management. The existing Compliance dashboard (`/compliance`) shows a handful of derived metrics (PSV rate, sanctions-check rate, average TAT) but has no structured representation of *which criteria* are being evaluated, *what evidence* was captured, or *how the score changes over time*.

Auditors expect:

1. A **catalog** — the full list of criteria, versioned.
2. **Per-period assessments** — status and evidence for each criterion, per audit period.
3. **Historical snapshots** — a dashboard timeline showing compliance trend.
4. **Auditor-package export** — one zip/PDF with everything above.

## Decision

Introduce three models in `prisma/schema.prisma`:

- `NcqaCriterion` — the catalog row (code, category, title, description, evidence hint, weight, active flag, sort order).
- `NcqaCriterionAssessment` — per-period evidence and status (`NOT_ASSESSED`, `COMPLIANT`, `PARTIAL`, `NON_COMPLIANT`, `NOT_APPLICABLE`), with optional score, JSON evidence blob, and assessor attribution.
- `NcqaComplianceSnapshot` — frozen point-in-time summary row computed from the latest assessment of each active criterion; stores counts per status, overall score, and a per-criterion breakdown.

Expose CRUD + snapshotting via a new `ncqa` tRPC router (`src/server/api/routers/ncqa.ts`), gated as staff-read / manager-write.

Snapshot scoring formula:

```
overallScore = round(((compliant + 0.5 * partial) / (total - notApplicable)) * 100)
```

`partial` counts half so that the dashboard doesn't over-reward a borderline period.

## Consequences

- **+** Auditor-package export becomes a straightforward SELECT over three tables plus latest-assessment evidence; no derivation logic at export time.
- **+** Compliance dashboard can plot a real compliance trend using `ncqa_compliance_snapshots.taken_at` / `overall_score`.
- **+** Content (rows in `ncqa_criteria`) is decoupled from code. Compliance can import updated NCQA standards without a deploy.
- **−** Content authoring is blocked until Compliance provides the NCQA standards spreadsheet — tracked as `docs/status/blocked.md` B-006. The tables ship empty-ready.
- **−** Adds three new tables + two new enums to the schema; relatively contained.

## Alternatives considered

- **Single "compliance metric" table, JSON blob per metric.** Rejected: loses query-ability for category and period filters; auditor export would need custom serialization.
- **Generate assessments from rules over existing tables (no catalog).** Rejected: NCQA standards overlap imperfectly with our data shape, and auditors expect narrative evidence tied to a specific criterion.
- **Store criteria as static TypeScript constants.** Rejected: requires a code deploy every time NCQA publishes an update, and versioning is awkward.
