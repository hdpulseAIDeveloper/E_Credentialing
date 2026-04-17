# Defect Management

## Severity

| Severity | Definition | Example |
|---|---|---|
| Critical | Data loss, security incident, system down, NCQA violation | Audit chain broken, PHI exposed via API, login broken |
| High | Major feature broken; no workaround | Bot framework cannot run; committee minutes won't lock |
| Medium | Feature degraded; workaround exists | Roster export missing optional column |
| Low | Cosmetic or copy issue; no functional impact | Misaligned padding, typo in label |

## Triage SLAs

| Severity | First response | Fix or workaround | Resolution |
|---|---|---|---|
| Critical | < 30 min | < 4 hrs | < 24 hrs |
| High | < 4 hrs | < 24 hrs | < 5 business days |
| Medium | < 1 business day | next sprint | within 2 sprints |
| Low | < 1 business day | backlog | best effort |

## Workflow

1. Reporter files a ticket with: title, severity, environment, build, steps,
   expected, actual, screenshot, audit trail (if applicable).
2. QA Lead triages within the SLA above.
3. Engineer assigned; PR linked to the ticket.
4. Fix verified by QA on staging; if a Critical, also smoke-tested on
   production after deploy.
5. Change log entry added if user-visible.

## Required fields

- **For Critical:** also a Sponsor & Sec notification within 1 hr; a post-incident
  review within 5 business days.
- **For Security:** follow [security incident response runbook](../dev/runbooks/incident-response.md).
- **For Compliance findings:** Sec opens or updates the related NCQA criterion in
  the catalog with the corrective action.

## Metrics

Tracked per release in `docs/testing/`:

- Total defects opened vs. closed.
- Mean time to triage and to resolve per severity.
- Reopen rate.
- Coverage of the regression suite where the bug occurred.

A reopen rate > 10% triggers a retrospective.
