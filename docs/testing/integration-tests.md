# Integration Test Plan

## Scope

Exercise real code paths through real infrastructure inside a single process. Test files bring up a real Postgres (via Testcontainers) and a local Redis. External HTTP dependencies are mocked with MSW.

## Required coverage

### tRPC routers

For every router procedure, at minimum:

- Unauthenticated caller receives `UNAUTHORIZED`.
- Authenticated caller with wrong role receives `FORBIDDEN`.
- Authenticated caller with right role receives the expected shape.
- Invalid input receives `BAD_REQUEST` with field-level errors.
- Server error path returns `INTERNAL_SERVER_ERROR` and records a trace.

### API routes

Public REST v1 and FHIR endpoints:

- Missing API key → 401 with standard error body.
- Invalid API key → 401.
- Valid key, insufficient scope → 403.
- Valid key → 200 with documented response shape.
- PHI never present in the response (enforced by schema assertion).
- Rate limit headers present and accurate.
- Audit entry written with correct fields.

### Document upload/download

- Provider token uploads a document → stored in blob, DB row created, uploaderType=PROVIDER.
- Provider token cannot upload to another provider's folder (IDOR closed).
- Staff session downloads a document → 302 to SAS URL, audit entry written.
- Provider token downloads only their own documents.
- SAS URL expires and returns 403 from blob after TTL.

### Bot lifecycle

- License bot happy path: job enqueued → BotRun RUNNING → COMPLETED → VerificationRecord created → document stored.
- Bot REQUIRES_MANUAL: status set, no auto-completion, no VerificationRecord.
- Bot failure: retries per policy, final state FAILED, audit entry.
- Sanctions-recheck job: skips provider checked within 24h; runs for provider last checked >24h ago.

### Recredentialing

- Starting a cycle creates the correct child objects (abbreviated app, doc requests, bot requests).
- Overdue detection picks up providers past their cycle.
- Committee approval flows into payer refresh.

### Roster generation

- Monthly roster includes only active, delegated providers.
- CSV format validates against the payer's schema.
- Submission records the filename, hash, and timestamp.

### Encryption at rest

For each PHI field:

- Writing plaintext via the service yields ciphertext in the DB.
- Reading through the service decrypts correctly.
- Direct DB read shows `looksLikeCiphertext(value) === true`.

### Audit

- Every documented audit-logged operation produces an entry with correct actor, action, target, timestamp, and snapshot.
- Reading the audit log requires the expected role.
- The HMAC chain remains valid across inserts.

## Harness

`tests/integration/setup.ts`:

- Starts a Postgres container (Testcontainers).
- Applies Prisma migrations via `migrate deploy`.
- Seeds minimal reference data (provider types, payers, roles).
- Starts a worker with in-process BullMQ pointing to an isolated Redis DB index.
- Exports `withDb(fn)` that wraps in a transaction rolled back after the test.

## Running

```bash
npm run test:integration
npm run test:integration -- --ui   # vitest UI
```

## CI

Integration tests run in a separate job after unit tests. Coverage is combined into a single report and enforced against the unit-level floors.

## Anti-patterns

- No sleeping; use polling with a deadline.
- No test-to-test ordering dependencies.
- No hardcoded IDs; use seeds or generators.
- No `afterAll` global cleanup that masks leaks; each test must leave DB state consistent.
