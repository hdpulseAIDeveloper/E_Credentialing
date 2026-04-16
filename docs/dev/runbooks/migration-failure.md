# Runbook: Prisma migration failure at boot

## Symptoms

- `docker logs ecred-web-prod` contains:
  ```
  [entrypoint] Applying Prisma migrations...
  Error: P3009 ... migration `<name>` failed ...
  [entrypoint] prisma migrate deploy failed; container will not start.
  ```
- Container restarts in a loop.

## Procedure

### 1. Read the failure

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker logs ecred-web-prod --tail 200"
```

Identify:

- Migration name that failed
- SQL statement that failed
- Postgres error (e.g., constraint violation, column exists, etc.)

### 2. Classify

**P3009: failed migration was partially applied**
- Previous container got halfway through a migration, then crashed. Prisma sees a row in `_prisma_migrations` with status `0`.
- Fix by resolving that migration as rolled-back after repairing the DB state:
  ```
  npx prisma migrate resolve --rolled-back <name>
  ```

**P3018: applied migration failed to apply**
- A migration ran successfully elsewhere but fails here. Usually drift between environments.
- Inspect the DB schema manually; correct the state; `prisma migrate resolve --applied <name>` if the intended state matches.

**Other SQL errors**
- Unique constraint violation, missing column, etc. — typically a data issue, not a migration issue.

### 3. Temporarily unblock the app (optional)

If the migration is minor and recent, you can pin to the previous image:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "cd /var/www/E_Credentialing && git checkout <previous-tag> && docker compose -f docker-compose.prod.yml up -d --build"
```

This buys time to develop a proper fix without customer impact.

### 4. Develop a corrective migration

On a branch, open a new migration that reconciles the state. Run it against a restored copy of the prod DB on staging. Only when the entrypoint runs clean should you re-tag and deploy.

### 5. Deploy the fix

```bash
# Push the fix, let CD deploy, or manually:
git push
# CD workflow runs; watch logs
```

## Validation

- Container starts clean (migrations applied).
- `/api/ready` returns 200.
- The `_prisma_migrations` table has a success row for the new migration.

## Prevention

- Use `prisma migrate dev` locally for every schema change — never `db push` for prod-bound changes.
- Always test migrations against a copy of prod data on staging.
- Keep migrations small — one concept per file.
- Add a CI job that runs `prisma migrate diff` against staging and fails if divergence is detected.
