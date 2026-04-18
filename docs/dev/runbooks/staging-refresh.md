# Staging refresh runbook

Refresh the staging database with a redacted snapshot of production.
Required before a UAT cycle and after every schema change that lands
on `master`.

## Safety contract

- **NEVER copy production rows into staging without redaction.**
  The redaction step strips SSN, full DOB, raw DEA, home address, and
  every other PHI column. A failed redaction step aborts the refresh.
- The snapshot lives in Azure Blob Storage at
  `staging-snapshots/<YYYY-MM-DD>.sql.gz`. Retention 90 days.
- Approval gate: refresh requires written approval from the
  Compliance Officer for the calendar quarter.

## Procedure

1. **Snapshot prod (read-only).** From the prod ops host:
   `pg_dump --schema-only` followed by a row-by-row redacted dump
   using the redaction script `scripts/db/snapshot-redacted.sh`.
2. **Upload to blob.** The snapshot script tags the blob with the
   refresh date and the operator id.
3. **Stop staging traffic.** `docker compose stop ecred-web` on the
   staging host so no in-flight writes race the restore.
4. **Restore the redacted snapshot.** `psql -d ecred -f /tmp/staging-snapshot.sql`.
5. **Run migrations.** `docker compose run --rm ecred-web npx prisma migrate deploy`.
6. **Re-seed reference data.** `npx prisma db seed` then
   `tsx scripts/seed/extras.ts` (NCQA baseline, demo provider set, etc.).
7. **Restart staging.** `docker compose up -d ecred-web ecred-worker`.
8. **Smoke check.** Same five smoke checks as the production
   release runbook.
9. **Notify.** Email the QA lead and the Product Manager that
   staging is refreshed.

## Failure modes

- **Redaction script fails on a new column:** STOP. The snapshot is
  unsafe to restore. Fix the redaction map in
  `scripts/db/redaction-map.json` and rerun from step 1.
- **Migration fails on the snapshot:** see
  [migration-failure.md](./migration-failure.md).
- **Seed step fails:** check `prisma/seed.ts` against the snapshot's
  schema version; the snapshot may predate a new model.

## Cross-reference

- Test data shape and provenance: [../../qa/test-data.md](../../qa/test-data.md).
- Synthetic data generation (preferred over redacted prod):
  Wave 5.4 of the local "unblock + commercialize" Cursor plan.
