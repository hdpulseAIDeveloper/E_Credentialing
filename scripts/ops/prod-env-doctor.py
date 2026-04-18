"""prod-env-doctor.py — Verification half of B-009.

READ-ONLY. Confirms that every env var the app expects is present in the
running container, WITHOUT ever printing the value. Reports presence as
PRESENT / MISSING / EMPTY-STRING.

Background:
  /var/www/E_Credentialing/.env on prod is supposed to carry the secrets
  documented in B-009. Several of those secrets are required for features
  that fail-closed silently (e.g. AUDIT_HMAC_KEY rotation invalidates
  every audit row's chain). We need a way to verify they exist without
  ever transcribing their values into a terminal that an agent might log.

Method:
  Run a one-liner inside the web container that, for each expected name,
  checks `[ -n "$VAR" ] && echo PRESENT || echo MISSING`. Names only
  cross the SSH wire — never values.

Output groups:
  - REQUIRED         the app refuses to start without these
  - SECURITY         features fail-closed if missing
  - INTEGRATIONS     features degrade gracefully if missing
  - OBSERVABILITY    optional but commercial-grade default

Exit code 0 if every REQUIRED + SECURITY var is present; 1 otherwise.

Usage:
    $env:ALLOW_DEPLOY = "1"; python scripts/ops/prod-env-doctor.py
"""
from __future__ import annotations

import sys

from _lib import WEB_CONTAINER, banner, connect, require_allow_deploy, run

REQUIRED = [
    "DATABASE_URL",
    "REDIS_URL",
    "NEXTAUTH_SECRET",
    "NEXTAUTH_URL",
    "NEXT_PUBLIC_APP_URL",
]

SECURITY = [
    "ENCRYPTION_KEY",
    "AUDIT_HMAC_KEY",
    "AZURE_AD_TENANT_ID",
    "AZURE_AD_CLIENT_ID",
    "AZURE_AD_CLIENT_SECRET",
]

INTEGRATIONS = [
    "AZURE_BLOB_ACCOUNT_URL",
    "AZURE_BLOB_CONTAINER",
    "AZURE_KEY_VAULT_URL",
    "SENDGRID_API_KEY",
    "AZURE_COMMS_CONN_STRING",
    "TURNSTILE_SITE_KEY",
    "TURNSTILE_SECRET_KEY",
    "ICIMS_API_KEY",
]

OBSERVABILITY = [
    "SENTRY_DSN",
    "APPLICATIONINSIGHTS_CONNECTION_STRING",
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "LOG_LEVEL",
]


def check_group(client, label: str, names: list[str]) -> dict[str, str]:
    """Run one shell invocation that emits NAME=PRESENT/MISSING/EMPTY for each name."""
    print(f"[{label}]")
    script = " && ".join(
        f"echo -n '{name}='; "
        f"if [ -z \"${{{name}+x}}\" ]; then echo MISSING; "
        f"elif [ -z \"${name}\" ]; then echo EMPTY-STRING; "
        f"else echo PRESENT; fi"
        for name in names
    )
    cmd = f"docker exec {WEB_CONTAINER} sh -c \"{script}\""
    rc, out, _ = run(client, cmd, timeout=30, fatal=False)
    results: dict[str, str] = {}
    for line in out.splitlines():
        if "=" in line:
            k, v = line.split("=", 1)
            results[k.strip()] = v.strip()
    print()
    return results


def main() -> int:
    require_allow_deploy("prod-env-doctor.py")
    banner("B-009 prod environment doctor (READ-ONLY)")

    client = connect()
    try:
        required = check_group(client, "REQUIRED — startup-blocking", REQUIRED)
        security = check_group(client, "SECURITY — fail-closed if missing", SECURITY)
        integrations = check_group(client, "INTEGRATIONS — feature-degraded if missing", INTEGRATIONS)
        observability = check_group(client, "OBSERVABILITY — commercial-grade default", OBSERVABILITY)
    finally:
        client.close()

    missing_required = [k for k, v in {**required, **security}.items() if v != "PRESENT"]
    missing_optional = [k for k, v in {**integrations, **observability}.items() if v != "PRESENT"]

    print()
    print("== Summary ==")
    if missing_required:
        print(f"  REQUIRED missing: {', '.join(missing_required)}")
    else:
        print("  REQUIRED + SECURITY: all present.")
    if missing_optional:
        print(f"  Optional missing  : {', '.join(missing_optional)}")
    else:
        print("  Optional          : all present.")
    print()

    if missing_required:
        print(
            "FAIL: B-009 not closed. Add the missing secrets to "
            "/var/www/E_Credentialing/.env, then re-run.",
            file=sys.stderr,
        )
        return 1

    print("OK: B-009 verifier passes. Optional vars may still be set as features land.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
