# Test Strategy

**Owner:** QA Lead
**Last Updated:** 2026-04-17

## Goals

1. Catch regressions before merge.
2. Verify NCQA / HIPAA / CMS-0057-F controls automatically wherever possible.
3. Maintain confidence to deploy weekly.
4. Provide an audit trail of test execution.

## Test pyramid

```
                          ┌──────────────────────┐
                          │       Manual UAT     │  ~ 20 scripted scenarios
                          │  (cred ops + execs)  │
                          └──────────────────────┘
                       ┌────────────────────────────┐
                       │       Playwright E2E       │  ~ 60 scenarios
                       │   (browser + axe a11y)     │
                       └────────────────────────────┘
                  ┌──────────────────────────────────────┐
                  │  Vitest integration (DB + Redis)     │  ~ 200 cases
                  │  via Testcontainers                  │
                  └──────────────────────────────────────┘
            ┌──────────────────────────────────────────────────┐
            │  Vitest unit + zod schema + tRPC procedure tests │  ~ 1500 cases
            └──────────────────────────────────────────────────┘
```

## Layers

### Unit
- Tooling: Vitest 1.x, msw, supertest where helpful.
- Scope: pure functions, zod schemas, formatters, mappers, tRPC procedure
  logic with mocked Prisma.
- Coverage floors (in `vitest.config.ts`): lines 60%, statements 60%,
  branches 50%, functions 50%.

### Integration
- Tooling: Vitest + Testcontainers (Postgres 16, Redis 7).
- Scope: real Prisma against an ephemeral DB; tRPC routers end-to-end with a
  test caller; bot framework against a recorded HAR fixture.
- Migrations applied per suite; data seeded from `test/fixtures/`.

### End-to-end
- Tooling: Playwright (chromium, firefox, webkit) + `@axe-core/playwright`.
- Scope: every persona's primary flow:
  - Provider intake happy path.
  - Staff: provider create → bots → committee → enroll.
  - Public REST + FHIR contract via injected API key.
  - Admin: API key creation + scope.
- Accessibility: every navigation runs an axe scan; new violations fail.

### Specialty layers
- **Bot smoke tests** — nightly job runs each bot against a sandbox URL and
  reports.
- **Audit chain verifier** — `npm run audit:verify` runs in CI and nightly.
- **Forbidden terms** — `tests/lint/forbidden-terms.test.ts` blocks reintroducing
  Socket.io and Postgres < 16.
- **Load** — k6 scripts in `tests/load/` (Phase 5 nightly).

## Environments

| Env | Purpose | Data |
|---|---|---|
| Local | dev | seeded fixtures |
| CI | gate merges | ephemeral containers |
| Staging | pre-prod sanity + UAT | redacted prod-like |
| Production | smoke after deploy | real (read-only smoke) |

## Coverage targets

| Surface | Target |
|---|---|
| tRPC procedures | 90% |
| Public REST handlers | 100% (every path) |
| FHIR endpoints | 100% (every search param) |
| Bot framework lifecycle | 100% |
| Encryption + audit modules | 100% |
| UI components | 60% (focused on logic, not pixels) |

## Test data

- Seed file `prisma/seed.ts` — minimal, deterministic.
- Fixtures under `test/fixtures/` — synthetic only; PHI generators produce
  fake but realistic-shaped data (`faker`).
- HAR files under `test/fixtures/har/` per bot.
- Anonymizer for staging refreshes — see `scripts/anonymize.ts`.

## CI pipeline

Required green for merge to `master`:

1. `pnpm typecheck`
2. `pnpm lint`
3. `pnpm test:unit -- --coverage`
4. `pnpm test:integration`
5. `pnpm test:e2e` (3 browsers in parallel)
6. `pnpm test:axe`
7. `pnpm test:forbidden`
8. `pnpm build`
9. CodeQL JS analysis (`security.yml`)

## Flaky-test policy

1. Quarantine the test (skip with TODO + ticket) within 24h.
2. Fix or remove within 1 week.
3. ≥ 2 quarantines per sprint = team-wide review.

## Release gates

- Patch → CI green + smoke against staging.
- Minor → CI green + UAT scenarios passed + accessibility baseline.
- Major → CI green + UAT + load test + sign-off from Sec & Sponsor.

## Reporting

- CI publishes coverage HTML and Playwright trace artifacts.
- Weekly QA status appended to the cross-functional status note.
- UAT outcomes recorded in `docs/testing/` Master Test Plan XLSX.
