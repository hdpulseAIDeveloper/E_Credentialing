# ADR 0014 — Multi-tenancy shim (single-DB, organization-scoped, opt-in middleware)

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Engineering (autonomous lock-in per user directive 2026-04-18)
**Related:** Wave 5.1 in [`unblock_+_commercialize_ecred_9d024374.plan.md`](../../../.cursor/plans/unblock_+_commercialize_ecred_9d024374.plan.md)

## Context

The platform currently serves a single tenant: Essen Medical Services.
The commercial roadmap requires multi-tenancy so we can sell the CVO
platform to other health systems and IPA / MSO buyers. Three classic
approaches:

1. **Database-per-tenant.** Strongest isolation, hardest ops.
2. **Schema-per-tenant.** Medium isolation, medium ops; awkward with
   Prisma migrations.
3. **Row-per-tenant (shared schema, `organizationId` column).**
   Weakest isolation by default, easiest ops, requires
   defense-in-depth at the query layer.

All three are valid. The user authorized the engineering team to
choose. The constraint is "ship now without forking the codebase
into two products" — i.e., today's single-tenant deploys must keep
working unchanged.

## Decision

Adopt **option 3 with two strict guardrails**:

### Guardrail A — `organizationId` is mandatory on every PHI-bearing model

Add `organizationId String` (not nullable) to every Prisma model that
holds PHI or business-critical state: `Provider`, `Document`,
`AuditLog`, `BotRun`, `NcqaCriterionAssessment`, `OppeReport`,
`PeerReview`, every `*Verification` table, every `*Sanction*` table,
every `Recredentialing*` table, plus the `User` table.

For the single-tenant baseline we backfill every existing row with a
constant `org_essen` literal. New tenants get a freshly minted UUID.
A new `Organization` table holds tenant metadata (name, plan,
created date, billing customer id).

### Guardrail B — Tenant-aware Prisma middleware

Add a Prisma client extension at `src/server/db/tenant-extension.ts`
that automatically `where`-injects `organizationId = ctx.organizationId`
on every read/update/delete and `data`-injects it on every create.
The extension reads the tenant id from a per-request AsyncLocalStorage
that's populated by the Next.js middleware after auth. Bypassing it
requires importing a `dangerouslyBypassTenantScope` helper that's
ESLint-blocked outside `src/server/db/internal/`.

### Why row-per-tenant + middleware (and not full DB-per-tenant)

- Today's customer pipeline tops out at ~12 organizations in year 1.
  Spinning up 12 Postgres databases costs more in ops than the
  marginal isolation buys us.
- Auditor packages need cross-tenant comparisons (anonymized) for the
  pricing-tier analytics, which is much harder against 12 separate
  DBs.
- Backups + Prisma migrations stay one-per-cluster — the operational
  win is large.
- The middleware-injection pattern is well-understood (Linear,
  PlanetScale, and Vercel all use variants); a future migration to
  schema-per-tenant or DB-per-tenant remains possible and is mostly
  a `WHERE` → `USE SCHEMA` rename.

## Consequences

- **+** Single-tenant deploys keep working: the middleware no-ops if
  `organizationId` is unset (single-tenant mode flag in `src/env.ts`).
- **+** Forward-compatible with the FHIR R4 directory endpoints, which
  already filter by Organization.
- **+** Testable: the middleware has its own pillar (Pillar Q —
  Tenancy) in the QA standard and one Playwright spec asserts that a
  user from `org_a` literally cannot read or mutate `org_b`'s rows.
- **−** Every PHI model gets an extra column + index. ~15 tables, ~120
  ms of migration time on prod data. Acceptable.
- **−** A bug in the middleware can silently leak data — that's why
  Guardrail B is enforced in code (the `dangerouslyBypass…` symbol)
  and in CI (ESLint rule + a Pillar Q spec that runs as a hard fail).

## Implementation order

1. **W5.1.a** — schema migration (`organizationId` on every model + `Organization` table).
2. **W5.1.b** — backfill migration sets `organizationId = 'org_essen'` on every existing row.
3. **W5.1.c** — `src/server/db/tenant-extension.ts` middleware.
4. **W5.1.d** — `src/middleware.ts` populates the AsyncLocalStorage from the auth session.
5. **W5.1.e** — Pillar Q tests in `tests/e2e/tenancy/`.
6. **W5.1.f** — ESLint rule blocking `dangerouslyBypass…` outside `src/server/db/internal/`.
7. **W5.1.g** — admin UI for tenant CRUD (super-admin only).

## Alternatives considered

- **Database-per-tenant via separate Prisma clients.** Rejected for
  ops cost at our pipeline size.
- **Schema-per-tenant.** Rejected because Prisma's migrate flow does
  not natively support per-schema migrations and would require a
  custom orchestrator.
- **Postgres Row Level Security (RLS).** Tempting because the database
  enforces the boundary, but Prisma doesn't yet emit SET LOCAL hooks
  in a way that plays well with PgBouncer transaction pooling. Re-
  evaluate when Prisma 6 ships first-class RLS support.
- **Defer multi-tenancy to v2.** Rejected because the schema cost of
  adding `organizationId` after data accumulates is the entire reason
  this ADR exists — the longer we wait, the bigger the migration.

## Open questions (do not block)

- How do we surface tenant switching for staff who legitimately work
  across organizations (e.g., the Essen credentialing team that also
  runs CVO services for an affiliated IPA)? Default: a "switch
  organization" dropdown in the top-right that re-issues the session
  token.
- Do we want a global-search super-admin role? Default: yes, gated
  with a step-up MFA challenge each session.
