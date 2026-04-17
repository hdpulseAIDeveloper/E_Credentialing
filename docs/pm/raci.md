# RACI

> **R** = Responsible (does the work) · **A** = Accountable (final say,
> singular) · **C** = Consulted (two-way) · **I** = Informed (one-way).

## Roles

- **Sponsor** — VP Operations
- **PM** — Project Manager
- **Eng Lead** — HDPulseAI Engineering Lead
- **DevOps** — Cloud / infra engineer
- **Sec** — Security & Compliance Lead
- **Cred Ops** — Credentialing Operations Manager
- **QA** — QA Lead
- **Product** — Product Manager
- **Support** — Help-desk / training

## Workstreams

| Workstream | Sponsor | PM | Eng Lead | DevOps | Sec | Cred Ops | QA | Product | Support |
|---|---|---|---|---|---|---|---|---|---|
| Vision / scope | A | C | C | I | C | C | I | R | I |
| Architecture / ADRs | I | C | A/R | C | C | I | I | C | I |
| Data model / migrations | I | C | A | C | C | C | I | I | I |
| Bot framework | I | C | A/R | I | C | C | C | I | I |
| Compliance evidence (NCQA/HIPAA) | I | C | C | I | A/R | C | C | C | I |
| Security controls | I | C | C | C | A/R | I | I | I | I |
| Public APIs / FHIR | I | C | A/R | I | C | C | C | C | I |
| Provider portal | I | C | A/R | I | C | C | C | C | I |
| PSV bot ops (selectors, retries) | I | C | A/R | I | C | C | C | I | C |
| Production deploys | A | C | C | A/R | C | I | I | I | I |
| Backups / DR | A | C | C | A/R | C | I | I | I | I |
| Incident response | A | C | C | A/R | C | C | C | I | I |
| Training & onboarding | I | C | C | I | I | C | C | C | A/R |
| User documentation | I | C | C | I | I | C | C | A/R | C |
| Technical documentation | I | C | A/R | C | C | I | C | C | I |
| Status reporting | A | A/R | C | I | I | C | C | C | I |
| Risk register | A | A/R | C | C | C | C | C | C | I |
| Decision log | A | A/R | C | I | I | C | I | C | I |
| Change log | I | C | A/R | C | I | I | C | C | C |
| Master Test Plan | I | C | C | I | I | C | A/R | C | I |
| UAT | A | C | C | I | I | A/R | C | C | C |

## Decision rights summary

- **Architectural / technical** — Eng Lead (with Sec consulted on auth, audit,
  encryption, public APIs).
- **Scope / priority** — Sponsor + Product.
- **Compliance interpretation** — Sec (final), with Cred Ops consulted.
- **Operational changes (rotation, deploy windows)** — DevOps with PM informed.
