"""prod-tls-bootstrap.py — Close B-008 (SSL for credentialing.hdpulseai.com).

Wraps the two-line incantation in CLAUDE.md into one idempotent script.
Safe to re-run; Certbot will detect an existing cert and refuse to issue
a duplicate.

Steps:
  1. Push the local nginx/credentialing.hdpulseai.com config to the server.
  2. Symlink it into sites-enabled (idempotent).
  3. Test the nginx config (`nginx -t`); abort on failure.
  4. Reload nginx so the HTTP-only vhost is live before Certbot challenges it.
  5. Run `certbot --nginx -d credentialing.hdpulseai.com --non-interactive
     --agree-tos -m ops@hdpulseai.com`.
  6. Reload nginx again so the new TLS vhost is picked up.
  7. Print expiry timestamp via the `prod-tls-check.py` logic.

Usage:
    $env:ALLOW_DEPLOY = "1"; python scripts/ops/prod-tls-bootstrap.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import paramiko

from _lib import banner, connect, require_allow_deploy, run

DOMAIN = "credentialing.hdpulseai.com"
ACME_EMAIL = "ops@hdpulseai.com"


def push_file(client: paramiko.SSHClient, local_path: Path, remote_path: str) -> None:
    """Use SFTP over the existing SSH session to push a file. Verbose."""
    print(f">>> SFTP put {local_path} -> {remote_path}")
    sftp = client.open_sftp()
    try:
        sftp.put(str(local_path), remote_path)
        print(f"    pushed {local_path.stat().st_size} bytes\n")
    finally:
        sftp.close()


def main() -> int:
    require_allow_deploy("prod-tls-bootstrap.py")
    banner(f"B-008 TLS bootstrap for {DOMAIN}")

    repo_root = Path(__file__).resolve().parents[2]
    nginx_local = repo_root / "nginx" / DOMAIN
    if not nginx_local.is_file():
        print(f"FATAL: missing local nginx config at {nginx_local}", file=sys.stderr)
        return 1

    client = connect()
    try:
        # 1. Push nginx config.
        push_file(client, nginx_local, f"/etc/nginx/sites-available/{DOMAIN}")

        # 2. Symlink into sites-enabled (idempotent).
        run(
            client,
            f"ln -sf /etc/nginx/sites-available/{DOMAIN} /etc/nginx/sites-enabled/{DOMAIN}",
            timeout=15,
            fatal=True,
        )

        # 3. Test nginx config.
        rc, _, _ = run(client, "nginx -t", timeout=15, fatal=True)
        if rc != 0:
            print("FATAL: nginx -t failed. Inspect above and fix.", file=sys.stderr)
            return rc

        # 4. Reload nginx (HTTP-only vhost live for ACME).
        run(client, "systemctl reload nginx", timeout=15, fatal=True)

        # 5. Issue / renew the cert.
        rc, _, _ = run(
            client,
            (
                f"certbot --nginx -d {DOMAIN} --non-interactive --agree-tos "
                f"-m {ACME_EMAIL} --redirect"
            ),
            timeout=180,
            fatal=True,
        )
        if rc != 0:
            print(
                "FATAL: certbot failed. Common causes: DNS not pointing at this server, "
                "port 80 blocked, or rate limit hit (5 duplicate certs / week).",
                file=sys.stderr,
            )
            return rc

        # 6. Final reload.
        run(client, "nginx -t && systemctl reload nginx", timeout=15, fatal=True)

        # 7. Report expiry.
        run(
            client,
            (
                f"echo | openssl s_client -servername {DOMAIN} -connect {DOMAIN}:443 2>/dev/null "
                "| openssl x509 -noout -dates -subject -issuer"
            ),
            timeout=30,
            fatal=False,
        )
    finally:
        client.close()

    banner(f"B-008 closed. {DOMAIN} now serves HTTPS. Verify with prod-tls-check.py.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
