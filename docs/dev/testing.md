# Testing

Three layers:

| Layer | Framework | Location | What it covers |
|-------|-----------|----------|----------------|
| Unit | Vitest + jsdom/node | `tests/unit/` | Pure functions and small components |
| Integration | Vitest + testcontainers | `tests/integration/` | Services with real Postgres + Redis |
| End-to-end | Playwright | `tests/e2e/` | User journeys across the running app |

## Running

```bash
npm run typecheck        # TypeScript compile check
npm run lint             # ESLint
npm run test             # All unit + integration Vitest tests
npm run test:watch       # Watch mode
npm run test:coverage    # Generate coverage to ./coverage (HTML + LCOV)
npm run test:e2e         # Playwright against http://localhost:6015
npm run test:e2e:ui      # Playwright UI mode
```

## Coverage gates

`vitest.config.ts` enforces:

- Lines: 60%
- Functions: 50%
- Branches: 50%
- Statements: 60%

These are starting floors — they rise over time. Bumping them down requires a note in the PR.

## Unit tests

- Mirror `src/` structure under `tests/unit/`.
- No I/O. Mock external dependencies with `vi.mock`.
- Run in < 5 ms per test on average.

Prefer pure functions in `src/lib/` — they are the easiest to unit test and the test suite rewards this shape.

## Integration tests

- One Postgres per test file (via `@testcontainers/postgresql`).
- Apply migrations with `prisma migrate deploy` inside the container.
- Wrap each test in a transaction that rolls back at the end.

Example:

```ts
import { withDb } from "@tests/support/db";

test("creates a provider", async () => {
  await withDb(async (db) => {
    const svc = providerService(db);
    const p = await svc.create(ctx, input);
    expect(p.id).toBeDefined();
  });
});
```

## E2E tests

- Playwright with `chromium` and `firefox` projects.
- `baseURL` = `http://localhost:6015` by default; override via `E2E_BASE_URL`.
- Auth setup uses `storageState`: one signed-in staff fixture, one provider-token fixture, saved to `tests/e2e/.auth/`.
- Parallel-safe: every test seeds its own provider id-space.

Key flows covered (see [testing](../testing/e2e-plan.md) for full list):

- Staff signin and dashboard load
- Provider invite → save-section → attest
- Document upload and download via SAS
- Trigger a bot (stubbed worker) → see status update
- Committee meeting creation and decision
- Roster generation and submit
- Custom report build and export

## Accessibility

`@axe-core/playwright` runs on every E2E page navigation:

```ts
import AxeBuilder from "@axe-core/playwright";

const results = await new AxeBuilder({ page }).analyze();
expect(results.violations).toEqual([]);
```

Failures block the merge.

## Storybook + test-runner

Storybook stories live alongside components (`Component.stories.tsx`). The Storybook test-runner executes each story in a headless browser and runs:

- Accessibility checks (axe)
- Visual regression (Chromatic or Playwright screenshots — choose one per story)

## Contract tests (API)

We keep a set of OpenAPI + FHIR conformance tests under `tests/integration/api/`. They:

- Validate every public v1 response against the OpenAPI schema.
- Validate every FHIR response against the `Bundle.Practitioner` profile.

Break one of these tests and the API change needs a documentation update in `docs/api/`.

## Load tests

`tests/load/` contains k6 scripts for the public REST and FHIR endpoints. Run against a dedicated perf environment, not prod. Targets:

- REST v1: p95 < 200ms at 50 RPS
- FHIR: p95 < 400ms at 20 RPS

## Flaky-test policy

- No test may be marked `.skip` or `.fixme` in `main` without an open ticket.
- If a test is flaky (fails intermittently), open a ticket labeled `flake` and either fix within 1 sprint or quarantine with `test.fixme`.

## PR requirements

A PR must:

- Include new tests for new behavior.
- Not reduce coverage below current floors.
- Pass `npm run test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint` locally and in CI.

The PR template captures this checklist.
