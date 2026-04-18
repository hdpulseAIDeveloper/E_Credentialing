# Release runbook

This runbook covers the routine production release for the
ESSEN Credentialing Platform. For an emergency rollback, see
[rollback.md](./rollback.md). For migration failures during the
release window, see [migration-failure.md](./migration-failure.md).

## Pre-flight (T minus 30 minutes)

1. Confirm `master` is green: PR checks all passing, nightly Pillar
   suite green within the last 24h. Reference: `docs/qa/STANDARD.md`
   §3 headline reporting rule.
2. Confirm the operator's deploy window is open (no scheduled demo,
   no compliance audit in flight).
3. Run `python scripts/ops/prod-env-doctor.py` (read-only) to confirm
   the production env-var posture is intact.
4. Run `python scripts/ops/prod-tls-check.py` to confirm TLS expiry
   is more than 14 days out.
5. Confirm the change log entry exists. See
   [pm/change-log-policy.md](../../pm/change-log-policy.md).

## Release (T minus 0)

1. SSH to the production host with `ALLOW_DEPLOY=1` set.
2. `git pull origin master` on the production checkout.
3. `docker compose pull && docker compose up -d --build`.
4. Watch `docker compose logs -f --tail=200 ecred-web ecred-worker`
   for `Listening on :3000` and the worker's `BullMQ ready` line.
5. Smoke check:
   - `curl -fsS https://credentialing.hdpulseai.com/api/health`
   - `curl -fsS https://credentialing.hdpulseai.com/api/ready`
6. If migrations were included in this release, run
   `python scripts/ops/prod-migrate-bootstrap.py` after the new
   container is up.

## Post-flight (T plus 15 minutes)

1. Confirm the nightly QA gate's "first run after release" is green.
2. Update the change log with the deployed git SHA and the smoke
   results.
3. Notify the team in `#ecred-ops` Slack channel.

## Failure modes

If any step fails:

- **Container fails to start:** see
  [web-start-failure.md](./web-start-failure.md).
- **Migration fails partway:** see
  [migration-failure.md](./migration-failure.md).
- **Smoke checks fail after the new container is up:** roll back per
  [rollback.md](./rollback.md).
- **TLS expired silently:** run
  `python scripts/ops/prod-tls-bootstrap.py` (Wave 0 toolkit).
