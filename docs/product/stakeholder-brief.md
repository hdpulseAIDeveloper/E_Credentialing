# Stakeholder Brief — E-Credentialing CVO Platform

**Audience:** All stakeholders — executives, sponsors, customers,
auditors, partners, internal teams.
**Status:** Single-page audience-cut summary. Read the linked deeper
docs for any role you own.
**Last Updated:** 2026-04-19

---

## What it is, in one sentence

The **E-Credentialing CVO Platform** is the NCQA-aligned,
HIPAA-compliant, AI-augmented system of record for healthcare provider
credentialing, primary-source verification (PSV), monitoring, payer
enrollment, and a public FHIR R4 provider directory — used internally
by ESSEN Health Care and offered as a managed
**Credentialing Verification Organization (CVO) service** to external
medical groups and ACOs.

## What it replaces

PARCS (legacy credentialing app), the K: drive PCD folders, and the
spreadsheet patchwork that surrounded them. PARCS sunset is scheduled
for **September–October 2026** with a 30-day rollback hold.

## Where it stands today

- **Production URL:** `credentialing.hdpulseai.com`
- **Modules shipped (P0):** 21 / 21 (20 operational + Public Error Catalog)
- **Test count:** 1,477 + Wave 21 additions, all green
- **QA gate:** PASS (66/66 routes, 52/52 API cells, 219/219 tRPC procedures, 18/18 pillars)
- **Compliance posture:** NCQA CR 1–9 mapped + dashboard-evidenced; HIPAA Security Rule controls in place; CMS-0057-F FHIR R4 directory live; Joint Commission NPG-12 alignment landed in Wave 3
- **Commercial readiness:** marketing landing, `/cvo` explainer, `/pricing`, `/sandbox`, public `/changelog` + RSS, multi-tenancy shim, Stripe billing scaffolding, one-click auditor-package export

---

## Read this if you are…

### …an Executive Sponsor or Steering Committee member
Start with the **[Product Overview](product-overview.md)** and the
**[Development Plan](../development-plan.md)** §1 (executive summary)
+ §9 (success metrics). The risk register lives at
[`pm/risk-register.md`](../pm/risk-register.md). Status reports follow
the cadence in [`pm/status-reporting.md`](../pm/status-reporting.md).
Headline KPIs we are committing to:

| Metric | PARCS baseline | Platform target |
|---|---|---|
| Time to credential | 45+ days | < 18 days |
| Manual PSV hours / provider | 3–4 hours | < 30 minutes |
| Expirable lead time | reactive | ≥ 90 days proactive |
| Audit completeness | partial | 100% automated |
| Enrollment follow-up on time | ~60% | > 95% |

### …an external customer (medical group, ACO) evaluating us
Start with **[Product Overview](product-overview.md)**, then
[`product/value-proposition.md`](value-proposition.md),
[`product/market-analysis.md`](market-analysis.md), and the public
surfaces:

- `/cvo` — what a CVO does and how we cover NCQA CR 1–9, TJC NPG-12, and CMS-0057-F.
- `/pricing` — Starter / Growth / Enterprise tiers.
- `/sandbox` — read-only REST against synthetic data; explore without an account.
- `/changelog` + `/changelog.rss` — what shipped, when.
- `/errors` — the public Error Catalog: every code the API emits is documented at a stable URL.

### …a partner or API integrator
Read **[`api/README.md`](../api/README.md)** for the REST v1 + FHIR R4
overview, **[`api/openapi-v1.yaml`](../api/openapi-v1.yaml)** for the
OpenAPI 3.1 contract, **[`api/errors.md`](../api/errors.md)** for the
Public Error Catalog, and
**[`api/versioning.md`](../api/versioning.md)** +
**[`api/rate-limits.md`](../api/rate-limits.md)** for stability and
quota expectations. Errors follow **RFC 9457 Problem Details**
(`application/problem+json`); every body's `type` URI resolves to
`/errors/{code}` with a human-readable description by anyone who has
the URI (no API key required for the catalog HTML pages).

### …an auditor (NCQA, internal, SOC 2, JC, OIG)
The compliance index is **[`compliance/README.md`](../compliance/README.md)**.
The auditor-ready pack is **[`compliance/auditor-package.md`](../compliance/auditor-package.md)**;
admins can trigger a one-click ZIP bundle that includes every
NCQA criterion assessment with evidence, an HMAC-chained audit-log proof
(range, head sequence, head hash), versioned legal/policy snapshots,
and a SOC 2 Type I gap analysis. Detailed mappings:

- NCQA CR 1–9: [`compliance/ncqa-cvo.md`](../compliance/ncqa-cvo.md)
- HIPAA Security Rule: [`compliance/hipaa.md`](../compliance/hipaa.md)
- CMS-0057-F Provider Directory: [`compliance/cms-0057.md`](../compliance/cms-0057.md)
- Joint Commission NPG-12: [`compliance/jc-npg-12.md`](../compliance/jc-npg-12.md)
- PHI data map: [`compliance/phi-data-map.md`](../compliance/phi-data-map.md)
- Retention: [`compliance/retention.md`](../compliance/retention.md)

### …a credentialing user or provider
Plain-language guides live under **[`user/`](../user/)**:
[getting-started](../user/getting-started.md),
[provider-onboarding](../user/provider-onboarding.md),
[credentialing](../user/credentialing.md),
[committee](../user/committee.md),
[enrollments](../user/enrollments.md),
[expirables](../user/expirables.md),
[recredentialing](../user/recredentialing.md),
[reporting](../user/reporting.md),
[security](../user/security.md), and
[troubleshooting](../user/troubleshooting.md). Role-based onboarding
plans live under **[`training/`](../training/)**.

### …a developer, architect, DevOps, or security engineer
Start with **[`docs/dev/getting-started.md`](../dev/getting-started.md)**,
then **[`technical/architecture.md`](../technical/architecture.md)**
and **[`technical/technical-requirements.md`](../technical/technical-requirements.md)**.
Day-to-day reference and runbooks are under **[`dev/`](../dev/)**;
ADRs 0001–0027 are at **[`dev/adr/`](../dev/adr/)**.

### …a Project Manager or Business Analyst
Start with **[`pm/charter.md`](../pm/charter.md)**,
**[`development-plan.md`](../development-plan.md)**, and
**[`pm/raci.md`](../pm/raci.md)**. The full functional spec with
per-screen UI/UX, validation, messages, audit, and permissions is
**[`functional/functional-requirements.md`](../functional/functional-requirements.md)**.
Decisions: technical → [`dev/adr/`](../dev/adr/), non-technical →
[`pm/decision-log.md`](../pm/decision-log.md).

### …a QA engineer or tester
The binding standard is **[`qa/STANDARD.md`](../qa/STANDARD.md)**
(v1.3.0 — **19 testing pillars (A–S)**, including Pillar S — Live-Stack
Reality Gate ([ADR 0028](../dev/adr/0028-live-stack-reality-gate.md))
with seven surfaces, the seventh being the dev-loop performance
invariant ([ADR 0029](../dev/adr/0029-dev-loop-performance-baseline.md));
**15 hard-fail conditions**; coverage headline format with the mandatory
`Live stack:` line).
Per-PR DoD: **[`qa/definition-of-done.md`](../qa/definition-of-done.md)**.
Strategy: [`qa/test-strategy.md`](../qa/test-strategy.md). Per-screen
cards: [`qa/per-screen/`](../qa/per-screen/). Per-flow cards:
[`qa/per-flow/`](../qa/per-flow/). Defect cards:
[`qa/defects/`](../qa/defects/). Master Test Plan workbook:
[`testing/`](../testing/README.md).

---

## What is *not* in scope (this cycle)

- Patient-facing features
- Billing / claims integration (only payer enrollment metadata)
- Native mobile app (responsive web only)
- Telemedicine *clinical* workflow (only telehealth credentialing —
  IMLC tracking, platform certifications, coverage gap alerts)
- Multi-region disaster recovery (single-region recovery only)

---

## How decisions get made

| Layer | Where it lives | Owner |
|---|---|---|
| Architectural / technical | [`dev/adr/`](../dev/adr/) — ADR 0001 → 0027 active | Tech Lead |
| Non-technical | [`pm/decision-log.md`](../pm/decision-log.md) | Project Manager |
| QA gates | [`qa/STANDARD.md`](../qa/STANDARD.md) §3 (headline) + §4 (hard-fail) | QA Lead |
| Open defects | [`qa/defects/index.md`](../qa/defects/index.md) | Tech Lead + QA |
| Production deploy | `python .claude/deploy.py` with `ALLOW_DEPLOY=1` | Sponsor sign-off + DevOps |

---

## Required documents (always current)

| Document | Why it is required |
|---|---|
| [System Prompt](../system-prompt.md) | Self-contained prompt sufficient to rebuild the application from scratch. |
| [Development Plan](../development-plan.md) | Phased delivery plan, current phase, KPIs. |
| [BRD](../functional/business-requirements.md) | The 21 BRs the platform commits to. |
| [FRD](../functional/functional-requirements.md) | Per-screen UI/UX, validation, messages, audit, permissions. |
| [TRD](../technical/technical-requirements.md) | The contract between business needs and the implementation; cross-references all 27 ADRs. |
| [QA Standard](../qa/STANDARD.md) | Binding 18-pillar standard; the only doc that gates production deploy. |

If any of these is out of date by more than one merged PR that
materially changes scope, schedule, or architecture, treat the gap as a
bug.

---

## One-line elevator pitch

> Replace your credentialing spreadsheets with a single, audited,
> NCQA-CR-mapped, HIPAA-aligned, AI-augmented platform — with public
> FHIR provider directory and a dereferencable error catalog — and
> credential a provider in under 18 days instead of 45.
