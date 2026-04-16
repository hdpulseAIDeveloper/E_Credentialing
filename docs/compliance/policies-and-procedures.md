# Policies & Procedures Library

The P&P library holds the written policies required for NCQA CVO accreditation and internal governance. Each policy:

- Is versioned and change-tracked.
- Has a named owner.
- Is reviewed annually (at minimum).
- Is distributed to affected staff, with attestation recorded.

## Required policies

| # | Policy | Owner | Scope |
|---|--------|-------|-------|
| POL-001 | Credentialing Policy | Credentialing Manager | Scope, criteria, decision process |
| POL-002 | Recredentialing Policy | Credentialing Manager | 36-month cycle, data refresh, committee |
| POL-003 | Verification Policy | Credentialing Manager | Primary-source standards, acceptable evidence |
| POL-004 | Sanctions Policy | Compliance Officer | OIG/SAM process, escalation, enrollment termination |
| POL-005 | Expirables Policy | Credentialing Manager | Monitoring cadence, outreach, privilege pause |
| POL-006 | Confidentiality Policy | Compliance Officer | PHI, access, non-disclosure |
| POL-007 | Committee Policy | Committee Chair | Charter, quorum, decisions, minutes |
| POL-008 | Appeal and Denial Policy | Credentialing Manager | Provider rights, appeal process |
| POL-009 | Delegation Policy | Credentialing Manager | Pre-delegation, oversight, termination |
| POL-010 | Subdelegation Policy | Credentialing Manager | Subdelegates (none currently) |
| POL-011 | Non-Discrimination Policy | Compliance Officer | Scope of credentialing decisions |
| POL-012 | Retention and Destruction Policy | Compliance Officer | 7-year default, legal hold |
| POL-013 | Audit Policy | Compliance Officer | Audit procedure, tamper evidence |
| POL-014 | Access Control Policy | Admin | Role provisioning, revocation, review |
| POL-015 | Incident Response Policy | Security | Severity, notification, postmortem |
| POL-016 | Business Continuity Policy | Operations | Disaster recovery, RTO/RPO |
| POL-017 | HIPAA Privacy Policy | Compliance Officer | Privacy rule compliance |
| POL-018 | HIPAA Security Policy | Security | Security rule compliance |

## Storage

Policy documents live in `docs/compliance/policies/POL-NNN-slug.md`. Drafts may live in `docs/compliance/policies/drafts/`.

The platform surfaces the current version at `/admin/policies` for staff attestation.

## Revision process

1. Policy owner drafts a change in a PR.
2. Compliance Officer reviews.
3. Approved changes land on master.
4. On merge, the platform notifies staff to re-attest if the change affects their role.
5. Version history is visible in the admin UI.

## Attestation

Every staff user attests to each policy relevant to their role, annually and on every significant change. Attestations are recorded in the `PolicyAttestation` table and visible to Compliance for audit.

## Auditor access

The Auditor Package (see [auditor-package.md](auditor-package.md)) includes the current version of every policy along with attestation rollups.

---

*Concrete policy documents are maintained under `docs/compliance/policies/` and are out of scope for this repository's code documentation. When a policy goes live, add its summary here and link to the full document.*
