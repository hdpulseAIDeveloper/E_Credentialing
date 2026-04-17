# Security

**Audience:** Engineers, security reviewers, auditors.
**Companion:** [HIPAA mapping](../compliance/hipaa.md), [PHI data map](../compliance/phi-data-map.md).

---

## 1. Threat model (summary)

| Asset | Threat | Control |
|---|---|---|
| PHI in DB | Data theft / leak | App-layer AES-256-GCM, network isolation, RBAC, query review |
| PHI in blobs | Unauthorized access | Private container; SAS-only download (5 min) |
| Auth credentials | Replay / theft | TLS, short cookie life, secure / httponly, SameSite=Lax |
| Provider portal | IDOR | Token bound to provider id; row-level checks server-side |
| Public API | Abuse / scraping | API key + scope + rate limit + audit |
| Audit log | Tampering | HMAC-SHA256 chain; DELETE/TRUNCATE blocked at DB |
| Secrets | Leakage | Azure Key Vault; not in source control; gitleaks in CI |
| Bot scrapers | Credential theft | Per-bot service account; secrets pulled per run; rotated |
| Uploads | Malware | AV scan synchronous; reject on detection |

## 2. Identity & access

- Staff: Microsoft Entra ID OIDC via Auth.js. Group → role mapping. Roles:
  `STAFF`, `ADMIN`, `COMMITTEE_MEMBER`, `AUDITOR`, `EXECUTIVE`, `READONLY`,
  `BOT_OPERATOR`.
- Providers: Single-active JWT magic link (`NEXTAUTH_SECRET`-signed); hash on
  `Provider.inviteToken`.
- Public APIs: `ApiKey` SHA-256 hashed; `ApiKeyScope` per call; per-key rate
  limit; audit per call.
- MFA: enforced at the IdP (Entra). DEA scrape uses TOTP via `otplib` against
  ops-managed seeds in Key Vault.

## 3. Authorization

- tRPC procedures use one of: `publicProcedure`, `protectedProcedure`
  (any signed-in staff), `adminProcedure`, `auditorProcedure`,
  `committeeProcedure`. Plus per-resource ownership checks.
- API key middleware enforces scopes before procedure logic runs.
- Provider routes verify `ctx.session.providerId === requested provider id`.
- Public REST handlers redact PHI server-side; do not rely on the client.

## 4. Data protection

- **In transit:** TLS 1.2+ (Nginx with Let's Encrypt). HSTS enabled.
- **At rest (DB):** AES-256-GCM application-layer encryption for sensitive
  fields; keys via env / Key Vault; rotation procedure documented.
- **At rest (blob):** Azure-managed keys; private container; SAS-only access.
- **Backups:** snapshot-encrypted; access role-limited.

## 5. Audit logging

- Append-only `AuditLog` table.
- Every row: `previous_hash`, `payload_hash`, `chain_hash` using HMAC-SHA256.
- DB role for the app user lacks `DELETE` and `TRUNCATE` on `AuditLog`.
- Verification: `npm run audit:verify`. Nightly job runs the verifier.
- Anchor records (`AuditChainAnchor`) record chain length + tip hash for
  point-in-time integrity proof.

## 6. Secrets management

- `AUDIT_HMAC_KEY`, `NEXTAUTH_SECRET`, `DATABASE_URL`, `REDIS_URL`,
  Azure SDK creds, SendGrid keys, payer creds — all in Key Vault in prod.
- `.env.example` documents the variable names. No production values committed.
- `gitleaks` runs on every PR.

## 7. Inputs & outputs

- All user input validated via zod (client + server).
- File uploads: MIME sniff + extension whitelist (`pdf, jpg, jpeg, png, docx`)
  and AV scan.
- Outbound HTTP from bots only to allow-listed hostnames; logged.
- Markdown rendering uses sanitization; no raw HTML accepted.

## 8. Web hardening

| Header | Value |
|---|---|
| Strict-Transport-Security | `max-age=63072000; includeSubDomains; preload` |
| Content-Security-Policy | strict, no inline scripts; nonces for hydration |
| X-Frame-Options | `DENY` |
| X-Content-Type-Options | `nosniff` |
| Referrer-Policy | `strict-origin-when-cross-origin` |
| Permissions-Policy | denies camera, mic, geolocation by default |

CSRF protection on Auth.js endpoints by design; tRPC mutations require
session cookie + same-site enforcement.

## 9. Logging & PHI redaction

- `pino` redact paths defined in `src/lib/logger.ts`. Never log raw PHI.
- HTTP access logs strip query strings on regulated routes.
- Bull Board access restricted to `ADMIN` role.

## 10. Dependency security

- `npm audit` + `dependency-review-action` in CI.
- CodeQL JavaScript analysis on every PR.
- Renovate or weekly manual sweep for major upgrades.

## 11. Operational security

- VPS: `fail2ban`, key-only SSH, UFW: 80/443 + SSH only.
- Database: not exposed publicly; access only from app subnet.
- Bull Board: behind staff auth.
- Backups: tested quarterly via `restore-drill` runbook.
- Incident response runbook: [dev/runbooks/incident-response.md](../dev/runbooks/incident-response.md).

## 12. Compliance summary

- HIPAA Privacy + Security: implemented. See [compliance/hipaa.md](../compliance/hipaa.md).
- NCQA CR 1–8: aligned to 2026 standards. See [compliance/ncqa-cvo.md](../compliance/ncqa-cvo.md).
- CMS-0057-F: Practitioner endpoint live. See [compliance/cms-0057.md](../compliance/cms-0057.md).
- SOC 2 Type II: target Phase 5; controls evidenced by audit logs and runbooks.
