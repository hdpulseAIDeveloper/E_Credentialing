# Roadmap

> Public-facing roadmap. Engineering's detailed sequence lives in the
> [Development Plan](../development-plan.md). Items here are grouped by
> outcome, not sprint.

## Shipped (production)

- Provider directory + intake portal (magic-link auth).
- PSV bot framework + 12 production bots (state boards, ABMS, AMA, ECFMG,
  ACGME, NPDB, OIG, SAM, NY OMIG, DEA, malpractice, payer enrollment).
- Sanctions weekly sweep; configurable.
- Continuous monitoring (license, NPDB CQ, FSMB Practitioner Direct).
- Credentialing committee with quorum, voting, minutes.
- Recredentialing cycle.
- Hospital privileges + OPPE / FPPE.
- Telehealth state coverage.
- Behavioral health PSV.
- Peer review + RCA + CAP.
- AI document classification (Azure DI + LLM) with audited decisions.
- AI governance (model cards + decision log).
- Tamper-evident audit log (HMAC-SHA256 chain) + verifier.
- Public REST v1 + scoped API keys + rate limiting.
- FHIR R4 Practitioner endpoint (CMS-0057-F).
- Expirables tracker + automated nudges.
- Reports + analytics (dashboards, exports).
- Comms inbox (SendGrid + ACS SMS).

## In flight

- Auditor packet generator: one-click NCQA evidence bundle.
- Education PSV bots (AMA Masterfile + ECFMG advanced).
- Conversational AI assistant for staff (read-only, governed).
- Roster generation streaming for very large payers.
- Bulk import / dedupe wizard for migration off PARCS.

## Next 1–2 quarters

- SOC 2 Type II controls + evidence (Phase 5).
- OpenTelemetry + Sentry rollout.
- Read replica for reports & FHIR.
- Optional self-service password (post-Entra fallback).
- Provider mobile shell (PWA-first).
- Bulk export `$export` for FHIR.

## Looking further out

- Marketplace adapters: additional payer portals as customers ask.
- Multi-tenant pilot (separate Postgres schemas + tenant-scoped RBAC).
- Native mobile app (only if data shows demand).
- ML-assisted committee triage (priority, not decision).

## Cadence

- Patch releases weekly.
- Minor releases every 2 weeks.
- Major (breaking) releases quarterly with 90-day deprecation notices on
  public APIs.
