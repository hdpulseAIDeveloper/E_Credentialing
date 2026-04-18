# Security Policy

The ESSEN Credentialing Platform handles Protected Health Information
(PHI) and is subject to HIPAA, NCQA CVO accreditation, and
CMS-0057-F. We treat security reports as a high-severity operational
event.

## Reporting a vulnerability

Please report suspected vulnerabilities privately. Do not open a
public GitHub issue.

- Email: `security@hdpulseai.com`
- PGP key: published at `https://hdpulseai.com/.well-known/security.txt`
- Response SLA: acknowledgement within 1 business day, triage within
  3 business days, fix or written remediation plan within 30 days for
  high-severity issues.

## What to include

A useful report includes:

- A clear description of the vulnerability and affected component
  (URL, API endpoint, tRPC procedure, FHIR endpoint, or file path).
- Steps to reproduce (request / response samples are ideal).
- Impact assessment (what data could be accessed, by whom, under
  what conditions).
- Any proof-of-concept payload or script (we will run it in an
  isolated environment).

## What is in scope

- This repository's hosted application at
  `https://credentialing.hdpulseai.com` and its preview environments.
- All FHIR endpoints under `/api/fhir/*`.
- The provider portal under `/application/*`.
- The legal verifier at `/verify/*`.

## What is out of scope

- Denial-of-service tests against production. Please coordinate
  load tests with the platform team in advance.
- Findings that require a malicious or compromised insider with
  staff role to begin with (those are tracked separately as
  insider-threat controls).
- Reports against third-party services we depend on (Azure, NextAuth,
  Sentry, Stripe). Please report those to the upstream vendor.

## Coordinated disclosure

We follow a 90-day coordinated disclosure window from the date of
acknowledgement. We will credit researchers in the release notes
unless they request anonymity.

## Bug bounty

We do not currently operate a paid bug bounty. We are happy to
recognize researchers in our public hall of fame at
`https://hdpulseai.com/security/hall-of-fame`.

## Internal references

- DAST + secrets scanning: see
  [docs/testing/security.md](docs/testing/security.md).
- Threat model and STRIDE analysis:
  [docs/technical/security.md](docs/technical/security.md).
- Audit log tamper evidence: ADR
  [0011-audit-tamper-evidence.md](docs/dev/adr/0011-audit-tamper-evidence.md).
- Pillar I (Security & DAST) test gates:
  `tests/security/pillar-i-security.spec.ts`.
