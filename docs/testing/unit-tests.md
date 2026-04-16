# Unit Test Plan

## Mandatory coverage

| Area | Tests |
|------|-------|
| `src/lib/encryption.ts` | round-trip, optional variants, redactForLog, looksLikeCiphertext, tamper detection, unicode |
| `src/lib/auth/provider-token.ts` | sign+verify happy path, expired, wrong type, revoked, ineligible status, DB mismatch |
| `src/lib/api/rate-limit.ts` | under limit, at limit, over limit, window reset, Retry-After header, key isolation |
| `src/lib/api/audit-api.ts` | successful write, error handling, PHI redaction |
| `src/lib/logger.ts` | PHI paths redacted (ssn, dob, address, password, auth, cookie) |
| `src/server/api/routers/*.ts` (per router) | authorized access, unauthorized access, input validation |
| `src/components/bots/BotStatusPanel.tsx` | polling interval active/inactive, trigger mutation optimistic update |
| `src/components/checklist/ChecklistPanel.tsx` | View link points to authenticated download route |
| `src/workers/bot-base.ts` | REQUIRES_MANUAL path, failure retries, success writes VerificationRecord |
| `src/workers/jobs/sanctions-monthly.ts` | skip recent checks, skip when env disabled |
| `src/server/services/*.ts` | each service method: happy path + each failure branch |

## Conventions

- One `describe` block per module being tested.
- One `it` per behavior, not per method.
- Name tests as assertions: `it("rejects a token whose provider status is TERMINATED")`.
- Use `beforeEach` sparingly; prefer per-test setup to keep tests readable.

## Mocking

- Prisma: `vi.mock("@/lib/db")` with typed mocks; prefer returning minimal plausible rows.
- Network: `msw` with rest handlers.
- Time: `vi.useFakeTimers()` for rate-limit and cadence tests.

## Property tests

Use `fast-check` for:

- `encrypt(decrypt(x)) === x` for arbitrary strings (including unicode, empty, very long).
- `redactForLog` never leaves a field it was asked to redact.
- Roster CSV generation: line count matches input cardinality.

## What NOT to unit-test

- DB constraints (integration or migration test instead).
- External API responses (contract test instead).
- Browser rendering of complex components (E2E or visual regression instead).
- Deep tRPC router branches where an integration test is more honest.

## Running

```bash
npm run test              # all
npm run test path/to/file # narrow
npm run test:watch
npm run test:coverage
```
