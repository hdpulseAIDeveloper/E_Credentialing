# scripts/ops — Production operations toolkit

Python scripts that automate the prod-server side of every blocker in
[`docs/status/blocked.md`](../../docs/status/blocked.md) and the recovery
runbook for `B-001` (stuck docker build).

All scripts share the safety contract of [`.claude/deploy.py`](../../.claude/deploy.py):

- Connect to `69.62.70.191` via paramiko (native SSH does not work from this
  workstation per `CLAUDE.md`).
- Refuse to run unless `ALLOW_DEPLOY=1` is exported in the shell, so an
  agent session cannot accidentally touch prod.
- Print every command before running it; print every line of stdout/stderr
  back to the local terminal.
- Exit non-zero on any fatal step, with a clear hint on how to recover.

## Quick reference

| Blocker  | Script                                          | What it does                                                                                              |
| -------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| B-001    | `python scripts/ops/prod-recover.py`            | Kill the stuck `docker compose up --build` (any PID), prune dangling, restart stack, verify both web+worker healthy. |
| B-008    | `python scripts/ops/prod-tls-bootstrap.py`      | Push nginx site config, request Certbot cert, reload nginx. Idempotent.                                   |
| B-008    | `python scripts/ops/prod-tls-check.py`          | Read-only: report cert validity, expiry days, chain. Wired into nightly QA workflow.                      |
| B-009    | `python scripts/ops/prod-env-doctor.py`         | Read-only: report which expected env vars are present in `/var/www/E_Credentialing/.env`. Names only, never values. |
| B-009a   | `python scripts/ops/prod-migrate-bootstrap.py`  | First-time: mark historical migrations as applied (`prisma migrate resolve --applied …` ×5), then `prisma migrate deploy`. |
| B-010+11 | (folded into `prod-migrate-bootstrap.py`)       | Audit-tamper-evidence + NCQA-catalog migrations apply automatically once the bootstrap step lands.        |
| B-004    | `python scripts/ops/entra-mfa-status.py`        | Read-only: query Entra Conditional Access for `ecred-staff` group MFA enforcement.                        |

## Usage pattern

```powershell
# PowerShell on this workstation
$env:ALLOW_DEPLOY = "1"
python scripts/ops/prod-recover.py
```

```bash
# Bash on this workstation (or WSL)
ALLOW_DEPLOY=1 python scripts/ops/prod-recover.py
```

Without `ALLOW_DEPLOY=1` every script aborts with exit code 2 before any
SSH attempt.

## Sequencing for a clean baseline

After clearing B-001, run in this order to land everything queued under
the 2026-04-16 session rollup:

```powershell
$env:ALLOW_DEPLOY = "1"
python scripts/ops/prod-recover.py
python scripts/ops/prod-env-doctor.py            # confirm AUDIT_HMAC_KEY present
python scripts/ops/prod-migrate-bootstrap.py     # B-009a + B-010 + B-011
python scripts/ops/prod-tls-bootstrap.py         # B-008 (one-time)
python scripts/ops/prod-tls-check.py             # confirm cert valid
python scripts/ops/entra-mfa-status.py           # B-004 verification
```

Each script is idempotent and safe to re-run.
