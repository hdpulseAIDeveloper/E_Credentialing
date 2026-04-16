# Runbook: Incident response

For anything customers notice or any PHI risk.

## Severity

| Sev | Definition | Response |
|-----|------------|----------|
| SEV1 | Platform down or PHI exposure | Page on-call immediately; CMO + Security on the call within 15 min |
| SEV2 | Major feature broken; subset of users impacted | On-call within 30 min; mitigation within 2 hours |
| SEV3 | Minor feature broken; workaround exists | Fix next business day |
| SEV4 | Cosmetic or nuisance | Schedule normally |

## First 5 minutes

1. Acknowledge the alert.
2. Create an incident channel: `#incident-<yyyymmdd>-<short-name>`.
3. Assign roles:
   - **Incident Commander** — drives the call, makes decisions.
   - **Communications** — updates stakeholders.
   - **Investigator** — reads logs, forms hypothesis.
4. Post the current state in the channel: what you see, what you are checking.

## Investigation

- Open Azure Monitor → filter by time window → look for error spikes.
- Open Bull Board (worker container) → check queue depth and failure rates.
- Open Sentry / error tracker → top errors by volume.
- Use `/api/ready` as a quick liveness check.

## Mitigation

Prefer mitigation over fix:

- If one bot is broken, disable it (see [bot-outage.md](bot-outage.md)) while you patch.
- If the web container is bad, roll back (see [rollback.md](rollback.md)).
- If a downstream dep is flapping, apply circuit-breaker env flag.

## Communications

SEV1 / SEV2:

- Page CMO and Security within 15 minutes.
- Internal status message every 30 minutes until resolved.
- If the outage exceeds 1 hour, email key clinical stakeholders.

## Resolution

- Verify via `/api/health` and user report.
- Note the resolution in the incident channel.
- Open a postmortem ticket — even for short incidents.

## Postmortem

Within 5 business days, produce a blameless postmortem:

- Timeline (UTC timestamps)
- Root cause
- Contributing factors
- What went well
- What didn't
- Action items with owners and due dates

Store postmortems under `docs/ops/postmortems/YYYY-MM-DD-name.md`.

## PHI-specific handling

If PHI was exposed (or may have been):

1. Do NOT delete evidence (logs, database state).
2. Involve Security and Legal immediately.
3. Document what was exposed, to whom, for how long.
4. Follow HIPAA breach notification procedure (formal review under compliance).
