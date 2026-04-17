# Communication Plan

## Audiences and channels

| Audience | Channel | Cadence | Owner |
|---|---|---|---|
| Engineering team | Standup | Daily | Eng Lead |
| Engineering team | PR review | Continuous | Reviewers |
| Cross-functional core | Weekly meeting + written notes | Weekly | PM |
| Sponsor + execs | Bi-weekly email update | Bi-weekly | PM |
| Steering committee | Monthly meeting | Monthly | Sponsor |
| ESSEN credentialing operations | Office hours + Q&A doc | Weekly | Cred Ops Mgr + Eng Lead |
| ESSEN providers | In-app banner + email | Per release affecting them | Support |
| External API consumers | Release notes email | Per minor release | Product |
| Auditors | On request + pre-audit briefing | Per audit | Sec |
| Internal status seekers | `docs/status/` snapshots | Per status report | PM |

## Escalation

1. Day-to-day issue → reported in standup or PR.
2. Cross-team blocker → PM raises in weekly meeting.
3. Sponsor-needed decision → PM emails sponsor with one-page summary.
4. Sec / privacy incident → immediate page to Sec + Eng Lead per
   [incident-response runbook](../dev/runbooks/incident-response.md).

## Document publication

- Anything touching public APIs requires release-notes treatment.
- Anything touching compliance posture requires Sec sign-off before
  publication.
- Internal docs (this folder) updated by PM as part of weekly status.
