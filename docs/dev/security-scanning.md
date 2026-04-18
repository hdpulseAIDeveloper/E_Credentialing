# Security scanning — ZAP, gitleaks, CodeQL, dependency review

Wave 4.3 — automated security scanning for the E-Credentialing CVO
platform.

## Tools at a glance

| Tool | Trigger | Severity gate | Artifact |
| --- | --- | --- | --- |
| **CodeQL** | every push + PR | high | SARIF on the Security tab |
| **Dependency review** | PR only | high | inline PR check |
| **gitleaks** (custom config) | every push | any finding | inline PR check |
| **OWASP ZAP baseline** (passive) | push to master + weekly | high (configurable) | HTML / JSON / Markdown report |
| **OWASP ZAP active** (planned) | nightly, ephemeral env | high | HTML / JSON / Markdown report |

All checks live in `.github/workflows/security.yml`.

## gitleaks

Custom rules + allowlists in `.gitleaks.toml`:

- `ecred-encryption-key` — 32-byte base64 PHI keys
- `ecred-metrics-bearer` — Prometheus scrape bearer
- `ecred-stripe-restricted` — Stripe restricted API keys
- `ecred-azure-storage-key` — `AccountKey=…` blob URLs
- `ecred-azure-keyvault-conn` — `AZURE_CLIENT_SECRET=…`
- `ecred-jwt-private-key` — PEM private keys

Allowlists scope `.env.example`, docs, fixtures, seed data, and
locale files so the team isn't drowned in false positives.

Run locally:

```bash
gitleaks detect --config .gitleaks.toml --redact --verbose
gitleaks protect --config .gitleaks.toml --staged    # pre-commit
```

## OWASP ZAP

Two automation profiles ship under `scripts/security/`:

- `zap-baseline.yaml` — passive scan only, safe against staging.
- `zap-active.yaml` — full active probing; **only run against
  ephemeral test environments seeded with synthetic data**. Never
  point active scans at production or staging.

The CI baseline job:

1. Runs `zaproxy/action-baseline@v0.13.0` against `vars.ZAP_TARGET_URL`
   (default `https://staging.example.com`).
2. Uploads HTML/JSON/Markdown reports as artifacts.
3. Pipes the JSON report through
   `scripts/security/security-summary.ts` (with the gitleaks JSON
   when available) to produce a consolidated `security-summary.md`
   that fails the build if any finding meets the `--fail-on` floor
   (default `high`).

## security-summary CLI

`scripts/security/security-summary.ts` consolidates ZAP +
gitleaks output:

```bash
npx tsx scripts/security/security-summary.ts \
  --zap=report_json.json \
  --gitleaks=gitleaks-report.json \
  --out=security-summary.md \
  --fail-on=high
```

Severity classification (gitleaks doesn't natively expose severity):
findings tagged `phi`, `key`, `pem`, or `bearer` are `critical`;
everything else is `high`.

## Adding a new custom gitleaks rule

1. Append a `[[rules]]` block to `.gitleaks.toml` with `id`,
   `description`, `regex`, and (importantly) `tags`.
2. Add an entry under `[allowlist]` if the same pattern legitimately
   appears in fixtures.
3. Confirm `gitleaks detect --config .gitleaks.toml` is clean against
   the working tree before opening the PR.
