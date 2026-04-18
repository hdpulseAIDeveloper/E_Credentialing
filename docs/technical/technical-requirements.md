# Technical Requirements Document (TRD) — E-Credentialing CVO Platform

**Version:** 2.1
**Last Updated:** 2026-04-18
**Status:** Active — kept current with the codebase
**Audience:** Developers, architects, DevOps, security engineers
**Owner:** Tech Lead

> Covers the full stack of the **E-Credentialing CVO platform** — web,
> worker, public marketing surfaces, public sandbox API, FHIR R4
> directory (CMS-0057-F / DaVinci PDex Plan-Net IG), Stripe billing
> scaffolding, multi-tenancy shim, and the auditor-package export.

---

## 1. Purpose

The TRD describes how the platform satisfies the [BRD](../functional/business-requirements.md)
and the [FRD](../functional/functional-requirements.md). It is the contract between
business needs and the implementation. It does not duplicate ADRs or
sub-system deep-dives — it links to them.

---

## 2. Scope

In scope: web tier, worker tier, database, cache, blob storage, auth,
public APIs, observability, build/deploy pipeline, security controls.

Out of scope: compute capacity planning beyond the next 12 months; multi-region
DR (single-region recovery only); native mobile apps.

---

## 3. Architecture summary

Two containers behind Nginx + TLS:

- `ecred-web` (Next.js 14, port 6015) — UI, tRPC, REST v1, FHIR R4, Auth.js, uploads.
- `ecred-worker` (port 6025) — BullMQ consumers, Playwright PSV bots,
  scheduled jobs, Bull Board.

Shared dependencies: PostgreSQL 16, Redis (Azure Cache in prod), Azure Blob
Storage, Azure Key Vault.

For diagrams and the full overview see [architecture.md](architecture.md) and
[../dev/architecture.md](../dev/architecture.md).

---

## 4. Functional system requirements (TR-F)

### TR-F-001 Type-safe end-to-end RPC
- **Need:** Eliminate accidental drift between client and server contracts.
- **Solution:** tRPC v11 with zod schemas; tRPC procedures consumed both from
  React Query hooks (client) and the server caller (server components).

### TR-F-002 App Router server components
- Pages render server-side with Prisma access where possible. Client
  components are introduced only for interactivity. After mutations,
  `router.refresh()` re-fetches server data.

### TR-F-003 Token-based provider authentication
- Single-active JWT signed with `NEXTAUTH_SECRET`. Hash stored on
  `Provider.inviteToken`. Endpoints reject any token that does not match the
  current hash. Attestation revokes the token.

### TR-F-004 Public read-only API
- REST v1 and FHIR R4 endpoints under `/api/v1/*` and `/api/fhir/*`. API key
  middleware (scope check, rate limit, audit). PHI fields stripped.

### TR-F-005 Background job processing
- BullMQ + Redis. Bot jobs, scheduled sweeps, notifications, enrollment
  side-effects. Bull Board UI for observability.

### TR-F-006 Real-time UI updates
- tRPC polling (5 s for in-flight bot status, 30 s for dashboard counts).
  Socket.io was removed and must not be reintroduced.

### TR-F-007 Document upload / download
- Streamed multipart through `/api/upload` to Azure Blob; `Document` row
  records `blobPath`. Download is **always** through `/api/documents/[id]/download`,
  which returns a 5-minute SAS URL after authn / authz.

### TR-F-008 PSV bot framework
- `BotBase` provides lifecycle management; subclasses implement `execute(page, ctx)`.
  `REQUIRES_MANUAL` is honored without auto-completion. Retries 3 with
  exponential backoff. Secrets fetched from Key Vault per run.

### TR-F-009 Compliance evidence generation
- NCQA CR mappings driven by `NcqaCriterion` + `NcqaCriterionAssessment` +
  `NcqaComplianceSnapshot`. Auditor package generator zips sampled files,
  policies, minutes, and logs.

### TR-F-010 AI governance
- Every AI-driven decision creates an `AiDecisionLog` row with model id,
  prompt hash, output hash, override reason. Model cards in `AiModelCard`.

---

## 5. Non-functional requirements (TR-N)

| ID | Requirement | Target | How verified |
|---|---|---|---|
| TR-N-001 | Page load (staff) | p50 < 1 s, p95 < 2 s | k6 scripts vs. staging |
| TR-N-002 | Bot queue throughput | ≥ 10 concurrent without degradation | Load test 50 concurrent in Phase 2 |
| TR-N-003 | Uptime business hours | ≥ 99.5% | Status page; uptime probe |
| TR-N-004 | RPO / RTO | RPO ≤ 24h, RTO ≤ 8h | Restore drill quarterly |
| TR-N-005 | PHI at rest | AES-256-GCM | Code review + integration test for round-trip |
| TR-N-006 | Audit chain integrity | 100% | `verifyAuditChain()` in nightly job + on-demand |
| TR-N-007 | Public REST p95 | < 200 ms at 50 RPS | k6 contract scripts |
| TR-N-008 | FHIR p95 | < 400 ms at 20 RPS | k6 contract scripts |
| TR-N-009 | Test coverage floors | 60/50/50/60 lines/funcs/branches/stmts | `vitest.config.ts` |
| TR-N-010 | Accessibility | WCAG 2.2 AA | `@axe-core/playwright` on every E2E navigation |

---

## 6. External system contracts

| System | Direction | Method | Notes |
|---|---|---|---|
| Microsoft Entra ID | inbound | OIDC | Staff SSO; group → role mapping |
| iCIMS | inbound | REST + webhook | New hire → Provider creation |
| CAQH ProView (UPDS / 2026 connector) | bidirectional | REST | Application data ingest + practice updates |
| State medical boards | scrape | Playwright | License Verification bots |
| DEA portal | scrape | Playwright + TOTP | DEA Verification |
| ABMS / ABIM / ABFM / NCCPA | scrape / API | Playwright | Board Certification |
| AMA Masterfile / ECFMG / ACGME | scrape / API | Playwright | Education PSV |
| OIG, SAM.gov, NY OMIG | scrape / API | Sanctions weekly |  |
| NPDB | API + email | Initial query + Continuous Query |  |
| FSMB Practitioner Direct | API / subscription | Continuous monitoring |  |
| Availity, My Practice Profile, Verity, EyeMed, eMedNY | scrape | Playwright | Payer enrollments |
| SendGrid | outbound | REST + Inbound Parse | Email send + reply capture |
| Azure Communication Services | outbound | REST | SMS |
| Azure Blob Storage | bi | SDK | Documents + bot PDFs |
| Azure Key Vault | inbound | SDK | Secrets |
| Azure AI Document Intelligence | outbound | SDK | Photo ID + document classification |
| SFTP per-payer | outbound | `ssh2-sftp-client` | Roster uploads |
| Public REST consumers | outbound | REST | API key auth, scoped, rate-limited |
| FHIR consumers (CMS-0057-F) | outbound | FHIR R4 | Practitioner endpoint |

Detailed integration specs: [planning/integrations.md](../planning/integrations.md).

---

## 7. Data architecture

- PostgreSQL 16 (Flexible Server in prod) — single primary; read replicas planned in Phase 5.
- Schema in `prisma/schema.prisma` (60+ models). See [data-model.md](data-model.md).
- Migrations in `prisma/migrations/` (do not edit in place after merge).
- PHI fields encrypted at the application layer (`src/lib/encryption.ts`).
- Audit table append-only with HMAC chain (HMAC key in env: `AUDIT_HMAC_KEY`).
- Backups: nightly snapshot to Azure storage; 30-day retention.

---

## 8. Security architecture

Reference: [security.md](security.md). Highlights:

- TLS 1.2+ everywhere.
- Defense-in-depth: zod validation client + server; tRPC role tiers; row-level
  ownership checks; PHI redaction in logger.
- Secrets only in Key Vault. No plaintext in env files committed to source.
- API key management: hashed storage, scopes, rotation.
- Provider tokens: single-active, revocable, IDOR-safe.
- File downloads via short-lived SAS only.
- Audit log immutable; DELETE / TRUNCATE blocked at the database.
- AUDIT_HMAC_KEY is required in production. Rotation procedure: snapshot
  existing chain → start a new chain root with `previous_hash = null` and an
  annotation row → update env → restart.
- AV scan on every upload.

Compliance mappings:

- HIPAA — [compliance/hipaa.md](../compliance/hipaa.md).
- NCQA CVO — [compliance/ncqa-cvo.md](../compliance/ncqa-cvo.md).
- CMS-0057-F — [compliance/cms-0057.md](../compliance/cms-0057.md).
- PHI Data Map — [compliance/phi-data-map.md](../compliance/phi-data-map.md).

---

## 9. Observability

- Logs: `pino` JSON, PHI redaction paths enforced in `src/lib/logger.ts`.
  `pino-http` for request logs.
- Probes: `/api/live` (process), `/api/ready` (dependencies), `/api/health`
  (legacy alias).
- Metrics: `/api/metrics` Prometheus endpoint (counters and histograms for
  HTTP, tRPC, BullMQ, bot success rates, audit chain length).
- Tracing: OpenTelemetry planned (Phase 5).
- Errors: Sentry planned (Phase 5) with PHI scrubbing.

Runbooks: [dev/runbooks/](../dev/runbooks/).

---

## 10. Build, test, and deploy

- Repo: GitHub. Default branch `master`. Conventional Commits.
- CI: GitHub Actions — `ci.yml` (typecheck, lint, vitest unit + integration,
  Playwright E2E, axe, forbidden-terms, build), `security.yml` (CodeQL,
  dependency review, gitleaks), `cd-prod.yml` (tag-driven deploy).
- Local dev: `docker compose -f docker-compose.dev.yml up --build`.
- Production deploy: `python .claude/deploy.py` (paramiko-based; `ALLOW_DEPLOY=1` required).
- Migrations: `prisma migrate deploy` runs from `scripts/web-entrypoint.sh` on web container start; healthcheck `start_period` extended to 120 s.

---

## 11. Environments

| Env | URL | Notes |
|---|---|---|
| Local | http://localhost:6015 | Docker Compose dev profile |
| Staging | https://staging.credentialing.hdpulseai.com | Mirror of prod; non-production data |
| Production | https://credentialing.hdpulseai.com | VPS at 69.62.70.191 |

Env vars: see [system-prompt.md § 14](../system-prompt.md#14-environment-variables).

---

## 12. Capacity targets (current cycle)

- ≤ 500 concurrent providers in pipeline.
- ≤ 50 concurrent staff sessions.
- ≤ 100 bot runs / day.
- ≤ 5 GB total document storage at end of Phase 4 (grows ~500 MB / quarter).
- ≤ 200 GB DB at end of Phase 4.

Scale-out trigger: any of (CPU > 70% sustained, p95 > 2 s, queue depth > 100)
prompts horizontal scale of `web` container; worker scaling is by adding
worker replicas (BullMQ supports multiple consumers).

---

## 13. Architecture decision records (ADRs)

Maintained in [dev/adr/](../dev/adr/). Active ADRs:

- 0001 — Next.js App Router
- 0002 — Prisma ORM
- 0003 — Drop Socket.io
- 0004 — PHI encryption (AES-256-GCM)
- 0005 — Provider invite tokens (single-active JWT)
- 0006 — Blob SAS download endpoint
- 0007 — Sanctions weekly cadence
- 0008 — Prisma migrations tracked in git
- 0009 — Auth.js + Entra ID
- 0010 — Pino with redaction
- 0011 — Audit tamper-evidence (HMAC chain)
- 0012 — NCQA criterion catalog model

---

## 14. Documentation requirements

Every PR must update the affected user / functional / technical / API /
compliance / qa pages. The `system-prompt.md` and `development-plan.md` are
required documents and must reflect the current state at all times.

---

## 15. Change log

| Date | Version | Change |
|---|---|---|
| 2026-04-15 | 1.0 | Initial; reflected implemented surface |
| 2026-04-17 | 2.0 | Documentation refresh — restructured as TR-F / TR-N; added external system contracts table; aligned with shipped 60+ Prisma models |
