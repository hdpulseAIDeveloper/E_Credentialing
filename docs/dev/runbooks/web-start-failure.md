# Runbook: Web container won't start

## Symptoms

- `docker ps` shows `ecred-web-prod` in restart loop.
- `docker logs ecred-web-prod` shows an error during startup.
- Production URL returns 502.

## Common causes

1. `prisma migrate deploy` failed (schema drift).
2. `.env` is missing a required var.
3. `ENCRYPTION_KEY` or `NEXTAUTH_SECRET` is wrong (decoded length).
4. Postgres or Redis unreachable.
5. Port 6015 occupied.

## Procedure

### 1. Inspect logs

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker logs ecred-web-prod --tail 200"
```

### 2. For a migration failure

Read [migration-failure.md](migration-failure.md).

### 3. For a missing env var

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-web-prod env | sort | head -60"
```

Compare against the canonical list in [../deployment.md](../deployment.md). Edit `/var/www/E_Credentialing/.env` on the host and redeploy:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py
```

### 4. For a bad key length

- `ENCRYPTION_KEY` must decode to exactly 32 bytes.
- `NEXTAUTH_SECRET` must be ≥ 32 bytes.

Validate:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-web-prod node -e \"console.log(Buffer.from(process.env.ENCRYPTION_KEY, 'base64').length)\""
```

### 5. For DB or Redis unreachable

Run the `/api/ready` endpoint probe:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "curl -s http://localhost:6015/api/ready"
```

If that fails too, the container can't talk to deps. Check:

- Is the web container on `supabase_network_hdpulse2000`?
- Is `DATABASE_URL` correct (hostname `supabase_db_hdpulse2000`)?

### 6. Port conflict

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "ss -lntp | grep 6015"
```

If another process holds 6015, stop it or change the compose port mapping. Port 6015 is reserved for this app (see `CLAUDE.md`).

## Validation

- `docker ps` shows the container running and not restarting.
- `curl https://credentialing.hdpulseai.com/api/health` returns 200.
- Staff can sign in.

## Prevention

- Never edit `/var/www/E_Credentialing/.env` without first copying it to `.env.backup`.
- Validate `.env` on staging first.
- Increase healthcheck `start_period` if migration step becomes too slow.
