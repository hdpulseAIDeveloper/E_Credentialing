# 0007. Weekly sanctions sweep with 24-hour idempotency

- Status: Accepted
- Date: 2026-04-16

## Context

Prior code defined two scheduled jobs — `sanctions-monthly` and `sanctions-weekly` — that did the same thing. NCQA expects weekly re-checks as a CVO standard. Running the job more than once for the same provider within a short window wastes external API capacity and can briefly flag the provider as "checked twice this week" to auditors.

## Decision

- Single scheduled job `sanctions-recheck` running every Monday 02:00 ET.
- Within the job, skip any provider with an OIG or SAM run completed in the last 24 hours.
- Environment flag `SANCTIONS_RECHECK_DISABLED=true` halts the job without a code change.
- Unit tests cover idempotency skip and env guard.

## Consequences

- Aligns explicitly with NCQA weekly standard.
- Prevents duplicate or near-duplicate runs.
- Clean kill-switch for emergencies (rate limits, external outages).
- Job is observable through logs (`pino` + BullBoard).

## Alternatives considered

- **Keep both jobs, add idempotency** — the two jobs were confusingly named and equivalent; easier to consolidate.
- **Per-provider cadence (7 days since last check)** — mathematically equivalent to weekly-Monday but harder to audit by eye. Picking a fixed day simplifies compliance reporting.
- **Nightly sweep** — over-uses external APIs and wasn't required by any standard.
