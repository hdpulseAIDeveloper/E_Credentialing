# Database restore runbook

Restore the production database from the most recent backup. This is
a destructive procedure and is only executed during a declared
incident. Coordinate with the Incident Commander
([incident-response.md](./incident-response.md)).

## Before you run anything

- Page the on-call engineer and the Incident Commander.
- Open an incident channel in Slack and start a
  [post-incident review template](./incident-response.md).
- Confirm the backup you intend to restore: `az storage blob list
  --container backups --prefix postgres/` and pick the most recent
  `*.dump.gz` matching the recovery point objective (RPO).
- Confirm the application is fully drained: stop `ecred-web` and
  `ecred-worker` containers so no writes race the restore.

## Procedure

1. **Stop write traffic.**
   ```bash
   docker compose stop ecred-web ecred-worker
   ```
2. **Snapshot the current (broken) state** so we can compare after.
   ```bash
   pg_dump -Fc -d ecred -f /tmp/pre-restore-snapshot.dump
   ```
3. **Drop the existing database.** Confirm the database name twice.
   ```bash
   psql -d postgres -c 'DROP DATABASE ecred WITH (FORCE);'
   psql -d postgres -c 'CREATE DATABASE ecred;'
   ```
4. **Restore from the chosen backup.**
   ```bash
   gunzip -c /tmp/<chosen-backup>.dump.gz | pg_restore --dbname=ecred --jobs=4
   ```
5. **Run migrations to bring schema up to date** if the backup
   predates the current `master`:
   ```bash
   docker compose run --rm ecred-web npx prisma migrate deploy
   ```
6. **Verify the audit chain integrity.** Run
   `tsx scripts/qa/verify-audit-chain.ts` to confirm the
   tamper-evidence sequence is intact (ADR 0011).
7. **Restart traffic.**
   ```bash
   docker compose up -d ecred-web ecred-worker
   ```
8. **Smoke check.** `/api/health`, `/api/ready`, sign-in flow.
9. **Reconcile.** Compare the rebuilt state to
   `/tmp/pre-restore-snapshot.dump` and document any data loss
   between the backup point and the incident.

## Recovery point + recovery time objectives

- **RPO:** 1 hour (continuous WAL archive to Azure Blob).
- **RTO:** 30 minutes for a fresh restore on the standby host.

## Failure modes

- **Backup file corrupt:** drop back one snapshot and try again.
  All restorable backups are tested by the nightly job
  `scripts/ops/backup-verify.py` -- if that has been red, escalate
  to the platform owner.
- **Migration fails after restore:** see
  [migration-failure.md](./migration-failure.md).
- **Audit chain verification fails:** STOP. The restore landed but
  the tamper-evidence chain is broken. Page Compliance and do not
  re-open write traffic until the chain is repaired.

## Cross-reference

- Backup verification job: `scripts/ops/backup-verify.py`.
- Audit chain integrity: [../adr/0011-audit-tamper-evidence.md](../adr/0011-audit-tamper-evidence.md).
