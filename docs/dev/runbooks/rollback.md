# Runbook: Rollback a deploy

A full DB rollback is risky; the strategy is **forward-only**: pin the application to the previous tag while you develop a fix.

## Procedure

### 1. Identify the last good tag

Either the tag you deployed before the bad one, or the last green tag in CD history:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "cd /var/www/E_Credentialing && git tag --sort=-committerdate | head -5"
```

### 2. Check out and redeploy

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "cd /var/www/E_Credentialing && git fetch origin --tags && git checkout <last-good-tag>"
ALLOW_DEPLOY=1 python .claude/deploy.py "cd /var/www/E_Credentialing && docker compose -f docker-compose.prod.yml up -d --build --force-recreate"
```

### 3. Verify schema compatibility

If the bad deploy included a migration, the DB now has schema the previous code may or may not handle. Two cases:

- **Additive migration (new column)** — previous code ignores it. Safe to run.
- **Destructive migration (dropped column)** — previous code may reference the missing column. In this case you MUST also roll back the schema via a compensating migration written fresh. **Do not try to reverse the migration SQL manually.**

If the migration was destructive, instead of rolling back the app, write a new migration that restores the schema shape (or at least adds the missing columns back as nullable). Deploy the new migration on the current (bad) app version, then roll back the app.

### 4. Notify

- Post in `#incidents` channel what you did and why.
- Open a ticket to develop a proper fix for the bad deploy.
- Tag the rolled-back commit so it's not accidentally re-deployed.

## Validation

- `curl https://credentialing.hdpulseai.com/api/health` returns 200.
- Staff confirm the failing feature now works (or is absent as expected).

## Prevention

- Ship small PRs.
- Always run E2E on staging before tagging.
- Treat any destructive migration as a two-step change (deprecate → remove) spread across two releases.
