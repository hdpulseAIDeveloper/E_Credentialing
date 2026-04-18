# NPDB Manual Query Workflow

Until NPDB account credentials (entity code, DUNS, HIQA API authorization key) are provisioned and the automated Continuous Query implementation ships, all NPDB queries must be performed manually. This workflow is gated by the `NPDB_ENABLED` feature flag (default: `false`).

When the flag is `false`:

- The NPDB bot row in the provider's Bot Status panel shows a prominent **amber banner** explaining that NPDB is a manual workflow.
- Triggering the NPDB bot creates a `BotRun` row whose status is set to **`REQUIRES_MANUAL`** with a clear `errorMessage` directing staff to the manual procedure.
- **No fake `NPDBRecord` row is created.** This was the historical behavior that caused the platform to claim NPDB verification was complete when it was not.

## Manual Procedure (every initial application and every recredentialing cycle)

1. Navigate to [https://www.npdb.hrsa.gov/](https://www.npdb.hrsa.gov/) and sign in with the entity user account.
2. Run a **One-Time Query** for the provider using their NPI, full legal name, and date of birth.
3. If the response is **No Reports**:
   - Download the response PDF.
   - Upload to the provider record under **Documents → NPDB Report** with document type `NPDB_REPORT`.
   - Add a verification note in the provider's audit trail that the query was performed and the result was clean.
4. If the response is **Reports Found**:
   - Download the full NPDB report PDF.
   - Upload as in step 3 above.
   - **Immediately notify the credentialing manager** by creating a high-priority task on the provider record.
   - The committee dashboard will pick this up at the next session for adverse-action review.
5. **Continuous monitoring**: until automated Continuous Query is enabled, set a recurring 12-month task on every provider with a clean NPDB result so this query is repeated annually. Approved providers must additionally be enrolled in NPDB Continuous Query manually if available.

## When `NPDB_ENABLED` flips to `true`

Setting the env var to `true` without a real implementation in `src/workers/bots/npdb-query.ts` will cause the bot to **fail loudly** rather than emit a fake success. Do not flip this flag until:

- HIQA API credentials are stored in Azure Key Vault as `npdb-entity-code` and `npdb-authorization-key`.
- The HIQA XML/REST request and response parser is implemented in `npdb-query.ts`.
- The continuous query enrollment workflow is automated.
- An end-to-end integration test against the NPDB sandbox passes.

## Related code

- [src/workers/bots/npdb-query.ts](../../../src/workers/bots/npdb-query.ts) — bot implementation
- [src/components/bots/BotStatusPanel.tsx](../../../src/components/bots/BotStatusPanel.tsx) — UI banner
- [docs/archive/legacy-md/competitive-gap-analysis.md](../../archive/legacy-md/competitive-gap-analysis.md) — gap registry (P0 #1)
- `docs/planning/open-questions.md` — Q7 NPDB credentials (see `docs/planning/integrations.md`)
