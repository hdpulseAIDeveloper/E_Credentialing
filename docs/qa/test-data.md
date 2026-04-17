# Test Data Plan

## Principles

- **Synthetic by default.** Real PHI never used in dev / CI / staging.
- **Deterministic in CI.** Seeds use a fixed RNG seed.
- **Realistic shapes.** NPIs valid Luhn; license numbers match state format;
  emails routable to mailtrap on staging.
- **Refreshable.** A single command rebuilds the entire test corpus.

## Seeds

`prisma/seed.ts` produces a minimal corpus (one of each entity) for local
dev and CI. Run via `pnpm prisma:seed`.

## Fixtures

Located under `test/fixtures/`:

| Fixture set | Contents |
|---|---|
| `providers/` | 100 providers across statuses |
| `documents/` | sample PDFs / JPGs (synthetic) |
| `bots/` | recorded HAR per bot |
| `sanctions/` | OIG / SAM / NY OMIG sample lists |
| `payers/` | payer + product fixtures |
| `committee/` | meeting + decision fixtures |

## Staging refresh

Staging is refreshed monthly:

1. Snapshot prod (encrypted backup).
2. Restore into a parallel DB on staging.
3. Run `scripts/anonymize.ts`:
   - Replace SSN, DOB, addresses with synthetic values keyed by a stable hash.
   - Replace provider names with a generated dataset.
   - Strip free-text fields that may contain PHI.
4. Swap the DB pointer.
5. Run `npm run audit:verify` against the new DB.

Procedure documented in [dev/runbooks/staging-refresh.md](../dev/runbooks/staging-refresh.md).

## Mocked external systems

| System | Mock |
|---|---|
| Entra ID OIDC | `next-auth/providers/credentials` test provider |
| iCIMS | local fixture + manual webhook trigger script |
| SendGrid | mailtrap on staging; in-memory in CI |
| ACS SMS | sandbox short-code |
| State boards | recorded HAR per bot |
| NPDB | recorded responses; live disabled in lower envs |
| FSMB | recorded responses; live disabled in lower envs |
| Azure DI | local fake returning canned predictions |
| Azure Blob | Azurite emulator |
| Azure Key Vault | local `.env` + dotenv guard in CI |

## Data retention

- CI ephemeral DB destroyed at the end of each job.
- Staging snapshots retained 30 days.
- UAT tickets attach screenshots only; never raw PHI.

## Generating new fixtures

- Use `faker` with the project's stable seed (`tests/utils/seedRng.ts`).
- Add a JSON or TS file under `test/fixtures/` and reference it in a service
  test. Avoid duplicating fixture data across files.
