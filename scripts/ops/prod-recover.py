"""prod-recover.py — Clear B-001 (stuck `docker compose up --build` on prod).

Symptom (from docs/status/blocked.md B-001):
    All SSH channels to 69.62.70.191 time out; prior `docker compose up --build`
    PID 4656 appears stuck. No further deploy attempts will be made from this
    session until the server is confirmed idle.

Recovery sequence:
  1. Kill any docker / compose / npm / next process older than 60 minutes.
  2. Force-remove the named ecred-* containers (compose tracks them by name).
  3. Tear down the compose stack with --remove-orphans.
  4. Prune dangling images so the next build does not race a half-baked layer.
  5. Restart the stack.
  6. Verify both containers report Up status; show last 30 lines of each log.

Idempotent. Safe to re-run. Does NOT trigger a fresh build/deploy — that
is the operator's call (separate `python .claude/deploy.py`) once they
confirm the server is healthy.

Usage:
    $env:ALLOW_DEPLOY = "1"; python scripts/ops/prod-recover.py
"""
from __future__ import annotations

import sys

from _lib import (
    APP_PATH,
    COMPOSE_FILE,
    WEB_CONTAINER,
    WORKER_CONTAINER,
    banner,
    require_allow_deploy,
    run_many,
)


def main() -> int:
    require_allow_deploy("prod-recover.py")
    banner("B-001 prod recovery")

    commands = [
        # 1. Kill stuck long-running build processes (older than 60 min).
        #    Use `ps -eo pid,etimes,cmd` to get elapsed seconds; pkill -9
        #    anything matching docker-buildx, npm, or next that has been
        #    running over 3600s. Tolerant of "no matches".
        (
            "ps -eo pid,etimes,cmd --no-headers "
            "| awk '$2 > 3600 && ($3 ~ /docker-buildx|^npm|^node.*next|docker compose/) { print $1 }' "
            "| xargs -r kill -9 || true",
            30,
            False,
        ),
        # 2. Force-remove the named compose-managed containers.
        (
            f"docker rm -f {WEB_CONTAINER} {WORKER_CONTAINER} 2>/dev/null || true",
            60,
            False,
        ),
        # 3. Tear down the compose stack and any orphans/networks.
        (
            f"cd {APP_PATH} && docker compose -f {COMPOSE_FILE} down --remove-orphans",
            120,
            False,
        ),
        # 4. Prune dangling images.
        ("docker image prune -f", 120, False),
        # 5. Restart without --build (operator runs `.claude/deploy.py` for a fresh build).
        (
            f"cd {APP_PATH} && docker compose -f {COMPOSE_FILE} up -d",
            300,
            True,
        ),
        # 6. Verify health.
        (
            f"cd {APP_PATH} && docker compose -f {COMPOSE_FILE} ps",
            30,
            True,
        ),
        (f"docker logs --tail 30 {WEB_CONTAINER} 2>&1 || true", 30, False),
        (f"docker logs --tail 30 {WORKER_CONTAINER} 2>&1 || true", 30, False),
    ]

    rc = run_many(commands)
    if rc != 0:
        print(
            "\nB-001 NOT cleared. Inspect the output above; common causes:\n"
            "  - Disk full (df -h)\n"
            "  - Port collision on 6015/6025 (ss -tlnp)\n"
            "  - Postgres / Redis container missing (docker ps --filter name=supabase_db)\n",
            file=sys.stderr,
        )
        return rc

    banner("B-001 cleared. Run python .claude/deploy.py for a fresh build/deploy.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
