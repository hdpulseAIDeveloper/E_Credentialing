# Blocked Items — Awaiting Human Input

This file tracks work that cannot proceed without a decision, credential, or action from a person. Every entry must include: the reason it is blocked, who can unblock it, and the date it was added.

When an item is unblocked, move it to `docs/status/resolved.md` (create as needed) with the resolution and date.

---

## Active Blockers

### B-001  Production server currently unreachable (stuck docker build holding SSH channels)
- **Added:** 2026-04-16
- **Owner:** Server admin (user)
- **Detail:** All SSH channels to `69.62.70.191` time out; prior `docker compose up --build` PID 4656 appears stuck. No further deploy attempts will be made from this session until the server is confirmed idle.
- **Unblocks:** any production deploy work, post-deploy smoke tests.

### B-002  Azure Blob container privacy level
- **Added:** 2026-04-16
- **Owner:** Azure/cloud admin
- **Detail:** Documents container must be set to **Private** (no public access) so that SAS-mediated downloads are the only access path. This is a portal/CLI action outside the code. Record the container name and access tier here once set.
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
- **Unblocks:** P1-6 final compliance sign-off.

### B-005  Payer portal credentials for bot automation (vault)
- **Added:** 2026-04-16
- **Owner:** Credentialing ops + Azure Key Vault admin
- **Detail:** Playwright bots for Availity, My Practice Profile, Verity, eMedNY, NPDB require usernames/passwords (and TOTP seeds for DEA). These must be stored in Azure Key Vault under the agreed naming convention (`ecred-prod-bot-<portal>-username` / `-password` / `-totp`).
- **Unblocks:** full PSV bot runs in production (stubs in place meanwhile).

### B-006  NCQA criterion catalog content
- **Added:** 2026-04-16
- **Owner:** Credentialing compliance lead
- **Detail:** Schema and workflow will ship in P1-8, but the *content* of NCQA criteria (rows in `ncqa_criterion`) must be authored by a compliance SME with the current NCQA CVO standards in hand. Provide the spreadsheet/PDF.
- **Unblocks:** P1-8 populated catalog + auditor package export.

### B-007  Legal/policy text for provider-facing consent, privacy notice, attestation language
- **Added:** 2026-04-16
- **Owner:** Legal + Compliance
- **Detail:** The final copy for the attestation page, privacy notice, terms of service, and consent language inside the application form must come from legal. Placeholders in the codebase are marked `// TODO(legal)`.
- **Unblocks:** user-facing docs (D-5) and live provider traffic.

### B-008  SSL certificate for `credentialing.hdpulseai.com`
- **Added:** 2026-04-16
- **Owner:** Server admin
- **Detail:** Certbot provisioning must complete on the server; see one-time nginx setup block in `CLAUDE.md`. Not a code concern but needed for public launch.
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
- **Unblocks:** clean container restarts without destructive schema changes.

### B-009  Production `.env` values
- **Added:** 2026-04-16
- **Owner:** DevOps
- **Detail:** Several secrets referenced by the app are expected to live in `/var/www/E_Credentialing/.env` on the prod server: `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` (32-byte base64), `AUDIT_HMAC_KEY` (32+ character secret for audit chain integrity — NEW), Entra IDs, SendGrid key, Azure Communication Services connection string, Datadog/Sentry DSNs. Confirm each exists; document names/rotations here.
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
- **Unblocks:** compliance dashboard v2, auditor-package export.

### B-010  Apply audit tamper-evidence migration on existing prod DB
- **Added:** 2026-04-16
- **Owner:** DB admin
- **Detail:** Migration `20260416130000_audit_tamper_evidence` adds `sequence`, `previous_hash`, `hash`, `ip_address`, `user_agent`, `request_id` columns to `audit_logs` and installs triggers blocking DELETE/TRUNCATE and guarding UPDATE. Rows that pre-date the migration will have `hash IS NULL`; the verifier treats these as "not cryptographically attested" and reports counts on the compliance dashboard. Confirm whether Compliance wants a one-time backfill job to chain-hash historical rows (see ADR 0011).
- **Unblocks:** clean Compliance dashboard tamper-evidence widget.

---

## Conventions

- Use ID format `B-NNN` (zero-padded). Never reuse IDs.
- Keep the oldest blocker on top of *Active Blockers*; the very first line after the header list is the newest blocker? **No** — keep chronological (oldest first).
- Anything a code change alone could fix is **not** a blocker; open a todo instead.
