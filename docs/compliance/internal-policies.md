# Internal Policy Alignment

This doc summarizes how platform controls align with Essen's internal policies beyond the external standards.

## Access governance

- Staff access is provisioned through Entra AD groups, never through direct DB changes.
- Every role change is audited.
- Quarterly access review conducted by Compliance; reviewers confirm every user and role is still warranted.
- Users who have not signed in for 60 days are flagged for review.

## Change management

- All code changes go through PR review with at least 1 reviewer.
- Policy changes go through PR review with Compliance as the required reviewer.
- Emergency fixes bypassing review are documented in `docs/ops/emergency-fixes.md` with a post-hoc review within 48 hours.

## Vendor management

Every third-party processing any Essen data has:

- A signed Business Associate Agreement (for PHI processors).
- A signed Data Processing Agreement (for other processors).
- A risk assessment on file.
- A scheduled annual review.

## Training

- HIPAA training: annual, required.
- Platform role training: at onboarding (see [training](../training/README.md)).
- Security awareness: quarterly, 30 minutes.
- Phishing simulation: every 90 days.

Completion is recorded per user; the Compliance dashboard shows coverage.

## Incident handling

- Any suspected PHI exposure: see [incident response runbook](../dev/runbooks/incident-response.md).
- Postmortems within 5 business days.
- Annual tabletop exercise with clinical leadership.

## Continuous monitoring

- Sanctions sweep weekly.
- Access audit quarterly.
- Penetration test annually (third-party).
- SOC tooling monitors for anomalous auth patterns.

## Acceptable use

- No PHI in personal email, text messages, or unapproved cloud services.
- Screens must be locked when unattended.
- Screenshots of provider records are prohibited except under an approved operational need (e.g., a confidential support ticket with PHI scrubbed).
- Reporting suspected issues to Security is expected and never penalized.
