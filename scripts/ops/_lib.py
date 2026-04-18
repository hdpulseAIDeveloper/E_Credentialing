"""Shared paramiko helpers for the scripts/ops/ Python toolkit.

Every prod-ops script imports from here so the SSH-connection contract,
ALLOW_DEPLOY guard, and output formatting stay consistent. This module
mirrors the safety guarantees of `.claude/deploy.py`.
"""
from __future__ import annotations

import io
import os
import sys
from typing import Iterable

import paramiko

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

SERVER = "69.62.70.191"
USER = "hdpulse2000"
PASSWORD = "HDPulseVPS((()))"
APP_PATH = "/var/www/E_Credentialing"
COMPOSE_FILE = "docker-compose.prod.yml"
WEB_CONTAINER = "ecred-web-prod"
WORKER_CONTAINER = "ecred-worker-prod"


def require_allow_deploy(script_name: str) -> None:
    """Abort with exit code 2 unless ALLOW_DEPLOY=1 is set.

    Mirrors the guard in `.claude/deploy.py`. This is the single mechanism
    that prevents an agent session from accidentally touching prod.
    """
    if os.environ.get("ALLOW_DEPLOY") != "1":
        print(
            f"ERROR: {script_name} refuses to run without ALLOW_DEPLOY=1.\n"
            f"       Set the env var explicitly when you intend to touch production.\n"
            f"       PowerShell:  $env:ALLOW_DEPLOY = \"1\"; python scripts/ops/{script_name}\n"
            f"       Bash:        ALLOW_DEPLOY=1 python scripts/ops/{script_name}",
            file=sys.stderr,
        )
        sys.exit(2)


def connect() -> paramiko.SSHClient:
    """Open a paramiko SSH connection with retries and generous timeouts.

    Mirrors `.claude/deploy.py::_connect`. Three attempts at 60s each, so
    a transient network blip does not surface as a fake-fatal error to the
    operator.
    """
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    last_err: Exception | None = None
    for attempt in range(1, 4):
        try:
            client.connect(
                SERVER,
                username=USER,
                password=PASSWORD,
                timeout=60,
                banner_timeout=60,
                auth_timeout=60,
                look_for_keys=False,
                allow_agent=False,
            )
            return client
        except Exception as e:  # noqa: BLE001 — paramiko surfaces several types
            last_err = e
            print(f"  ssh connect attempt {attempt}/3 failed: {e}", file=sys.stderr)
    assert last_err is not None
    raise last_err


def run(client: paramiko.SSHClient, cmd: str, timeout: int = 600, fatal: bool = True) -> tuple[int, str, str]:
    """Run one command on the open SSH session. Returns (exit_code, stdout, stderr).

    Prints the command and the streamed output. If fatal=True and the command
    exits non-zero, the calling script should propagate the exit code.
    """
    print(f">>> {cmd}")
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode(errors="replace").strip()
    err = stderr.read().decode(errors="replace").strip()
    exit_code = stdout.channel.recv_exit_status()
    if out:
        print(out)
    if err:
        print(f"STDERR: {err}", file=sys.stderr)
    if exit_code != 0:
        print(f"EXIT CODE: {exit_code}")
        if fatal:
            print(
                f"\nFATAL: command failed with exit {exit_code}. Aborting.",
                file=sys.stderr,
            )
    print()
    return exit_code, out, err


def run_many(commands: Iterable[tuple[str, int, bool]]) -> int:
    """Run a sequence of (cmd, timeout_sec, fatal) tuples on a fresh client.

    Returns 0 if every command finished cleanly (or every fatal command did).
    Returns the first failing exit code otherwise. Always closes the SSH
    client at the end.
    """
    client = connect()
    failure = 0
    try:
        for cmd, timeout, fatal in commands:
            exit_code, _, _ = run(client, cmd, timeout=timeout, fatal=fatal)
            if exit_code != 0 and fatal:
                failure = exit_code
                break
    finally:
        client.close()
    return failure


def banner(title: str) -> None:
    """Print a clearly-formatted section banner so script output is scannable."""
    line = "=" * max(40, len(title) + 8)
    print(line)
    print(f"=== {title} ===")
    print(line)
    print()
