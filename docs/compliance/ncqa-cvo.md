# NCQA CVO Readiness

The platform is built to meet NCQA's Credentials Verification Organization standards. This doc maps each standard to platform capabilities and artifacts.

## Standards overview

NCQA CVO certification has a core set of standards:

- **CR 1** — Credentialing Policies
- **CR 2** — Credentialing Committee
- **CR 3** — Credentialing Verification
- **CR 4** — Sanction Information
- **CR 5** — Recredentialing
- **CR 6** — Monitoring of Expirables
- **CR 7** — Delegation
- **CR 8** — Subdelegation
- **CR 9** — Ongoing Monitoring

Each expects documented policies, measurable performance, and auditable evidence.

## Mapping

### CR 1 — Policies

- Policies & Procedures Library (`docs/compliance/policies-and-procedures.md`).
- P&Ps include: credentialing, recredentialing, sanctions, expirables, delegation, confidentiality, appeals, non-discrimination, provider rights.
- Every policy has an owner, review date, and change history.

### CR 2 — Credentialing Committee

- Committee module (UI under **Committee**).
- Charter stored as a versioned policy.
- Agenda generation with summary sheets.
- Decision recording (Approve / Deny / Defer / Approve with conditions).
- Minutes attestation via email tokens — tamper-evident.
- Reports: meeting history, deferral reasons, decision turnaround.

### CR 3 — Credentialing Verification

Primary source verification automated by bots, each producing an evidence PDF:

| Credential | Source | Bot | Evidence |
|------------|--------|-----|----------|
| License | State board | License Verification | PDF snapshot + parsed fields |
| DEA | DEA | DEA Verification | PDF |
| Board certification | ABMS boards | Board Verification | PDF |
| Education | AMA / ECFMG | Education | PDF |
| Work history | Employer email | Employer Verification | Form response |
| References | Peer email | Peer Reference | Form response |
| Hospital privileges | Facility | Hospital Privileges | Recorded status |
| Malpractice history | NPDB | NPDB Query | PDF |

Every verification is date-stamped and stored in the provider's file. Committee summary sheets surface the evidence with direct links.

### CR 4 — Sanction information

- OIG and SAM.gov queried at initial credentialing and weekly thereafter.
- Flagged matches handled via acknowledge / escalate / confirm workflow.
- Confirmed matches pause clinical privileges and trigger CMO review.

### CR 5 — Recredentialing

- 36-month cycle, initiated automatically 180 days prior to anniversary.
- Abbreviated application captures changes.
- Full PSV re-run.
- Committee review repeats.
- On-time rate tracked on compliance dashboard (target 100%).

### CR 6 — Expirables

- Every dated credential tracked with expiration and outreach cadence.
- Automated reminders at 120, 90, 60, 30, 7, 1 day before expiry.
- Report on on-time renewal rate.
- Pause clinical privileges on lapse (configurable).

### CR 7 & CR 8 — Delegation

- Delegated agreements tracked per payer.
- Monthly rosters produced per payer with adds/changes/terms.
- Acknowledgements recorded with per-row reconciliation.
- Pre-delegation and annual delegation oversight reporting built on the roster history.

### CR 9 — Ongoing monitoring

- Sanctions weekly sweep.
- Expirables continuously monitored.
- NPDB continuous query enrollment (per provider when opted in).
- Scheduled report emails to Compliance.

## Compliance dashboard

Live tiles covering each NCQA standard with green/yellow/red status:

- File completeness
- Turnaround time (days from invitation to committee decision)
- On-time recredentialing rate
- On-time expirable renewal rate
- Sanction sweep completeness
- Committee minute attestation

Every tile drills down to the underlying records.

## Sample-file audit support

NCQA auditors sample a subset of files. The platform's auditor package (see [auditor-package.md](auditor-package.md)) generates:

- Sampled files by NCQA's sample-size rules
- Policies bundle
- Committee minutes archive
- Sanction sweep logs
- Training records

All artifacts are date-stamped and cryptographically verifiable via the audit chain.

## Measurement and reporting

Metrics we track continuously:

- Median days from invitation to committee decision
- Median days from committee to enrollment (delegated)
- Percent of files with every required element
- Sanctions flag counts (true hits vs. false positives)
- Expirables on-time rate
- Recredentialing on-time rate

Reports are retained for 7 years.
