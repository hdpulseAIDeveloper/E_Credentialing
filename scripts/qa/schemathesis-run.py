"""Schemathesis fuzz harness for the public REST v1 surface.

Wave 9 (2026-04-18). Drives `schemathesis run` against the OpenAPI 3.1
spec served at `/api/v1/openapi.yaml` (or `/api/v1/openapi.json`),
authenticated with a sandbox API key.

Why a script and not a CI step (yet)?
-------------------------------------
Schemathesis needs three things we don't have on every CI run:

  1. A reachable v1 surface (staging URL or local `npm run dev` target).
  2. A scoped API key (`providers:read`, `sanctions:read`,
     `enrollments:read`, `documents:read`) — see the runbook
     `docs/dev/runbooks/schemathesis-fuzz.md` and the scope catalog
     under `components.securitySchemes.BearerApiKey.x-scopes` in
     `docs/api/openapi-v1.yaml`.
  3. ~30s of wall-clock budget per endpoint family.

So we ship the harness as a one-shot script. Engineers run it locally
or against staging on demand. A future ADR may promote it into the
nightly CI pipeline once a synthetic key vending workflow exists.

Anti-weakening
--------------
- The script MUST refuse to run against the production hostname unless
  `ALLOW_SCHEMATHESIS_PROD=1` is set (defence in depth — fuzzing prod
  has obvious blast-radius concerns).
- The script MUST always pass `--checks all` so we exercise
  status-code / response-schema / content-type / response-time checks.
- Output (junit XML) MUST be written under `tests/perf/results/` so
  it's discoverable alongside the k6 baselines.

Usage
-----
PowerShell::

    $env:SCHEMATHESIS_BASE_URL = "https://staging.example.com"
    $env:SCHEMATHESIS_API_KEY = "sandbox-key-with-readonly-scopes"
    python scripts/qa/schemathesis-run.py

Bash::

    SCHEMATHESIS_BASE_URL=https://staging.example.com \
    SCHEMATHESIS_API_KEY=sandbox-key-with-readonly-scopes \
    python scripts/qa/schemathesis-run.py

Optional flags::

    --hypothesis-seed 12345    # reproducible fuzz runs
    --hypothesis-max-examples  # default 25 per endpoint
    --workers                  # default 2
"""
from __future__ import annotations

import argparse
import io
import os
import shutil
import subprocess
import sys
from pathlib import Path

# Force UTF-8 on Windows so emoji / unicode in schemathesis output never
# bricks the script with a UnicodeEncodeError.
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SPEC_PATH = REPO_ROOT / "docs" / "api" / "openapi-v1.yaml"
RESULTS_DIR = REPO_ROOT / "tests" / "perf" / "results"
JUNIT_OUT = RESULTS_DIR / "schemathesis-junit.xml"

PROD_HOSTNAMES = (
    # Add real prod hostnames here as they're commissioned. Keep this
    # list narrow — defence in depth, not a catch-all.
    "ecredentialing.example.com",
    "app.ecredentialing.com",
)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Run schemathesis against the public /api/v1 surface.",
    )
    p.add_argument(
        "--hypothesis-seed",
        type=int,
        default=None,
        help="Seed for hypothesis (reproducible fuzzing). Default: random.",
    )
    p.add_argument(
        "--hypothesis-max-examples",
        type=int,
        default=25,
        help="Max examples per endpoint (default: 25).",
    )
    p.add_argument(
        "--workers",
        type=int,
        default=2,
        help="Concurrent workers (default: 2 — keep low for shared envs).",
    )
    p.add_argument(
        "--use-served-spec",
        action="store_true",
        help=(
            "Fetch the spec from <base-url>/api/v1/openapi.yaml instead of "
            "reading the local YAML file. Useful when validating that the "
            "deployed environment is serving the right contract."
        ),
    )
    return p.parse_args()


def require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        print(
            f"ERROR: ${name} is required.\n"
            f"       Re-run after exporting it. See "
            f"docs/dev/runbooks/schemathesis-fuzz.md for examples.",
            file=sys.stderr,
        )
        sys.exit(2)
    return value


def is_prod_hostname(base_url: str) -> bool:
    lowered = base_url.lower()
    return any(host in lowered for host in PROD_HOSTNAMES)


def main() -> int:
    args = parse_args()

    base_url = require_env("SCHEMATHESIS_BASE_URL").rstrip("/")
    api_key = require_env("SCHEMATHESIS_API_KEY")

    if is_prod_hostname(base_url) and os.environ.get("ALLOW_SCHEMATHESIS_PROD") != "1":
        print(
            f"ERROR: refusing to fuzz production hostname '{base_url}'.\n"
            f"       If you really mean to do this (you almost never do), "
            f"set ALLOW_SCHEMATHESIS_PROD=1.",
            file=sys.stderr,
        )
        return 2

    if shutil.which("schemathesis") is None:
        print(
            "ERROR: 'schemathesis' is not on PATH.\n"
            "       Install it once with:\n"
            "         python -m pip install --user schemathesis\n"
            "       (Pinned version: see docs/dev/runbooks/schemathesis-fuzz.md.)",
            file=sys.stderr,
        )
        return 3

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)

    if args.use_served_spec:
        spec_target = f"{base_url}/api/v1/openapi.yaml"
    else:
        if not SPEC_PATH.exists():
            print(f"ERROR: local spec not found at {SPEC_PATH}", file=sys.stderr)
            return 4
        spec_target = str(SPEC_PATH)

    cmd = [
        "schemathesis",
        "run",
        spec_target,
        "--base-url", base_url,
        "--checks", "all",
        "--workers", str(args.workers),
        "--hypothesis-max-examples", str(args.hypothesis_max_examples),
        "--header", f"Authorization: Bearer {api_key}",
        "--junit-xml", str(JUNIT_OUT),
        "--show-errors-tracebacks",
    ]
    if args.hypothesis_seed is not None:
        cmd.extend(["--hypothesis-seed", str(args.hypothesis_seed)])

    # Don't print the bearer key.
    redacted = [c if not c.startswith("Authorization: Bearer ") else "Authorization: Bearer ***" for c in cmd]
    print(">>> " + " ".join(redacted))

    proc = subprocess.run(cmd)
    print()
    print(f"junit-xml -> {JUNIT_OUT}")
    return proc.returncode


if __name__ == "__main__":
    sys.exit(main())
