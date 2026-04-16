# Deployment and Operations

## Environments

| Environment | URL | Host | DB |
|-------------|-----|------|-----|
| Dev (local) | http://localhost:6015 | Docker Desktop | `localai-postgres-1` |
| Staging | https://staging.credentialing.hdpulseai.com | Azure Container Apps (TBD) | Azure Postgres flexible |
| Prod | https://credentialing.hdpulseai.com | Linux host `69.62.70.191` | Shared `supabase_db_hdpulse2000` container |

> The long-term target is Azure Container Apps for prod. The current host is a dedicated Linux VM with `docker compose` so Essen controls the rollout timing.

## Production stack

Compose file: `docker-compose.prod.yml`. Services:

- `ecred-web-prod` (Next.js standalone) — internal `6015`, reverse-proxied by Nginx.
- `ecred-worker-prod` (BullMQ + Playwright + Bull Board) — internal `6025`.

Shared containers on the host:

- `supabase_db_hdpulse2000` — Postgres (DB `e_credentialing_db`, user `postgres`).
- Redis — via `host.docker.internal:6379`.

Networks: `supabase_network_hdpulse2000`.

Nginx site config: `nginx/credentialing.hdpulseai.com` — terminates TLS, proxies to `ecred-web-prod:6015`.

## Deploy command (CD or manual)

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py
```

Or for arbitrary SSH commands:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "cd /var/www/E_Credentialing && docker compose -f docker-compose.prod.yml ps"
```

The guard `ALLOW_DEPLOY=1` prevents accidental execution. CD sets this env explicitly.

## What the deploy does

1. SSH to the prod host.
2. `git pull` to `/var/www/E_Credentialing` (120s timeout with retry).
3. `docker rm -f ecred-web-prod ecred-worker-prod` (clears zombies).
4. `docker compose -f docker-compose.prod.yml up -d --build --force-recreate`.
5. Show `docker compose ps` output.

## First-time deploy

See the full walk-through in `CLAUDE.md` under "First-Time Production Deploy."

Summary:

1. Create database in shared Postgres.
2. Place `.env` at `/var/www/E_Credentialing/.env` with real values (DB password, NEXTAUTH_SECRET, Azure creds, ENCRYPTION_KEY).
3. `python .claude/deploy.py` to pull and build.
4. After containers start, run `prisma migrate deploy` inside the web container.
5. Seed initial data.
6. Set up nginx + Certbot.

## Post-deploy checks

- Web: `curl -fsS https://credentialing.hdpulseai.com/api/health` returns `200`.
- Worker health: `docker logs ecred-worker-prod --tail 50` shows "worker ready".
- Bull Board: from the host, `curl http://localhost:6025` (not exposed externally).
- Database: one-off `psql` from the DB container.

## Environment variables

| Var | Description | Where set |
|-----|-------------|-----------|
| `DATABASE_URL` | Postgres connection string | `.env` |
| `REDIS_URL` | Redis connection string | `.env` |
| `NEXTAUTH_URL` | Public URL (https) | `.env` |
| `NEXTAUTH_SECRET` | 32-byte base64 | Key Vault / `.env` |
| `ENCRYPTION_KEY` | 32-byte base64, PHI encryption | Key Vault / `.env` |
| `AZURE_AD_TENANT_ID` | Entra ID tenant | `.env` |
| `AZURE_AD_CLIENT_ID` | Entra ID app registration | `.env` |
| `AZURE_AD_CLIENT_SECRET` | Entra ID secret | `.env` |
| `AZURE_STORAGE_CONNECTION_STRING` | Blob storage | `.env` |
| `AZURE_KEY_VAULT_URL` | Vault endpoint for integration secrets | `.env` |
| `BOT_HEADLESS` | `true` in prod | `.env` |
| `SANCTIONS_RECHECK_DISABLED` | Turn off weekly sweep | `.env` (rarely) |
| `AUTH_LOCAL_CREDENTIALS` | Dev-only local auth | never in prod |

Sensitive vars live in Azure Key Vault and are synced into `.env` on deploy.

## Logs

- Production stdout/stderr ends up in `docker logs` and ultimately in Azure Monitor.
- `pino` produces line-per-event JSON; the Log Analytics workspace parses it.
- Audit events also log to the DB (`AuditLog`) with HMAC chain — that is the durable record.

## Scaling

- Web: stateless, can be horizontally scaled (increase replicas in compose / ACA).
- Worker: can be scaled horizontally per queue — BullMQ distributes across workers automatically. Playwright is resource-heavy (CPU + RAM for the browser).
- Postgres and Redis: vertically scaled on the shared host; production DB sits on `supabase_db_hdpulse2000`.

## Backups

- Postgres: daily logical backups via Azure Backup. Point-in-time restore capability is a prod-readiness blocker (`docs/status/blocked.md`).
- Azure Blob: geo-redundant (GRS) by default; lifecycle rules prune debug artifacts after 30 days.

## Rollback

To roll back:

```bash
# On the prod host
cd /var/www/E_Credentialing
git checkout <previous-tag>
docker compose -f docker-compose.prod.yml up -d --build --force-recreate
```

If a migration introduced schema changes, a forward-only fix is strongly preferred over a DB rollback. See [runbooks/rollback.md](runbooks/rollback.md).

## Planned: Azure Container Apps

The target long-term architecture runs web and worker on Azure Container Apps behind Azure Front Door with managed certificates, autoscaling, and managed identity for Key Vault and Blob. Infrastructure as code via Bicep in `infra/` (not yet materialized).

See [runbooks/](runbooks/) for operational playbooks.
