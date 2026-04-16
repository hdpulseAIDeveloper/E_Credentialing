# 0008. Prisma migrations tracked in git, applied at container start

- Status: Accepted
- Date: 2026-04-16

## Context

The production database was bootstrapped with `prisma db push` (no migration history). `prisma/migrations` was gitignored. This made reproducible deploys impossible and couldn't be audited.

## Decision

- Remove the gitignore rule for `prisma/migrations/` (keep an ignore for `**/*.tmp`).
- Commit the current schema as a baseline migration (`20260415040852_init`).
- Write a delta migration for every subsequent schema change.
- Add `prisma migrate deploy` to the web container's entrypoint (`scripts/web-entrypoint.sh`). The container cannot start until migrations succeed.
- On the production database (which was originally `db push`'ed), run `prisma migrate resolve --applied <name>` once to mark each existing migration as applied without re-running it. See `docs/status/blocked.md` `B-009a` for the exact command sequence.

## Consequences

- Every schema change is reviewable in a PR.
- Local, CI, staging, and prod all converge on the same schema deterministically.
- Entrypoint failures surface loudly and keep the old container running (Docker healthcheck keeps the previous task until the new one is healthy).
- Rollback is forward-only: write a compensating migration rather than downgrading.
- The `prisma migrate resolve` one-time step is the only manual setup needed for the prod database.

## Alternatives considered

- **Continue with `prisma db push` in prod** — unauditable, drift-prone, incompatible with CI.
- **Migrate outside the container (manual step)** — forgotten migrations cause outages; automation is safer.
- **Run migrations in a separate job container** — possible but adds complexity; the entrypoint approach is simpler and keeps web and schema in lockstep.
