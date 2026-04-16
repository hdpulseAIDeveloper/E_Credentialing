# Test Strategy

## Goals

- Ship with confidence: every change is provably safe to deploy.
- Catch regressions early: unit tests run in seconds; integration tests run in CI on every PR.
- Exercise real user journeys: E2E tests validate end-to-end behavior in a browser.
- Protect PHI: tests verify encryption, redaction, and access controls.
- Satisfy compliance: tests cover NCQA-required controls (audit, retention, sanctions cadence).

## Layers

### Unit tests

**Scope**: pure functions, utilities, presentational components.
**Framework**: Vitest (node + jsdom environments).
**Location**: `tests/unit/` mirroring `src/`.
**Tooling**: `vi.mock` for dependencies, `@testing-library/react` for components, `fast-check` for property tests where appropriate.
**Rule**: no I/O. Zero network, zero DB, zero filesystem beyond fixtures.

### Integration tests

**Scope**: services, tRPC routers, API routes, worker jobs — exercised end-to-end inside the process.
**Framework**: Vitest with `@testcontainers/postgresql` and a local Redis.
**Location**: `tests/integration/`.
**Tooling**: a real Prisma client against an ephemeral Postgres. Each test file gets its own container; tests share a transactional boundary when safe.
**Rule**: no browsers. No Playwright. No external services — mock via MSW.

### E2E tests

**Scope**: real user journeys through the running app.
**Framework**: Playwright (chromium + firefox).
**Location**: `tests/e2e/`.
**Tooling**: Playwright projects, `storageState` for pre-authenticated fixtures.
**Rule**: no implementation-specific assertions (selectors); use roles and accessible names.

### Specialty layers

- **Contract tests (API + FHIR)** in `tests/integration/api/` validate responses against JSON Schema and FHIR profiles.
- **Accessibility** via `@axe-core/playwright` on every E2E page.
- **Load** with k6 against a staging environment.
- **Visual regression** for key screens (Storybook + Chromatic) — planned.

## What we test explicitly

- **PHI encryption**: every PHI field round-trips correctly, DB contains ciphertext, tamper is detected.
- **PHI redaction**: logger does not emit PHI for any known field.
- **Token handling**: provider invite tokens, API keys, session cookies — every failure mode.
- **IDOR**: provider token for one provider cannot access another provider's resources.
- **Rate limits**: limiter returns 429 after threshold, includes headers, resets correctly.
- **Sanctions cadence**: weekly sweep runs, skips recently-checked providers, respects env kill-switch.
- **Bot lifecycle**: REQUIRES_MANUAL, COMPLETED, FAILED, RETRYING transitions.
- **Audit completeness**: every mutation has a corresponding audit entry.
- **Authorization**: role-based access denies what it should deny.

## Test data

- **Synthetic**. No real PHI ever appears in tests.
- Generated via `@faker-js/faker` and curated fixtures under `tests/support/fixtures/`.
- Seed data for E2E provides known providers, users, and credentials.

## Flaky-test policy

- No `.skip` or `.fixme` on `master` without an open ticket tagged `flake`.
- Fix or quarantine within 1 sprint.
- Quarantined tests still run in a dedicated job so they don't block other merges; they must be fixed.

## Coverage tiers

| Tier | What | Floor |
|------|------|-------|
| Lines | All | 60% |
| Functions | All | 50% |
| Branches | Critical (auth, encryption, bot, audit) | 90% |
| Statements | All | 60% |

Raising the floors is preferred over adding opt-outs.

## Environment parity

CI runs:

- The same Postgres version as prod
- The same Redis version as prod
- The same Node version (22)
- The same npm version (11)

No skipping tests by OS (both Linux CI and Windows dev can run them).

## Planning

See:

- [Unit test plan](unit-tests.md)
- [Integration test plan](integration-tests.md)
- [E2E plan](e2e-plan.md)
- [Manual test plans](manual-test-plans.md) for UAT-style sign-off before major releases.
