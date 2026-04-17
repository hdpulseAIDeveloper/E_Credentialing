# Essen Credentialing Platform — Competitive Gap Analysis

**Date**: April 16, 2026 (Honest Re-Audit)
**Prepared by**: Platform Development Team
**Purpose**: Re-baseline the platform's actual implementation status against the April 2026 credentialing software market and identify real, code-verified gaps to inform the bridging roadmap.

---

## Executive Summary

A prior version of this document claimed "all 29 previously identified gaps have been addressed." A **code-level audit** of `src/server/api/routers/`, `src/workers/`, `src/lib/integrations/`, and `prisma/schema.prisma` shows that most of those modules ship as **PARTIAL** (functional shells) or **STUB** (placeholder behavior gated on env vars). At the same time, the credentialing market itself moved meaningfully in Q1 2026, introducing new table-stakes capabilities (autonomous AI agents, AI document classification, "verify-once" clearinghouse models) and tightening regulatory requirements (NCQA 30-day monitoring effective July 1 2025, CMS-0057-F FHIR API deadline of January 1 2027, Joint Commission Accreditation 360 effective January 1 2026).

This document replaces marketing claims with **verifiable status flags** tied to specific files in the repo. The roadmap section then bridges the real gaps in five phases prioritized by compliance risk and customer-deal value.

**Honest scorecard:**

| Dimension | Status |
|-----------|--------|
| 11 NCQA CVO verification products | **8 of 11** truly automated; education, work history, references, and malpractice carrier are partial or stubbed |
| NCQA 30-day continuous monitoring (effective Jul 1, 2025) | **Not compliant** — sanctions run monthly, single-state |
| CMS-0057-F FHIR Provider Directory API (Jan 1, 2027) | **Partial** — pragmatic Practitioner endpoint only |
| Joint Commission Accreditation 360 NPG 12 (effective Jan 1, 2026) | **Not aligned** — OPPE/FPPE shells exist but lack scheduled evaluations and peer-review evidence |
| 2026 AI table-stakes (CredAgent-style agents, doc auto-classification, conversational assistants) | **Largely missing** |
| HITRUST r2 / SOC 2 Type II procurement readiness | **Not started** |

---

## 1. Competitor Landscape Summary (April 2026)

| Platform | Focus | Key Differentiator | Recent Move (Q1 2026) |
|----------|-------|---------------------|------------------------|
| [Medallion](https://medallion.co/) | Provider groups, digital health | NCQA-CVO; AI agents + expert-in-the-loop | $43M raise; **CredAlliance** national clearinghouse; AI Phone Agents; Intelligent Form Mapping |
| [Verifiable](https://verifiable.com/) | Enterprise, health plans | API-first; 3,200+ verification sources | **CredAgent** (Feb 26, 2026) — first autonomous AI credentialing agent; 10× claimed productivity |
| [Symplr](https://www.symplr.com/) | Enterprise health systems | 9,600+ delineated privileges; OPPE/FPPE leader | ViVE 2026 AI announcements; symplifier community |
| [Andros](https://andros.co/) | Large health plans | Arc Network Lifecycle Platform; credentialing API | 2026 healthcare predictions thought-leadership |
| [MedTrainer](https://medtrainer.com/) | Multi-facility | Integrated LMS + credentialing + compliance | **AI Compliance Coach**, **AI Policy Guardian**, **AI Form Mapping**, **AI Upload Assistant** |
| [CredentialStream (HealthStream)](https://www.healthstream.com/) | Hospitals, health systems | Patented privileging; HITRUST r2 certified | 2026 trends in provider enrollment report |
| [Modio Health (OneView)](https://www.modiohealth.com/) | Provider-centric | Self-service CVs; CME tracking; SOC 2 Type II | Black Book #1 provider credentialing solution 2026 |
| [Assured](https://www.withassured.com/) | Growth-stage orgs | NCQA-CVO; 48-hour credentialing; 2,000+ PSV sources in parallel | M&A integration tooling |
| [QGenda (RLDatix)](https://www.qgenda.com/) | Hospitals | Browser extension auto-fill; QGenda Insights | Continued integration with CredentialStream |
| [CredyApp](https://credyapp.com/) | Small-mid teams | 1,400+ payer database | CAQH integration (Apr 2026) |
| [PayerReady](https://payerready.com/) | Solo/small practices | Flat per-application fee; EFT/ERA management | — |

---

## 2. Honest Implementation Status (Code-Level Audit)

> Methodology: every status flag below is grounded in a specific path under `src/`, `prisma/`, or `docs/`. If the code is a stub or returns mock data when an env var is unset, it is marked **STUB**, not FULL.

Legend: **FULL** = real production-ready implementation; **PARTIAL** = functional but incomplete or env-dependent; **STUB** = placeholder behavior, mock data, or explicit "not implemented" marker; **MISSING** = no implementation found.

### 2.1 Module Inventory (20 modules)

| # | Module | Status | Anchor file(s) | What's actually missing |
|---|--------|--------|----------------|-------------------------|
| 1 | Provider Onboarding | **PARTIAL** | `src/app/(provider)/application/*`, `src/server/api/routers/provider.ts` | iCIMS/CAQH return mock data without env; OCR pipeline has no worker loop |
| 2 | Onboarding Dashboard | **PARTIAL** | `src/app/(staff)/dashboard/page.tsx` | Real dashboard; depth depends on upstream automation quality |
| 3 | Committee / Sessions | **PARTIAL** | `src/server/api/routers/committee.ts`, `src/app/(staff)/committee/*` | No dedicated worker; agenda PDF flows partial |
| 4 | Enrollments | **PARTIAL** | `src/server/api/routers/enrollment.ts`, `src/workers/bots/enrollment-portal.ts` | Generic portal bot has fragile selectors; SFTP path stubbed |
| 5 | Expirables Tracking | **PARTIAL** | `src/server/api/routers/expirable.ts`, `src/workers/jobs/expirables-scan.ts` | List/CRUD + scan job real; outreach quality env-dependent |
| 6 | Credentialing Bots / PSV | **PARTIAL** | `src/workers/bots/*` | License/DEA/board/sanctions/eMedNY are real Playwright; **NPDB stub**, **education bots not implemented**, no malpractice carrier bot |
| 7 | Sanctions Checking | **PARTIAL** | `src/workers/bots/sanctions-oig.ts`, `sanctions-sam.ts`, `src/workers/jobs/sanctions-monthly.ts` | Bot wiring real but **monthly cadence violates NCQA 30-day requirement** |
| 8 | NY Medicaid / ETIN / eMedNY | **PARTIAL** | `src/server/api/routers/medicaid.ts`, `src/workers/bots/emedral-enrollment.ts` | Model + UI + bot scaffold; production fidelity TBD |
| 9 | Hospital Privileges | **PARTIAL** | `src/server/api/routers/provider.ts` | **Update only — no `create` mutation exposed**; new rows seedable only |
| 10 | NPDB | **STUB** | `src/workers/bots/npdb-query.ts` | Worker explicitly stubbed; dev returns mock `NO_REPORTS`; continuous query absent |
| 11 | Recredentialing | **PARTIAL** | `src/server/api/routers/recredentialing.ts`, `src/workers/jobs/recredentialing-check.ts` | Cycle CRUD + scheduled check; full NCQA cycle depth unverified |
| 12 | Compliance & Reporting | **PARTIAL** | `src/server/api/routers/report.ts`, `src/server/api/routers/ncqa.ts` | Saved reports + exports real; **NCQA criteria catalog ships empty** |
| 13 | Verifications (work history, refs) | **PARTIAL** | `src/server/api/routers/workHistory.ts`, `reference.ts` | Token forms + DB real; **`sendRequest`/`sendReminder` only flip status — no SendGrid call** |
| 14 | Roster Management | **PARTIAL** | `src/server/api/routers/roster.ts`, `src/lib/integrations/sftp.ts` | Data model + UI real; **SFTP upload stubbed** |
| 15 | OPPE / FPPE | **PARTIAL** | `src/server/api/routers/evaluation.ts`, `src/app/(staff)/evaluations/page.tsx` | CRUD + UI; not aligned to JC NPG 12 ongoing-competency requirements |
| 16 | Privileging Library | **PARTIAL** | `src/server/api/routers/privileging.ts`, `src/app/(staff)/admin/privileging/page.tsx` | Catalog CRUD; content must be loaded by admins; not Symplr-scale |
| 17 | CME & CV | **PARTIAL** | `src/server/api/routers/cme.ts` | Credit tracking real; CV generation is text, not a polished document |
| 18 | Public REST & FHIR | **PARTIAL** | `src/app/api/v1/*`, `src/app/api/fhir/Practitioner/*` | API-key auth real; **FHIR is pragmatic subset**, not CMS-0057-F-certified |
| 19 | Telehealth Credentialing | **PARTIAL** | `src/app/(staff)/telehealth/page.tsx`, `ProviderProfile.teleHealth*` | Profile flags + list page; no telehealth-specific verification or multi-state license workflow |
| 20 | Performance & Analytics | **PARTIAL** | `src/app/(staff)/analytics/page.tsx`, `src/app/(staff)/scorecards/page.tsx`, `src/app/api/metrics/route.ts` | Real aggregates + heuristic scorecards; **"LMS" is manual `StaffTrainingRecord`** |

### 2.2 Cross-Cutting Concerns

| Concern | Status | Notes |
|---------|--------|-------|
| AI document auto-classification | **MISSING** | Upload requires user to select `documentType` in `src/app/api/upload/route.ts`; Azure DI wired for OCR only |
| Real continuous monitoring (webhooks) | **MISSING** | Only scheduled jobs (`license-poll`, `sanctions-monthly`); no SAM.gov webhook ingestion, no FSMB PDC feed |
| Bulk import (CSV wizard) | **FULL** | `BulkImportModal.tsx` parses CSV and calls real mutations |
| E-signature for privileging forms | **MISSING / PARTIAL** | Typed attestation on application; no privileging-specific e-sign vendor flow |
| Real-time PSV (direct API vs Playwright) | **PARTIAL** | Playwright bots only; no direct API integration layer |
| Provider performance scorecards | **PARTIAL (heuristic)** | `(staff)/scorecards/page.tsx` computes rule-based scores; not a validated clinical performance product |

### 2.3 NCQA CVO 11-Product Coverage

| NCQA Product | Status | Anchor |
|--------------|--------|--------|
| License verification | **FULL** | Playwright bots in `src/workers/bots/license-verification.ts` |
| DEA verification | **FULL** | Playwright + TOTP via Azure Key Vault, `src/workers/bots/dea-verification.ts` |
| Education verification (AMA, ECFMG, ACGME) | **STUB** | Worker switch logs "not yet implemented" — `src/workers/index.ts` |
| Board certification | **FULL** | `board-nccpa.ts`, `board-abim.ts`, `board-abfm.ts` |
| Work history verification | **PARTIAL** | Public token form real; **outreach email never sent** |
| NPDB malpractice history | **STUB** | `src/workers/bots/npdb-query.ts` returns mock |
| Hospital privileges | **PARTIAL** | Tracked but not primary-source verified; no create endpoint |
| OIG sanctions | **FULL** | Bot + scheduled job |
| Federal sanctions (SAM) | **FULL** | API integration |
| Professional references | **PARTIAL** | Token form real; **outreach email never sent** |
| Malpractice insurance verification | **PARTIAL** | Profile fields only; no carrier outreach bot |

**8 of 11 truly automated**; 3 require Phase 1 work to reach NCQA CVO eligibility.

---

## 3. New 2026 Market Reality

The competitive bar moved meaningfully in Q1 2026. Any platform launching in mid-2026 will be benchmarked against these:

### 3.1 New Table-Stakes (shipped in last 90 days)

1. **Autonomous AI agents end-to-end** — Verifiable's **CredAgent** (Feb 26, 2026) is "industry's first autonomous AI credentialing agent"; one specialist supervises a fleet, ~3 human checkpoints per provider, full decision provenance logging. Medallion added **AI Phone Agents** (autonomous outbound to verifiers/payers) and **Intelligent Form Mapping** (AI maps unknown payer web forms with no config). Implication: deterministic Playwright bots without an LLM-mediated reasoning layer look outdated.
2. **AI document ingestion baseline** — MedTrainer **AI Upload Assistant**: bulk upload, auto-classification, expiration extraction, auto-filing. Manual "select doc type" UX is legacy.
3. **Conversational compliance assistant** — MedTrainer's **AI Compliance Coach** (location-specific regulatory answers in workflow), **AI Policy Guardian** (flags non-compliant policy language), **AI Course Expert** (surfaces required training).
4. **Centralized credential clearinghouse** — Medallion **CredAlliance** (Aug 2025 → built out 2026): verify a provider once, syndicate to multiple payer networks. Threatens unit economics across the category.
5. **30-day NCQA continuous monitoring** — effective **July 1, 2025**: license expirations, OIG, SAM, Medicare/Medicaid sanctions every 30 days minimum, **all states the practitioner practices**, escalation to peer-review committee documented.
6. **State Medicaid exclusion screening** — 45 states + DC have separate exclusion lists; federal-only is now a finding in Joint Commission audits.
7. **Audit-ready packet auto-generation** — Assured generates NCQA-compliant credentialing packet automatically per provider.
8. **Demographic + non-discrimination fields** — race, ethnicity, language fields plus non-discrimination statement on application is now required by NCQA 2026 application standards.
9. **HITRUST r2 / SOC 2 Type II as procurement floor** — after TriZetto (3.4M records, Oct 2025) and QualDerm (3.1M, Dec 2025) breaches, plus Health-ISAC's reported 21% rise in healthcare cyber incidents in 2025, security certifications are now hard procurement requirements; "no customer data used to train AI" must be in the contract.

### 3.2 Emerging Differentiators (trending fast, not yet table-stakes)

- **"Verify once" credential portability** (CredAlliance, conceptually parallel to W3C Verifiable Credentials wallets)
- **Predictive analytics** — time-to-credential, MSP staffing demand, committee approval likelihood
- **AI governance / model cards** — precursor to NCQA 2027 AI standards (Program Structure, Governance, Pre-Deployment Evaluation, Ongoing Monitoring)
- **Real-time / API-native PSV** — direct API connections to FSMB PDC, NPDB, DEA, state boards (vs. screen-scraping)
- **White-label / headless credentialing** — credentialing as embed for digital-health/staffing marketplaces
- **FSMB Practitioner Direct (PDC)** — 12 months free continuous monitoring with new accounts; direct PDC integration becoming a competitive feature
- **Specialty-specific workflows** — behavioral health (taxonomy 101YM0800X), ABA, SUD/OTPs (SAMHSA cert), supervision documentation for provisionally-licensed clinicians, telehealth multi-state licensure

### 3.3 Regulatory Deadlines on the Horizon

| Standard | Effective | Status in Essen |
|----------|-----------|------------------|
| NCQA 30-day continuous monitoring (multi-state) | Jul 1, 2025 — already in effect | **Not compliant** (monthly, single-state) |
| NCQA PSV windows: 90 days Cert / 120 days Accreditation | Jul 1, 2025 — already in effect | No SLA timer surfaced |
| NCQA application demographics + non-discrimination | 2026 app standard | Not in `ApplicationForm` |
| NCQA staff data-integrity training + annual audit | 2026 standard | Manual `StaffTrainingRecord` only |
| Joint Commission Accreditation 360 / NPG 12 | Jan 1, 2026 — already in effect | OPPE/FPPE shells but no ongoing competency evidence |
| CMS-0057-F SLA rules (72h urgent / 7d standard PA decisions, denial transparency) | Jan 1, 2026 — already in effect | N/A (Essen is provider org, not payer) |
| CMS-0057-F annual PA + Patient Access metrics post | Mar 31, 2026 — passed | N/A (provider org) |
| **CMS-0057-F FHIR APIs** (Patient Access, Provider Access, Payer-to-Payer, Prior Auth, Provider Directory) | **Jan 1, 2027** | Only pragmatic Practitioner endpoint exists |
| NCQA AI Standards (proposed 2027 HPA) | 2027 | Not started; no model cards |

---

## 4. Refreshed Gap Inventory (24 real gaps)

### P0 — Compliance / Production Risk (must fix in 60 days)

1. **NPDB stub** — `src/workers/bots/npdb-query.ts` returns mock data; either implement NPDB Continuous Query or formally gate the feature with a UI banner and manual workflow.
2. **Verifications module sends no emails** — `workHistory.sendRequest`, `reference.sendRequest`, `sendReminder` mutations only flip status; wire them to `src/lib/email/sendgrid.ts` and the existing templates.
3. **Education PSV missing** — implement AMA Physician Masterfile, ECFMG, and ACGME bots; this is one of the 11 NCQA CVO products.
4. **30-day monitoring** — current `sanctions-monthly` job is non-compliant; tighten to ≤30 days and fan out to every state in `License.state[]`.
5. **State Medicaid exclusion screening** — add NY OMIG (mandatory for Essen) plus an extensible per-state plugin; current OIG/SAM-only is a finding.
6. **NCQA application demographic fields** — race, ethnicity, language plus non-discrimination disclosure on `ApplicationForm`.
7. **PSV SLA timers** — surface 90-day (Certification) / 120-day (Accreditation) countdowns; expose breach metrics on dashboard.
8. **Hospital Privileges create endpoint** — add `provider.createHospitalPrivilege`; today new rows can only be added via seed.

### P1 — 2026 Table-Stakes Parity (60–120 days)

9. **AI document auto-classification** — Azure Document Intelligence custom model or LLM prompt classifier, called from `src/app/api/upload/route.ts` before insert.
10. **Real continuous monitoring** — SAM.gov webhook ingestion + nightly board diff polls; replace `sanctions-monthly` semantics.
11. **Audit-ready credentialing packet** — single-click ZIP/PDF bundle per provider for delegated audits and NCQA reviews.
12. **Conversational AI assistants** — provider self-service ("how do I upload my DEA?") + internal compliance coach for staff (Azure OpenAI + RAG over `docs/`).
13. **Malpractice carrier verification** — outreach bot/email to carrier with structured response form, coverage threshold checks against facility minimums.
14. **SFTP roster client** — implement real `ssh2-sftp-client` with per-payer config + acknowledgment polling; replace stub.
15. **CAQH ProView 2026 alignment** — active-practice-site enforcement, 120-day re-attestation reminders, Groups module.
16. **Telehealth module deepening** — multi-state license tracking, platform certification, IMLC eligibility, real training cert tracking (not just profile flags).

### P2 — Regulatory Deadline-Driven (120–270 days)

17. **CMS-0057-F FHIR Provider Directory API** (Jan 1, 2027) — extend pragmatic Practitioner endpoint to full **Practitioner / PractitionerRole / Organization / Location / Endpoint** resources, plus **Provider Access API** scaffolding.
18. **Joint Commission NPG 12 alignment** — OPPE/FPPE needs scheduled-evaluation evidence, peer-review minutes capture, automatic FPPE trigger on new privilege grant.
19. **NCQA staff data-integrity training tracker** — external LMS integration (Absorb, Litmos, HealthStream) or a documented attestation flow; track annual qualitative audit.
20. **NCQA AI governance scaffolding** — model cards page, decision audit log on every AI/agent action, "no customer data used to train AI" contract clause and feature flag.

### P3 — Strategic Differentiators (270+ days)

21. **Autonomous AI agent layer** — orchestrator on top of Playwright bots: reasoning, exception routing, decision rationale logging, human checkpoints (CredAgent parity).
22. **FSMB PDC integration** — continuous monitoring feed for license/discipline.
23. **Behavioral health specialty path** — taxonomy 101YM0800X, supervision attestation for provisionally-licensed clinicians, BCBS fast-track.
24. **HITRUST r2 / SOC 2 Type II readiness** — control mapping, evidence collection, third-party assessor engagement.

---

## 5. Bridging Roadmap (5 Phases)

### Phase 1 — Production Truth & Compliance (60 days)

Make the stubs honest and close the NCQA 2025 mandates already in effect.

| # | Item | Effort | Deliverable |
|---|------|--------|-------------|
| 1 | NPDB stub → real Continuous Query or gated manual | M | `src/workers/bots/npdb-query.ts` real impl OR `NPDB_DISABLED` banner |
| 2 | Wire verifications email | S | `workHistory.sendRequest`/`reference.sendRequest` call SendGrid |
| 3 | Education PSV bots | M | `bots/education-ama.ts`, `bots/education-ecfmg.ts`, `bots/education-acgme.ts` |
| 4 | 30-day monitoring + multi-state fan-out | S | Rename + re-cron `sanctions-monthly` → `sanctions-30day`; License.state[] fan-out |
| 5 | NY OMIG + per-state plugin | M | `bots/sanctions-state-medicaid.ts` driven by config table |
| 6 | NCQA demographic + non-discrimination | S | Extend `ApplicationForm.tsx` |
| 7 | PSV SLA countdown + breach metric | S | New `PsvSlaTimer.tsx` reading audit trail |
| 8 | Hospital privilege create endpoint | XS | Add to `provider.ts` router |

### Phase 2 — 2026 Table-Stakes Parity (60–120 days)

Catch the platform up to where the market was at the start of 2026.

| # | Item | Effort | Deliverable |
|---|------|--------|-------------|
| 9 | AI document classification | M | `src/lib/azure/document-classifier.ts` |
| 10 | Continuous monitoring (webhooks + nightly diff) | M | `src/workers/jobs/continuous-monitor.ts` |
| 11 | Audit-ready packet generator | M | `src/server/services/audit-packet.ts` |
| 12 | Conversational AI assistants | L | `src/server/api/routers/ai.ts` + `ProviderAssistant.tsx` + `ComplianceCoach.tsx` |
| 13 | Malpractice carrier verification | S | `src/workers/jobs/carrier-verification.ts` |
| 14 | Real SFTP client | S | Replace stub in `src/lib/integrations/sftp.ts` |
| 15 | CAQH 2026 alignment | M | Active-site, re-attestation reminders, Groups |
| 16 | Telehealth deepening | M | Multi-state, platform cert, IMLC, training cert |

### Phase 3 — Deepening & Specialty (120–180 days)

Telehealth, CAQH, CME/CV polish, NCQA-required saved-report templates.

### Phase 4 — Regulatory Deadlines (180–270 days)

CMS-0057-F FHIR Provider Directory for Jan 1, 2027. JC Accreditation 360 NPG 12 alignment in OPPE/FPPE. NCQA AI governance scaffolding (model cards, decision logs, contractual stance). Staff data-integrity training tracker.

### Phase 5 — Strategic Differentiation (270+ days)

Autonomous AI agent orchestrator (CredAgent-style). FSMB PDC continuous monitoring. Behavioral-health specialty path. HITRUST r2 / SOC 2 Type II readiness.

---

## 6. Essen Competitive Advantages (Maintained)

These remain real differentiators against the SaaS competitors:

| Advantage | Description |
|-----------|-------------|
| **iCIMS HRIS Integration** | Webhook-driven ingestion at hire — most SaaS competitors require manual import |
| **Photo ID OCR Auto-Fill** | Azure AI Document Intelligence extracts ID fields and pre-populates forms |
| **DEA TOTP Automation** | Fully automated DEA verification with TOTP secrets in Azure Key Vault |
| **Payer Portal Bot Submission** | Playwright bots for Availity, My Practice Profile, Verity, EyeMed, VNS — beyond API-only competitors |
| **In-House Bot Framework** | No vendor lock-in to a third-party verification network |
| **Azure AD SSO** | Native Microsoft tenant integration with corporate MFA policy |
| **BTC Facility Enrollment** | Specific support for Behavioral Treatment Center workflows |
| **NY Medicaid / ETIN Module** | Deeper than any generic competitor's Medicaid support |
| **COI Tracking** | Built-in broker outreach and COI lifecycle |
| **In-House Ownership** | Zero per-provider SaaS fees; full data ownership; unlimited customization |

---

## 7. Sources

[Medallion](https://medallion.co/), [Verifiable CredAgent](https://verifiable.com/credagent), [Symplr ViVE 2026](https://www.symplr.com/press-releases/symplr-unveils-new-ai-powered-innovations-at-vive-2026), [MedTrainer AI](https://medtrainer.com/ai/), [HealthStream 2026 trends](https://www.healthstream.com/2026-trends-in-provider-enrollment), [Modio Health](https://www.modiohealth.com/), [Assured](https://www.withassured.com/), [Andros Network Lifecycle](https://andros.co/network-lifecycle-platform/), [NCQA 2026 Policy Updates](https://wpcdn.ncqa.org/www-prod/wp-content/uploads/2026-HPA-Policy-Updates_3-30-26.pdf), [NCQA AI Standards 2027 Memo](https://wpcdn.ncqa.org/www-prod/AI-Standards-in-2027-HPA_Overview-Memo.pdf), [CMS-0057-F](https://www.cms.gov/priorities/burden-reduction/overview/interoperability/policies-regulations/cms-interoperability-prior-authorization-final-rule-cms-0057-f), [CMS-0057-F Timeline](https://www.cmspriorauth.com/timeline.html), [Joint Commission Accreditation 360](https://www.jointcommission.org/en-us/accreditation/accreditation-360), [Joint Commission NPGs](https://www.jointcommission.org/en-us/standards/national-performance-goals), [State Medicaid Exclusions](https://streamlineverify.com/state-medicaid-list/), [FSMB PDC](https://www.fsmb.org/PDC/practitioner-direct/), [Health-ISAC 2025 cyber report](https://industrialcyber.co/reports/health-isac-reports-55-surge-in-cyber-incidents-in-2025-as-attacks-rise-and-escalation-looms-in-2026/).
