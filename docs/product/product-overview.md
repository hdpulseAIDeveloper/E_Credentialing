# Product Overview

**The E-Credentialing CVO Platform** is a HIPAA-aligned, NCQA-aligned,
AI-augmented SaaS platform that runs the entire provider credentialing,
verification, monitoring, and enrollment lifecycle. It is positioned and
sold as a **Credentialing Verification Organization (CVO) platform**:
the same product that runs ESSEN Health Care's internal credentialing
operation is offered to medical groups, ACOs, and similarly-shaped
delegated CVOs.

## Why it exists

Provider credentialing is the prerequisite for paid clinical work. ESSEN's
existing PARCS workflow — built on file shares and a Filemaker app — required
weeks of manual data entry, scattered evidence, and constant chasing of state
medical boards, sanctions lists, NPDB, payer portals, and committee minutes.

The platform replaces PARCS with a single, auditable, browser-based system
that:

- collects provider data once and reuses it everywhere;
- runs PSV (primary-source verification) using headless-browser bots against
  state boards, ABMS / ABIM / ABFM / NCCPA, AMA, ECFMG, ACGME, OIG, SAM.gov,
  NY OMIG, NPDB, and DEA — with full evidence captured;
- continuously monitors licenses, sanctions, NPDB Continuous Query, and FSMB
  Practitioner Direct;
- produces NCQA / Joint Commission / CMS-0057-F evidence on demand;
- generates payer-ready enrollment packets and roster files (SFTP-ready);
- runs a digital credentialing committee with quorum, voting, and minutes;
- tracks recredentialing, expirables, OPPE / FPPE, peer review, telehealth,
  and behavioral-health specialties.

## What it is, in 30 seconds

A Next.js web app + worker pair, backed by PostgreSQL and Redis on Azure,
fronted by a TLS-terminating Nginx, with public REST and FHIR endpoints for
external partners.

## Who uses it

| Persona | Daily activity |
|---|---|
| Credentialing Specialist | Provider intake, document review, bot kickoff, follow-ups |
| Committee Chair / Member | Reviews PSV evidence, votes, signs minutes |
| QA / Compliance | NCQA snapshot review, audit packet generation |
| Enrollment Specialist | Payer enrollment, roster preparation, SFTP push |
| Provider | Completes intake, uploads documents, attests |
| Executive | Dashboards, KPIs, board reporting |
| External payer / partner | Public REST + FHIR Practitioner endpoint |

## Top capabilities

1. **Provider directory** with NPI lookup, status workflow, and 360° history.
2. **Application intake** — provider self-service portal with magic-link auth.
3. **PSV bot framework** — extensible, evidence-capturing, retry-aware.
4. **Sanctions sweep** — weekly OIG / SAM / NY OMIG; configurable cadence.
5. **NPDB** — initial query + Continuous Query subscription + alerts.
6. **Continuous monitoring** — license expirations, FSMB Practitioner Direct.
7. **Credentialing committee** — meeting agenda, quorum, voting, minutes.
8. **Recredentialing cycle** — every 36 months by default, configurable.
9. **Payer enrollment** — per-product status, evidence, SFTP push.
10. **Roster generation** — monthly, attestation, SFTP delivery.
11. **Hospital privileges + OPPE / FPPE** — privilege list, evaluations.
12. **Telehealth state coverage** — multi-state license tracking.
13. **Behavioral health** — specialty handling per NCQA BH PSV.
14. **Peer review + RCA + CAP** — workflow with notifications.
15. **AI document classification** — Azure AI DI + LLM auto-routing.
16. **AI governance** — model cards, decision logs, override audit.
17. **Audit log** — append-only, HMAC chained, verifier on demand.
18. **Public REST v1 + FHIR R4** — for payer / partner integrations.
19. **Comms inbox** — email + SMS via SendGrid + ACS.
20. **Reports + analytics** — drilldown dashboards, exports, scorecards.

## What it is not

- Not a clinical EMR.
- Not a billing system.
- Not a generic e-signature platform (it integrates with one).
- Not a single-tenant on-prem product (cloud-first).

## Status

In production at ESSEN Health Care; phased rollout across teams (see
[Development Plan](../development-plan.md)).
