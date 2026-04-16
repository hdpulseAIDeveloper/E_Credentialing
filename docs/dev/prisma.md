# Prisma and Migrations

Prisma is the single ORM for this project. Schema lives in `prisma/schema.prisma`; all migrations are tracked in `prisma/migrations/` (do not gitignore).

## Workflows

### Schema change (day-to-day)

```bash
# 1. Edit prisma/schema.prisma
# 2. Generate migration (applies against your dev DB too)
npx prisma migrate dev --name <snake_case_name>

# 3. Regenerate Prisma client (usually automatic)
npx prisma generate

# 4. Commit the new migration folder
git add prisma/migrations/<timestamp>_<name>/ prisma/schema.prisma
```

Every migration is one directory with:
- `migration.sql` — committed, hand-reviewable SQL.
- `migration_lock.toml` — once present at the top level, do not delete.

### Production deploy

The web container applies migrations at startup (`scripts/web-entrypoint.sh`):

```sh
npx prisma migrate deploy
```

`migrate deploy` is idempotent and will never drop data. It fails loudly if migrations are inconsistent with the DB state; the container stays down until fixed.

### First-time deploy on a legacy `db push` database

If the target Postgres was initialized with `prisma db push` (no migration history), `migrate deploy` will fail on the baseline. Resolve by running `prisma migrate resolve --applied <baseline-name>` for every migration that already exists in the schema. See [`docs/status/blocked.md`](../status/blocked.md) entry `B-009a` for the exact command sequence we recorded for the production database.

### Resetting local

```bash
npx prisma migrate reset
```

Drops the DB, re-applies all migrations, runs seed. Never run this against prod.

## Naming conventions

- Migration names describe the intent: `add_provider_inactive_reason`, not `update`.
- Only one purpose per migration — no multi-topic catch-alls.
- If a migration is risky (drops a column, rewrites data), split into: additive migration → code deploy → cleanup migration.

## PHI fields

PHI encryption happens at the application layer, not in the database. When you add a PHI field to `schema.prisma`:

1. Note it with a `// PHI: encrypted at application layer` comment.
2. In the service that writes it, call `encrypt()` from `src/lib/encryption.ts`.
3. On read, call `decrypt()` where you need plaintext.
4. Add test coverage in `tests/unit/lib/encryption.test.ts` and any service-level integration test.
5. Extend the `redactForLog` list and the `pino` redaction path if the new field ever reaches a logger.

Do not rely on Postgres encryption; use it as defense-in-depth only.

## Indexing

- Add indexes for every foreign key used in a join.
- Add composite indexes for common filter combinations (e.g., `@@index([status, primarySpecialistId])` on `Provider`).
- Avoid redundant indexes; check `pg_stat_user_indexes` in staging before adding.

## Soft deletes

Most entities are hard-deleted intentionally. Audit entries are retained separately. A few entities use soft delete (`deletedAt`) — see individual model comments. Do not add a new soft-delete column without discussion.

## Transactions

Multi-step mutations must run in `db.$transaction(...)`. Examples:

- Create a document + add to checklist
- Advance a provider status + write an audit entry
- Roster submission: CSV + acknowledgement record + state transitions

See [trpc.md](trpc.md) for the recommended service-layer pattern.

## Seed data

`prisma/seed.ts` creates:
- All provider types
- An admin user + specialist + committee member
- A handful of synthetic providers in different states
- One committee meeting
- A mock enrollment per delegated payer

Never include real PHI in seed data. Use the `@faker-js/faker` package for plausible but synthetic values.

## Gotchas

- Do not edit a committed migration SQL file after deploy; write a follow-up migration instead.
- `prisma migrate reset` is destructive — it is gated by `NODE_ENV !== 'production'`, but still verify.
- On Windows, line endings in `migration.sql` should be LF; the `.gitattributes` enforces this.
