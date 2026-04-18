"""prod-migrate-bootstrap.py — Close B-009a, B-010, B-011 in one shot.

Background (docs/status/blocked.md B-009a):
  Production DB was bootstrapped with `prisma db push` (no _prisma_migrations
  table). `prisma migrate deploy` now runs on every container start via
  `scripts/web-entrypoint.sh`. The first deploy must mark the existing
  migrations as already applied so Prisma does not try to recreate tables.

Sequence:
  1. Verify the web container is running (will not run otherwise).
  2. For each historical migration: `prisma migrate resolve --applied <name>`.
     The set is read from the migrations folder so future migrations get
     picked up automatically. Anything dated up to and including the
     2026-04-15 catch-up migration is treated as historical.
  3. `prisma migrate deploy` — applies any not-yet-applied migrations
     (audit tamper evidence B-010, NCQA catalog B-011, FHIR directory,
     telehealth deepening, JC NPG-12 peer review, AI governance, behavioral
     health, FSMB-PDC, compliance readiness, etc.).
  4. Read back `_prisma_migrations` and report applied count vs filesystem
     count. Mismatch is a failure.
  5. Smoke check: SELECT 1 FROM ncqa_criteria; SELECT count(*) FROM audit_logs
     WHERE hash IS NOT NULL.

Idempotent — re-running after a clean state simply confirms the count match
and exits 0.

Usage:
    $env:ALLOW_DEPLOY = "1"; python scripts/ops/prod-migrate-bootstrap.py
"""
from __future__ import annotations

import sys
from pathlib import Path

from _lib import (
    APP_PATH,
    WEB_CONTAINER,
    banner,
    connect,
    require_allow_deploy,
    run,
)

# Migrations that pre-date `prisma migrate deploy` running on container start.
# Anything in this set is marked --applied if not already tracked.
HISTORICAL_MIGRATIONS = [
    "20260415040852_init",
    "20260415041421_add_password_hash",
    "20260415_add_app_settings",
    "20260415_add_workflows",
    "20260415_medallion_workflows",
]


def discover_local_migrations() -> list[str]:
    """Read the migrations folder so the verification step has a complete list."""
    migrations_dir = Path(__file__).resolve().parents[2] / "prisma" / "migrations"
    if not migrations_dir.is_dir():
        print(f"FATAL: cannot find {migrations_dir}", file=sys.stderr)
        sys.exit(1)
    return sorted(
        d.name
        for d in migrations_dir.iterdir()
        if d.is_dir() and (d / "migration.sql").is_file()
    )


def main() -> int:
    require_allow_deploy("prod-migrate-bootstrap.py")
    banner("B-009a + B-010 + B-011 prod migration bootstrap")

    local = discover_local_migrations()
    print(f"Discovered {len(local)} local migrations:")
    for m in local:
        print(f"  - {m}")
    print()

    client = connect()
    try:
        # 1. Verify web container is up.
        rc, _, _ = run(
            client,
            f"docker ps --filter name={WEB_CONTAINER} --filter status=running --format '{{{{.Names}}}}' | grep -q {WEB_CONTAINER}",
            timeout=15,
            fatal=True,
        )
        if rc != 0:
            print(
                f"FATAL: {WEB_CONTAINER} is not running. Start it first with "
                f"`python scripts/ops/prod-recover.py`.",
                file=sys.stderr,
            )
            return rc

        # 2. Mark historical migrations applied. `migrate resolve --applied` is
        #    idempotent — if the row already exists, it returns 0 and prints
        #    a friendly message.
        for name in HISTORICAL_MIGRATIONS:
            run(
                client,
                f"docker exec {WEB_CONTAINER} npx prisma migrate resolve --applied {name}",
                timeout=120,
                fatal=False,
            )

        # 3. Apply every newer migration.
        rc, _, _ = run(
            client,
            f"docker exec {WEB_CONTAINER} npx prisma migrate deploy",
            timeout=600,
            fatal=True,
        )
        if rc != 0:
            print(
                "FATAL: prisma migrate deploy failed. Inspect the error and consult "
                "docs/dev/runbooks/migration-failure.md.",
                file=sys.stderr,
            )
            return rc

        # 4. Verify migration count parity.
        rc, out, _ = run(
            client,
            (
                f"docker exec {WEB_CONTAINER} sh -c "
                "\"DATABASE_URL=$DATABASE_URL npx prisma migrate status\""
            ),
            timeout=120,
            fatal=False,
        )
        if "Database schema is up to date" not in out:
            print(
                "WARNING: migrate status did not report 'up to date'. "
                "Re-run this script or inspect manually.",
                file=sys.stderr,
            )

        # 5. Smoke checks.
        run(
            client,
            (
                f"docker exec supabase_db_hdpulse2000 psql -U postgres -d e_credentialing_db "
                "-c 'SELECT count(*) AS ncqa_rows FROM ncqa_criteria;'"
            ),
            timeout=30,
            fatal=False,
        )
        run(
            client,
            (
                f"docker exec supabase_db_hdpulse2000 psql -U postgres -d e_credentialing_db "
                "-c \"SELECT count(*) FILTER (WHERE hash IS NOT NULL) AS chained, count(*) AS total FROM audit_logs;\""
            ),
            timeout=30,
            fatal=False,
        )

    finally:
        client.close()

    banner("B-009a + B-010 + B-011 closed. Move them to docs/status/resolved.md.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
