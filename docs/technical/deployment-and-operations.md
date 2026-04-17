# Deployment & Operations

**Audience:** DevOps, on-call engineers, release managers.

---

## 1. Environments

| Env | Host | URL | Branch / tag |
|---|---|---|---|
| Local | developer machine | http://localhost:6015 | feature branch |
| Staging | (provisioned per cycle) | https://staging.credentialing.hdpulseai.com | `master` |
| Production | VPS 69.62.70.191 | https://credentialing.hdpulseai.com | tag `vX.Y.Z` |

## 2. Production stack

- Ubuntu 22.04 LTS.
- Docker + Compose v2.
- Nginx reverse proxy + Certbot.
- Containers: `ecred-web`, `ecred-worker`, `ecred-postgres`, `ecred-redis`.
- Logs: shipped to Azure Log Analytics (planned in Phase 5).

## 3. Deploy pipeline

### Manual (current default)

1. Tag a release: `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. Run from a workstation with deploy access:

   ```bash
   ALLOW_DEPLOY=1 python .claude/deploy.py
   ```

3. Script (paramiko):
   - SSHes to VPS.
   - `git fetch && git checkout <tag>`.
   - `docker compose -f docker-compose.prod.yml build`.
   - `docker compose -f docker-compose.prod.yml up -d` (web + worker).
4. Web container `entrypoint`:
   - `prisma migrate deploy`.
   - Boot Next.js server.
5. Healthcheck `/api/ready` waits for DB + Redis + Blob; 120 s `start_period`.

### Automated (planned)

- GitHub Actions `cd-prod.yml` triggers on tag push; same script in CI.
- Approval gate before deploy.

## 4. Rollback

1. Identify the last good tag.
2. Repeat deploy with that tag.
3. If a migration is the issue, restore from snapshot per
   [dev/runbooks/db-restore.md](../dev/runbooks/db-restore.md).

## 5. Configuration

- `.env` files **not** committed. Production uses values in Key Vault loaded
  at container start by the entrypoint script.
- `.env.example` is the canonical list of variables.

## 6. Backups

- Postgres: nightly snapshot to Azure storage; 30-day retention.
- Audit chain anchor: written nightly; allows point-in-time integrity proof.
- Blob: redundant by Azure storage; provider-uploaded documents have
  immutable retention policy from Phase 4 (legal hold).
- Disaster recovery drill: quarterly per `restore-drill.md` runbook.

## 7. Monitoring

- Probes — `/api/live`, `/api/ready` polled by uptime checker.
- `/api/metrics` exposed to internal Prometheus scraper.
- Bull Board UI — `:6025/admin/queues` (admin role required).
- Audit verifier — nightly run; failure alerts on-call.

## 8. Capacity planning

- See [TRD § 12](technical-requirements.md#12-capacity-targets-current-cycle).

## 9. Change management

- Every change ships from a PR with linked Jira (or issue) ticket.
- PR template requires updated docs + tests + risk assessment.
- Production changes outside a PR require a documented incident.

## 10. Runbooks

Indexed in [dev/runbooks/README.md](../dev/runbooks/README.md). Current set:

- `db-restore.md`
- `redis-restart.md`
- `bot-failure.md`
- `key-rotation.md`
- `audit-chain-recovery.md`
- `incident-response.md`
- `release.md`
- `restore-drill.md`

## 11. Maintenance windows

- Routine: Sunday 02:00–04:00 ET. Communicated 7 days ahead.
- Emergency: announced via in-app banner and email; max 30 minutes.
