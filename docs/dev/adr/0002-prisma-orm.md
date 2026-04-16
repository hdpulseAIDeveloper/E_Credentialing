# 0002. Prisma as the single ORM

- Status: Accepted
- Date: 2026-02-10

## Context

Raw SQL works, but the schema is large and evolving. We need strong typing, migrations, and tooling that makes review easy.

## Decision

Use Prisma for all DB access. Declare the schema in `prisma/schema.prisma` and manage migrations with `prisma migrate`. Generated client consumed from `@prisma/client`.

## Consequences

- Types flow from DB to TypeScript automatically.
- Migrations are SQL in tracked files — reviewable and auditable.
- `prisma migrate deploy` applies migrations idempotently at container start.
- Some complex queries (window functions, recursive CTEs) require `$queryRaw` with manual typing — acceptable and localized.

## Alternatives considered

- **Drizzle** — lighter, but fewer convenience features (e.g., migrations) at the time of the decision.
- **Kysely** — excellent query builder, but we still need a schema source of truth for types.
- **Raw SQL + sqlx / pg** — adds a whole layer of tooling we'd have to build.
