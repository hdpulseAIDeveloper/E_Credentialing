# Blocked Items — Awaiting Human Input

This file tracks work that cannot proceed without a decision, credential, or action from a person. Every entry must include: the reason it is blocked, who can unblock it, and the date it was added.

When an item is unblocked, move it to [`docs/status/resolved.md`](./resolved.md) with the resolution and date.

> **Wave 0 update (2026-04-18):** every blocker below now has either a
> one-shot resolver script under [`scripts/ops/`](../../scripts/ops/) /
> [`scripts/azure/`](../../scripts/azure/) /
> [`scripts/legal/`](../../scripts/legal/) / [`scripts/seed/`](../../scripts/seed/),
> or has been collapsed to a single yes/no decision for the named owner.
> See [resolved.md](./resolved.md) for the runbook.

---

## Active Blockers

### B-001  Production server currently unreachable (stuck docker build holding SSH channels)
- **Added:** 2026-04-16
- **Owner:** Server admin (user)
- **Detail:** All SSH channels to `69.62.70.191` time out; prior `docker compose up --build` PID 4656 appears stuck. No further deploy attempts will be made from this session until the server is confirmed idle.
- **Resolver:** [`scripts/ops/prod-recover.py`](../../scripts/ops/prod-recover.py) — `ALLOW_DEPLOY=1 python scripts/ops/prod-recover.py`. Idempotent.
- **Unblocks:** any production deploy work, post-deploy smoke tests.

### B-002  Azure Blob container privacy level
- **Added:** 2026-04-16
- **Owner:** Azure/cloud admin
- **Detail:** Documents container must be set to **Private** (no public access) so that SAS-mediated downloads are the only access path. This is a portal/CLI action outside the code. Record the container name and access tier here once set.
- **Verifier:** [`scripts/azure/verify-blob-private.ts`](../../scripts/azure/verify-blob-private.ts) — `npm run qa:azure-privacy`. Wired into the nightly Pillar P (Compliance) CI job; container public-access regressions surface as a red CI run.
- **Unblocks:** P0-6 rollout to production.

### B-003  Cloudflare Turnstile site/secret keys for provider verify form
- **Added:** 2026-04-16
- **Owner:** Security/DevOps
- **Detail:** Need `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` env vars. Used on the provider verification form and magic-link request form to throttle abuse.
- **Unblocks:** P1-6 provider-auth hardening in production (dev ships with a test key).

### B-004  Entra ID MFA policy enforcement
- **Added:** 2026-04-16
- **Owner:** Essen IT / Entra admin
- **Detail:** Staff auth is Entra-only; MFA must be enforced at the Entra tenant Conditional Access policy for users in the `ecred-staff` group. Confirm policy name and effective date.
- **Verifier:** [`scripts/ops/entra-mfa-status.py`](../../scripts/ops/entra-mfa-status.py) — `python scripts/ops/entra-mfa-status.py`. Read-only Microsoft Graph query; reports each Conditional Access policy targeting `ecred-staff` and asserts at least one enforces MFA.
- **Unblocks:** P1-6 final compliance sign-off.

### B-005  Payer portal credentials for bot automation (vault)
- **Added:** 2026-04-16
- **Owner:** Credentialing ops + Azure Key Vault admin
- **Detail:** Playwright bots for Availity, My Practice Profile, Verity, eMedNY, NPDB require usernames/passwords (and TOTP seeds for DEA). These must be stored in Azure Key Vault under the agreed naming convention (`ecred-prod-bot-<portal>-username` / `-password` / `-totp`).
- **Resolver:** Naming convention enforced at compile time via the `SECRETS` catalog in [`src/lib/secrets/index.ts`](../../src/lib/secrets/index.ts) (typo-proof; prod fail-closed unless `ALLOW_ENV_FALLBACK_IN_PROD=1`). **Single yes/no for ops:** "Have you populated the vault entries named in `SECRETS`?"
- **Unblocks:** full PSV bot runs in production (stubs in place meanwhile).

### B-006  NCQA criterion catalog content
- **Added:** 2026-04-16
- **Owner:** Credentialing compliance lead
- **Detail:** Schema and workflow will ship in P1-8, but the *content* of NCQA criteria (rows in `ncqa_criterion`) must be authored by a compliance SME with the current NCQA CVO standards in hand. Provide the spreadsheet/PDF.
- **Provisional:** [`scripts/seed/ncqa-baseline.csv`](../../scripts/seed/ncqa-baseline.csv) (`v0-public-baseline`, 30 rows covering CR-1..CR-9). Loadable via `npx tsx scripts/import-ncqa-criteria.ts scripts/seed/ncqa-baseline.csv`. Compliance dashboards have real data while the licensed standards are procured. **Single yes/no for Compliance:** "Use this baseline?"
- **Unblocks:** P1-8 populated catalog + auditor package export.

### B-007  Legal/policy text for provider-facing consent, privacy notice, attestation language
- **Added:** 2026-04-16
- **Updated:** 2026-04-17 — downgraded from "blocked on Legal authorship" to "blocked on Legal **review** of drafts".
- **Owner:** Legal + Compliance (review); Tech Writer + Tech Lead (drafts).
- **Status:** Comprehensive `v1.0-draft` copy for **Attestation, Privacy Notice, Terms of Service, Consent for PSV & Data Use, ESIGN Disclosure, Cookie & Session Notice,** and **HIPAA NPP pointer** is authored and merged under [`docs/legal/`](../legal/README.md). Each document carries a per-document review checklist for Legal. The runtime mirrors live in [`src/lib/legal/copy.ts`](../../src/lib/legal/copy.ts) (`LEGAL_COPY_VERSION = "v1.0-draft"`). The provider attestation page, the provider portal footer, and the public `/legal/{privacy,terms,cookies,hipaa}` pages all render from the canonical copy. Every attestation audit log entry records `afterState.legalCopyVersion` plus the verbatim acknowledged statements (`afterState.acknowledgements`).
- **Detail:** Legal + Compliance must work through each per-document checklist, then change the `Status:` line in each markdown file from `DRAFT` to `APPROVED`. When all documents are approved, bump `LEGAL_COPY_VERSION` from `v1.0-draft` to `v1.0` and set `LEGAL_COPY_EFFECTIVE_DATE`. No further code change is required to publish.
- **Resolver:** [`scripts/legal/build-review-packet.ts`](../../scripts/legal/build-review-packet.ts) — `npm run legal:packet`. Generates a self-contained folder with cover sheet, version table, every document rendered from the runtime constants, every source markdown verbatim, machine-readable JSON dump, and a one-page yes/no checklist. **Single yes/no for Legal:** "Sign the checklist?"
- **Unblocks:** user-facing docs (D-5) and live provider traffic. Drafts can be reviewed by Legal in parallel with development.

### B-008  SSL certificate for `credentialing.hdpulseai.com`
- **Added:** 2026-04-16
- **Owner:** Server admin
- **Detail:** Certbot provisioning must complete on the server; see one-time nginx setup block in `CLAUDE.md`. Not a code concern but needed for public launch.
- **Resolver:** [`scripts/ops/prod-tls-bootstrap.py`](../../scripts/ops/prod-tls-bootstrap.py) — pushes the local nginx config, runs `certbot --nginx`, reloads nginx. Idempotent.
- **Verifier:** [`scripts/ops/prod-tls-check.py`](../../scripts/ops/prod-tls-check.py) — read-only TLS posture (cert validity, expiry days, HSTS, protocol). Wired into nightly QA so silent expiry surfaces as a Pillar I (Security) red.
- **Unblocks:** public launch.

### B-009a  First-time `prisma migrate deploy` on existing prod DB
- **Added:** 2026-04-16
- **Owner:** Server admin + DB admin
- **Detail:** Production DB was bootstrapped with `prisma db push` (no migration
  history table). Now that `prisma migrate deploy` runs on every container
  start via `scripts/web-entrypoint.sh`, the first deploy must mark the
  existing migrations as already applied so Prisma doesn't try to re-create
  tables. Run once (any order):

  ```bash
  python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate resolve --applied 20260415040852_init"
  python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate resolve --applied 20260415041421_add_password_hash"
  python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate resolve --applied 20260415_add_app_settings"
  python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate resolve --applied 20260415_add_workflows"
  python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate resolve --applied 20260415_medallion_workflows"
  ```

  After that, `20260416120000_document_uploader_optional` (and every future
  migration) will apply cleanly. The ALLOW_DEPLOY=1 guard still applies.
- **Resolver:** [`scripts/ops/prod-migrate-bootstrap.py`](../../scripts/ops/prod-migrate-bootstrap.py) — wraps all 5 `migrate resolve --applied` calls + `migrate deploy` + parity check + smoke `SELECT count(*) FROM ncqa_criteria`. Idempotent. Also closes B-010 and B-011 in the same run.
- **Unblocks:** clean container restarts without destructive schema changes.

### B-009  Production `.env` values
- **Added:** 2026-04-16
- **Owner:** DevOps
- **Detail:** Several secrets referenced by the app are expected to live in `/var/www/E_Credentialing/.env` on the prod server: `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` (32-byte base64), `AUDIT_HMAC_KEY` (32+ character secret for audit chain integrity — NEW), Entra IDs, SendGrid key, Azure Communication Services connection string, Datadog/Sentry DSNs. Confirm each exists; document names/rotations here.
- **Verifier:** [`scripts/ops/prod-env-doctor.py`](../../scripts/ops/prod-env-doctor.py) — read-only, names only (never values), grouped REQUIRED / SECURITY / INTEGRATIONS / OBSERVABILITY. Exits 0 only when every REQUIRED + SECURITY var is PRESENT.
- **Unblocks:** production smoke test passing all feature flags on.

### B-011  Apply NCQA catalog migration on existing prod DB
- **Added:** 2026-04-16
- **Owner:** DB admin
- **Detail:** Migration `20260416140000_ncqa_catalog` adds `ncqa_criteria`,
  `ncqa_criterion_assessments`, `ncqa_compliance_snapshots` tables plus
  `NcqaCategory` and `NcqaAssessmentStatus` enums. Rolls forward cleanly on
  an empty DB. On prod, run `prisma migrate deploy` as usual; no data
  migration is required since the tables start empty. Content (rows in
  `ncqa_criteria`) is governed by B-006.
- **Resolver:** Folded into [`scripts/ops/prod-migrate-bootstrap.py`](../../scripts/ops/prod-migrate-bootstrap.py).
- **Unblocks:** compliance dashboard v2, auditor-package export.

### B-010  Apply audit tamper-evidence migration on existing prod DB
- **Added:** 2026-04-16
- **Owner:** DB admin
- **Detail:** Migration `20260416130000_audit_tamper_evidence` adds `sequence`, `previous_hash`, `hash`, `ip_address`, `user_agent`, `request_id` columns to `audit_logs` and installs triggers blocking DELETE/TRUNCATE and guarding UPDATE. Rows that pre-date the migration will have `hash IS NULL`; the verifier treats these as "not cryptographically attested" and reports counts on the compliance dashboard. Confirm whether Compliance wants a one-time backfill job to chain-hash historical rows (see ADR 0011).
- **Resolver:** Folded into [`scripts/ops/prod-migrate-bootstrap.py`](../../scripts/ops/prod-migrate-bootstrap.py). The same script reports the chained-vs-unchained row count so Compliance can decide on the optional backfill.
- **Unblocks:** clean Compliance dashboard tamper-evidence widget.

---

## Conventions

- Use ID format `B-NNN` (zero-padded). Never reuse IDs.
- Keep the oldest blocker on top of *Active Blockers*; the very first line after the header list is the newest blocker? **No** — keep chronological (oldest first).
- Anything a code change alone could fix is **not** a blocker; open a todo instead.
