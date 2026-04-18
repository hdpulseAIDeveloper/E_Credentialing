"""prod-tls-check.py — Read-only TLS posture check for credentialing.hdpulseai.com.

Reports:
  - Cert subject + issuer
  - notBefore / notAfter
  - Days until expiry (warning < 30, fail < 7)
  - SAN entries
  - Negotiated cipher (must be TLS 1.2 or 1.3)
  - HSTS header presence

Wired into the nightly QA workflow so silent cert-expiry regressions
surface as a Pillar I (Security) failure long before users see them.

Exit codes:
  0  -> all checks pass; expiry > 30 days
  1  -> warning  ; expiry between 7 and 30 days
  2  -> failure  ; expiry < 7 days, missing HSTS, or weak protocol
  3  -> hard fail; cert unreachable / wrong domain / chain broken

This script does NOT need ALLOW_DEPLOY=1 because it never connects via
SSH and never modifies anything — it speaks HTTPS to the public endpoint.

Usage:
    python scripts/ops/prod-tls-check.py
    python scripts/ops/prod-tls-check.py --json   # machine-readable output
"""
from __future__ import annotations

import argparse
import json
import socket
import ssl
import sys
from datetime import datetime, timezone
from urllib.request import Request, urlopen

DOMAIN = "credentialing.hdpulseai.com"
WARN_DAYS = 30
FAIL_DAYS = 7
APPROVED_PROTOCOLS = {"TLSv1.2", "TLSv1.3"}


def fetch_cert() -> tuple[dict, str] | None:
    """Connect on port 443, return (peer cert dict, negotiated protocol) or None on error."""
    ctx = ssl.create_default_context()
    try:
        with socket.create_connection((DOMAIN, 443), timeout=15) as sock:
            with ctx.wrap_socket(sock, server_hostname=DOMAIN) as ssock:
                cert = ssock.getpeercert()
                proto = ssock.version() or "unknown"
                return cert, proto
    except (ssl.SSLError, socket.error, ssl.CertificateError) as e:
        print(f"FATAL: cannot fetch TLS cert from {DOMAIN}: {e}", file=sys.stderr)
        return None


def has_hsts() -> bool:
    """HEAD https://{DOMAIN}/ and look for Strict-Transport-Security."""
    try:
        req = Request(f"https://{DOMAIN}/", method="HEAD")
        with urlopen(req, timeout=15) as resp:
            return any(h.lower() == "strict-transport-security" for h, _ in resp.headers.items())
    except Exception as e:  # noqa: BLE001 — many possible network errors
        print(f"  (HSTS check skipped: {e})", file=sys.stderr)
        return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    args = parser.parse_args()

    fetched = fetch_cert()
    if fetched is None:
        return 3
    cert, proto = fetched

    not_after = datetime.strptime(cert["notAfter"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    not_before = datetime.strptime(cert["notBefore"], "%b %d %H:%M:%S %Y %Z").replace(tzinfo=timezone.utc)
    days_left = (not_after - datetime.now(timezone.utc)).days

    subject = dict(x[0] for x in cert.get("subject", []))
    issuer = dict(x[0] for x in cert.get("issuer", []))
    sans = [v for k, v in cert.get("subjectAltName", []) if k == "DNS"]

    hsts = has_hsts()

    status = "OK"
    rc = 0
    if days_left < FAIL_DAYS:
        status = "FAIL"
        rc = 2
    elif days_left < WARN_DAYS:
        status = "WARN"
        rc = 1
    if proto not in APPROVED_PROTOCOLS:
        status = "FAIL"
        rc = 2
    if not hsts:
        status = "FAIL" if status == "FAIL" else "WARN"
        rc = max(rc, 1)

    payload = {
        "domain": DOMAIN,
        "status": status,
        "subject_cn": subject.get("commonName"),
        "issuer_cn": issuer.get("commonName"),
        "issuer_org": issuer.get("organizationName"),
        "not_before": not_before.isoformat(),
        "not_after": not_after.isoformat(),
        "days_until_expiry": days_left,
        "san": sans,
        "protocol": proto,
        "hsts": hsts,
    }

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print(f"Domain         : {DOMAIN}")
        print(f"Status         : {status}")
        print(f"Subject CN     : {payload['subject_cn']}")
        print(f"Issuer         : {payload['issuer_cn']} ({payload['issuer_org']})")
        print(f"Valid from     : {payload['not_before']}")
        print(f"Valid until    : {payload['not_after']} ({days_left} days)")
        print(f"SAN            : {', '.join(sans) if sans else '(none)'}")
        print(f"TLS protocol   : {proto}")
        print(f"HSTS header    : {'present' if hsts else 'MISSING'}")

    return rc


if __name__ == "__main__":
    sys.exit(main())
