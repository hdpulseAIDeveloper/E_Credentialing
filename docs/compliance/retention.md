# Retention and Legal Holds

## Default retention

| Data | Retention | Basis |
|------|-----------|-------|
| Active provider records | Life of Essen relationship | Operational need |
| Terminated provider records | 7 years after termination date | NCQA CVO |
| Audit logs | 7 years | NCQA CVO, HIPAA |
| Committee minutes | Indefinite | Governance |
| Roster submissions and acknowledgements | 7 years | NCQA CVO |
| Auditor packages | 7 years | NCQA CVO |
| Staff training attestations | Life of staff + 3 years | Evidence of training |
| Uploaded documents | Linked to provider retention | Per file type |
| Sanction sweep evidence | 7 years | NCQA CVO |
| Debug artifacts (Playwright screenshots) | 30 days | Operational only |
| Error tracking (Sentry events) | 90 days | Operational only |

## Purge process

- Scheduled job runs nightly to identify rows past retention.
- Rows are soft-deleted and their associated Blob artifacts moved to the `/purge/` prefix with a 30-day grace period.
- After grace, hard delete from Postgres and Azure Blob permanently.
- Every purge is itself audited: what was deleted, when, by which job, matching which retention rule.

## Legal holds

An Admin can place a legal hold on:

- A single provider
- A provider cohort (e.g., all providers at a facility)
- A date range of audit data
- A specific payer's records

Holds suspend purge until lifted. Placing and lifting a hold is audited and requires a reason.

## Exceptions

Any deviation from default retention requires:

- Compliance Officer approval
- Documented reason in the policy library
- Annual review

## Provider right to request deletion

Providers may request deletion of their record. We honor this subject to:

- Retention obligations (7 years after termination).
- Legal holds.
- Our own defense needs (active litigation, audits).

If deletion cannot be granted, the provider receives a written explanation.

## Right to be forgotten

Not applicable under HIPAA in the same sense as GDPR. However, Essen supports correction and amendment of inaccurate information under HIPAA's amendment right.
