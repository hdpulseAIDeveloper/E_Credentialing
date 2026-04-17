# ESSEN Credentialing Platform — User Guide

Welcome to the ESSEN Credentialing Platform — the system ESSEN Health Care
uses to credential, verify, monitor, and enroll healthcare providers.

This guide is for **staff users**: Credentialing Specialists, Managers,
Committee members, Compliance, Enrollment, and Administrators. If you are a
provider completing your application, start with
**[Provider onboarding guide](provider-onboarding.md)**.

## Find your starting point

| You are a… | Start here |
|---|---|
| Credentialing Specialist | [Getting started](getting-started.md) → [Working with providers](providers.md) → [Credentialing workflow](credentialing.md) → [PSV bots](bots.md) → [Expirables](expirables.md) |
| Credentialing Manager | [Getting started](getting-started.md) → [Credentialing workflow](credentialing.md) → [Committee workflow](committee.md) → [Reporting](reporting.md) |
| Committee Member | [Getting started](getting-started.md) → [Committee workflow](committee.md) |
| Roster Manager | [Getting started](getting-started.md) → [Rosters](rosters.md) → [Enrollments](enrollments.md) |
| Compliance Officer | [Getting started](getting-started.md) → [Reporting](reporting.md) → [Sanctions](sanctions.md) → [Security](security.md) |
| Administrator | [Getting started](getting-started.md) → [Administration](admin.md) → [Quick reference](quick-reference.md) |
| Provider (external) | [Provider onboarding guide](provider-onboarding.md) |

## All pages

### Foundations
- [Getting started](getting-started.md)
- [Quick reference (cheat sheet)](quick-reference.md)
- [FAQ](faq.md)
- [Security and privacy](security.md)

### Provider lifecycle
- [Working with providers](providers.md)
- [Credentialing workflow](credentialing.md)
- [Primary Source Verification (bots)](bots.md)
- [Committee workflow](committee.md)
- [Recredentialing](recredentialing.md)
- [Expirables](expirables.md)

### Monitoring
- [Sanctions monitoring](sanctions.md)
- (Continuous monitoring details inside [PSV bots](bots.md) and the in-app dashboards)

### Hospital & evaluation
- [Hospital privileges](hospital-privileges.md)
- [OPPE / FPPE](oppe-fppe.md)

### Payer side
- [Enrollments](enrollments.md)
- [Rosters](rosters.md)

### Reporting & admin
- [Reporting & compliance](reporting.md)
- [Administration](admin.md)

### Provider self-service
- [Provider onboarding](provider-onboarding.md)

## Capability highlights

The platform is in active development; everything below is part of the
current capability set, not a separate "what's new" tier:

- **NPDB Continuous Query** — alerts surface in your bell and on the provider record.
- **AI document classification** — uploads suggest a category; you confirm. Override with reason if needed.
- **One-click NCQA evidence packet** — see [Reporting](reporting.md).
- **Telehealth state coverage** — track licenses by state; expirations roll
  into the expirables list.
- **FSMB Practitioner Direct alerts** — feed into continuous monitoring.
- **Public REST + FHIR APIs** — covered in the [API guide](../api/README.md)
  for integration partners.

## What this platform does

The platform supports the full credentialing lifecycle for healthcare
providers practicing at ESSEN:

1. **Onboarding** — invite a provider, collect application + documents.
2. **PSV (bots)** — automated verification across state boards, ABMS, AMA,
   ECFMG, ACGME, NPDB, OIG / SAM / NY OMIG, DEA.
3. **Committee** — prepare summaries, vote, sign minutes.
4. **Enrollments** — submit to payers (Availity, My Practice Profile, Verity,
   eMedNY, EyeMed, and more); generate monthly rosters.
5. **Expirables & continuous monitoring** — never miss a renewal or sanction.
6. **Recredentialing** — 36-month cycle.
7. **Hospital privileges + OPPE / FPPE + telehealth + CME** — full lifecycle.
8. **Compliance** — NCQA CVO + Joint Commission + CMS-0057-F evidence.
9. **Public REST / FHIR API** — integrate downstream systems.

## Support

- Software questions: your manager or IT ticket.
- Credentialing policy questions: compliance team.
- Urgent issues (committee day, payer deadline): escalation in the
  [FAQ](faq.md).

## Companion documents

- [Functional documentation](../functional/README.md) — for BAs / QA on per-screen detail.
- [API reference](../api/README.md) — REST + FHIR + auth.
- [Compliance](../compliance/README.md) — NCQA / HIPAA / CMS mappings.
