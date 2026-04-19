# System Prompt — Regenerate the E-Credentialing CVO Platform

**Status:** REQUIRED. Keep this document current with every architectural,
scope, or stack change.
**Audience:** A senior AI coding agent or engineering team tasked with
rebuilding this application from scratch with no access to the existing repo.
**Format:** Self-contained. Everything needed to recreate the platform should
be either in this document or referenced explicitly by relative path inside
`docs/`.

---

## 0. Operating instructions for the agent / team

You are building **the E-Credentialing CVO platform** (Credentialing
Verification Organization platform) — an internally hosted healthcare
provider credentialing, verification, monitoring, and onboarding web
application for **Essen Medical**, also offered as a managed CVO service to
external medical groups and ACOs. It is the system of record for all
provider credentialing activity and replaces the legacy PARCS system and the
K: drive PCD folders.

Public surfaces that prospects, partners, and auditors see directly:

- `/` marketing landing — leads with the CVO positioning.
- `/cvo` explainer — what a CVO does and how this platform covers
  the NCQA element catalog, TJC NPG-12, and CMS-0057-F.
- `/pricing` — Starter / Growth / Enterprise tiers (live values come
  from Stripe at checkout when `BILLING_ENABLED=true`).
- `/sandbox` — public read-only API on synthetic data for evaluators.
- `/changelog` + `/changelog.rss` — customer-facing release notes.

Follow this prompt top to bottom. When in doubt:

1. Prefer the **simplest** correct solution that satisfies an NCQA CVO auditor
   and a HIPAA Security Officer.
2. Prefer **type-safe, server-rendered, server-validated** approaches.
3. Treat every PHI field as radioactive — encrypt at rest, redact in logs,
   never log plaintext.
4. Treat every external website as hostile — wrap PSV bots in retry, captcha
   detection, and a `REQUIRES_MANUAL` escape hatch.
5. Every mutation writes an audit row. Every cross-tenant lookup verifies the
   actor owns the resource. Every API response strips PHI fields by default.
6. **Quality bar (binding).** Every change you ship MUST satisfy the
   **HDPulseAI QA Standard — Comprehensive QA Test Layer** at
   [docs/qa/STANDARD.md](qa/STANDARD.md), including the per-PR Definition of
   Done at [docs/qa/definition-of-done.md](qa/definition-of-done.md). The
   18 testing pillars (A–R) are not optional. The hard-fail conditions in
   `STANDARD.md` §4 (browser console errors, hydration warnings, uncaught
   exceptions, 5xx, axe serious/critical, PHI leakage, broken links, contract
   drift, compliance regressions, orphaned inventories) MUST fail the build,
   the PR check, and the deploy gate — never a warning. Reports MUST lead with
   the coverage headline from `STANDARD.md` §3 (Routes covered: X of Y; Roles
   exercised: X of N) before any pass/fail count. The legacy report shape
   "Pass: 33, Fail: 0, Not Run: 223" is explicitly forbidden by `STANDARD.md`
   §10 — it is the failure mode this standard exists to prevent.

When you finish a module, also produce:

- A migration in `prisma/migrations/`.
- Vitest unit tests, integration tests against an ephemeral Postgres, and a
  Playwright happy-path E2E.
- At least one spec under each pillar (A–R from `qa/STANDARD.md` §2) the
  module touches; per-screen card under `docs/qa/per-screen/<slug>.md` for
  every new route; per-flow card under `docs/qa/per-flow/<slug>.md` for every
  new flow.
- Regenerated inventories under `docs/qa/inventories/` (`npm run qa:inventory`)
  with `scripts/qa/check-coverage.ts` green.
- For pillars that cover the full surface (A — functional smoke,
  B — RBAC matrix, E — accessibility, J — API/tRPC contract), prefer
  **iterator-style specs** that import the relevant inventory JSON
  (`route-inventory.json`, `api-inventory.json`, `trpc-inventory.json`)
  and iterate it with `for (...)` / `describe.each(...)` / `it.each(...)`.
  The coverage gate (`scripts/qa/iterator-coverage.ts`) credits any
  spec that does both as covering every entry. New routes / API cells /
  tRPC procedures then absorb coverage automatically as the inventory
  regenerates. See ADR 0019. Do NOT loosen the iterator-detection rule
  to "presence of import is enough" — the iteration construct is half
  the contract.
- Updates to the relevant pages in `docs/user/`, `docs/functional/`,
  `docs/technical/`, `docs/api/`, `docs/compliance/`, and the audit-package
  generator.

---

## 1. Mission statement

Build a single, accredited-quality credentialing platform that:

- Reduces median time-to-credential from 45+ days (PARCS baseline) to under 18
  days.
- Automates Primary Source Verification (PSV) for state licenses, DEA, board
  certifications, education, sanctions (OIG / SAM / state Medicaid), NPDB, and
  malpractice.
- Provides Essen with a defensible NCQA CVO posture (CR 1–9), HIPAA Security
  Rule controls, and CMS-0057-F FHIR Provider Directory readiness.
- Replaces all spreadsheets, K: drive folders, and PARCS lookups with one UI
  and one API.

---

## 2. Tech stack (locked-in)

| Layer | Technology |
|---|---|
| Framework | Next.js **14 (App Router)** + TypeScript strict |
| API | tRPC v11 (type-safe RPC) |
| ORM | Prisma 5.x against PostgreSQL 16 |
| Auth (staff) | Auth.js v5 (NextAuth) with Microsoft Entra ID (Azure AD) provider |
| Auth (providers) | Single-active JWT magic link (`provider-invite`) — no provider account |
| Auth (public API) | API key (SHA-256 hashed) with scopes |
| UI | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Tables | TanStack Table v8 |
| Forms | react-hook-form + zod resolvers |
| Real-time | tRPC polling (Socket.io was removed; do not reintroduce) |
| Bot framework | Playwright (headless Chromium) inside the worker container |
| Job queue | BullMQ on Redis (Bull Board UI on the worker) |
| File storage | Azure Blob Storage (`@azure/storage-blob`) |
| Secrets | Azure Key Vault (`@azure/keyvault-secrets`) |
| OCR / Doc Intelligence | Azure AI Document Intelligence |
| Email | SendGrid + React Email templates |
| SMS | Azure Communication Services |
| TOTP (DEA MFA) | `otplib`, seeds in Key Vault |
| PHI encryption | AES-256-GCM via Node `crypto` (`src/lib/encryption.ts`) |
| Logging | `pino` + `pino-http` with PHI redaction paths |
| Validation | `zod` everywhere, including `z.nativeEnum(PrismaEnum)` for tRPC inputs |
| Testing | Vitest + `@testing-library/react`, Playwright + `@axe-core/playwright`, Testcontainers (Postgres) |
| Containers | Docker + Docker Compose (dev and prod) |
| IaC (planned) | Azure Bicep (Container Apps target) |
| Hosting (today) | Two containers on a VPS behind Nginx + Let's Encrypt |

Versions in `package.json` are authoritative; do not downgrade Next.js, Auth.js,
tRPC, or Prisma without an ADR.

---

## 3. Architecture

```
                      ┌───────────────────────────┐
                      │      Azure Entra ID       │
                      │  (staff SSO via OIDC)     │
                      └──────────────┬────────────┘
                                     │
 Provider magic link (JWT)           │ Staff sign-in
          │                          │
          ▼                          ▼
┌────────────────────────────────────────────────┐
│   Next.js App (web container, port 6015)       │
│   - App Router + Server Actions                │
│   - tRPC routers                               │
│   - REST v1 + FHIR R4 endpoints                │
│   - Auth.js (Entra ID, credentials, magic)     │
└──────┬──────────────────┬───────────────────┬──┘
       │ Prisma           │ @azure/storage    │ BullMQ enqueue
       ▼                  ▼                   ▼
 ┌──────────┐     ┌────────────────┐    ┌──────────┐
 │ Postgres │     │ Azure Blob     │    │  Redis   │
 │  + audit │     │  (private)     │    │  pub/sub │
 └──────────┘     └────────────────┘    └────┬─────┘
                                             ▼
                             ┌─────────────────────────────┐
                             │   Worker container (:6025)  │
                             │   - BullMQ consumers        │
                             │   - Playwright PSV bots     │
                             │   - Bull Board UI           │
                             └─────────────────────────────┘
```

Two containers:

- `ecred-web` (Next.js, port 6015) — UI, tRPC, REST v1, FHIR, Auth.js, uploads.
- `ecred-worker` (port 6025) — BullMQ consumers, Playwright PSV bots, scheduled
  jobs, Bull Board.

Shared dependencies: PostgreSQL (Flexible Server in prod; `localai-postgres-1`
in dev), Redis (Azure Cache for Redis in prod; `redis` in dev), Azure Blob
Storage, Azure Key Vault.

---

## 4. Repository layout

```
E_Credentialing/
├── .claude/                  # Deploy automation (paramiko-based)
├── .github/                  # CI workflows (ci.yml, security.yml, cd-prod.yml), Dependabot, PR template
├── docs/                     # All documentation (this folder)
├── nginx/                    # Nginx site configs for production
├── prisma/
│   ├── schema.prisma         # Single source of truth
│   ├── migrations/           # Tracked, ordered migrations (do NOT gitignore)
│   └── seed.ts               # Provider types, admin user, demo data
├── public/                   # Static assets
├── scripts/                  # CLI utilities (forbidden-terms, web-entrypoint, NCQA importer)
├── src/
│   ├── app/                  # Next.js App Router
│   │   ├── (staff)/          # Authed staff portal
│   │   ├── (provider)/       # Provider application portal (token-auth)
│   │   ├── api/              # /api/auth, /api/trpc, /api/v1, /api/fhir, /api/upload, /api/webhooks
│   │   ├── auth/             # Sign-in pages
│   │   └── verify/           # External work-history / reference verifier (tokenized)
│   ├── components/           # UI components (shadcn primitives + feature components)
│   ├── hooks/                # React hooks
│   ├── lib/                  # Pure libs (auth/, api/, encryption.ts, audit.ts, logger.ts, blob-naming.ts)
│   ├── server/
│   │   ├── api/              # tRPC routers (one per module) + trpc.ts + root.ts
│   │   ├── auth/             # Auth.js config
│   │   ├── services/         # Service layer (provider-status, etc.)
│   │   └── db.ts             # Prisma singleton
│   ├── workers/              # BullMQ index + bot registry + bots/ + jobs/
│   ├── styles/               # Tailwind globals
│   └── middleware.ts         # Route protection
├── tests/
│   ├── unit/                 # Vitest, mirrors src/
│   ├── integration/          # Vitest + Testcontainers
│   ├── e2e/                  # Playwright
│   └── support/              # Fixtures, helpers
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Dockerfile.web.prod
├── Dockerfile.worker.prod
├── playwright.config.ts
├── vitest.config.ts
├── next.config.mjs
└── tsconfig.json
```

---

## 5. Modules to implement (20 total)

Each module ships with: tRPC router(s), one or more pages, Prisma models,
migrations, seed data, unit + integration tests, E2E happy-path, audit-log
coverage, and updates to user/functional/technical/compliance docs.

| # | Module | Primary actor | Notes |
|---|---|---|---|
| 1 | Provider Onboarding | Specialist + Provider | Outreach, magic-link account, application form, document upload, attestation |
| 2 | Onboarding Dashboard | Specialist / Manager | Pipeline view, status workflow, tasks, communications, audit trail |
| 3 | Committee Dashboard | Manager / Committee | Sessions, agenda, summary sheets, approve/deny/defer with reason |
| 4 | Enrollments | Specialist / Roster Manager | Per-payer (delegated, BTC, direct), follow-up cadence, payer confirmations |
| 5 | Expirables Tracking | Specialist | 120/90/60/30/7/1-day cadence; auto reminders |
| 6 | Credentialing Bots (PSV) | System / Specialist (manual trigger) | Playwright-based PSV with `REQUIRES_MANUAL` escape |
| 7 | Sanctions Checking | System | OIG + SAM weekly; state Medicaid (NY OMIG); flag handling |
| 8 | NY Medicaid / ETIN | Specialist | Enrollment, ETIN affiliation, revalidation |
| 9 | Hospital Privileges | Specialist | Per-facility application, approval, renewal |
| 10 | NPDB | Specialist / System | Initial query + Continuous Query enrollment |
| 11 | Recredentialing | System / Specialist | 36-month cycle, abbreviated app, full PSV re-run, committee re-review |
| 12 | Compliance & Reporting | Manager / Compliance | NCQA CVO dashboard, ad-hoc report builder, exports |
| 13 | Verifications (Work History / References) | Specialist / Verifier | Public token-based forms (`/verify/...`) |
| 14 | Roster Management | Roster Manager | Generate per-payer rosters, validate, submit, record acks |
| 15 | OPPE / FPPE | Manager / Committee | Periodic + focused practice evaluations; minutes attestation |
| 16 | Privileging Library | Admin / Manager | Delineation catalog, CPT/ICD-10 mapping, core vs requested |
| 17 | CME & CV | Specialist / Provider | CME credit ingest, requirement monitoring, auto-generated CV |
| 18 | Public REST API & FHIR | API consumers | v1 read-only REST + FHIR R4 Practitioner endpoint (CMS-0057-F) |
| 19 | Telehealth Credentialing | Specialist | IMLC tracking, platform certifications, coverage gap alerts |
| 20 | Performance & Analytics | Manager | Provider scorecards, turnaround analytics, pipeline visualization, EFT/ERA tracking, staff training/LMS |

Cross-cutting modules (always implement first):

- **Authentication & Authorization** — Entra ID staff SSO; provider invite token; API keys with scopes.
- **Audit logging** — `writeAuditLog()` with HMAC-chain tamper evidence; DB triggers block DELETE/TRUNCATE.
- **PHI encryption** — `src/lib/encryption.ts` AES-256-GCM; `ProviderProfile` PHI fields encrypted at app layer.
- **Observability** — `pino` with PHI redaction; `/api/live`, `/api/ready`, `/api/health`, `/api/metrics` (Prometheus).
- **AI Governance** — Model cards + decision audit logs (planned/early). Track every AI-driven decision with model id, prompt hash, output hash, override reason.

---

## 6. Domain glossary (essential subset)

| Term | Definition |
|---|---|
| Provider | A healthcare professional (MD, DO, PA, NP, LCSW, LMHC, etc.) being credentialed |
| PSV | Primary Source Verification — verifying a credential directly with the issuing authority |
| CAQH | Council for Affordable Quality Healthcare — provider data repository |
| PCD Folder | Provider Credentialing Document folder — replaced by Azure Blob storage |
| Expirable | A credential or certification with an expiration date |
| NPI | National Provider Identifier (10-digit) |
| DEA | Drug Enforcement Administration registration |
| OIG | Office of Inspector General sanctions list |
| SAM.gov | System for Award Management exclusions |
| NPDB | National Practitioner Data Bank |
| eMedNY | NY Medicaid management information system |
| iCIMS | Essen's HRIS — provider demographic source |
| Committee | Credentialing committee that approves providers |
| Attestation | Provider's sworn confirmation that the application is complete |
| BTC | Behavioral Treatment Center (facility enrollment type) |
| Availity / My Practice Profile / Verity | Payer portals automated by bots |
| TOTP | Time-based One-Time Password used for DEA MFA |
| NCQA | National Committee for Quality Assurance — CVO accreditation body |
| CVO | Credentials Verification Organization |
| OPPE / FPPE | Ongoing / Focused Professional Practice Evaluation |
| FHIR | HL7 Fast Healthcare Interoperability Resources standard |
| CMS-0057-F | CMS final rule mandating FHIR R4 Provider Directory APIs |
| IMLC | Interstate Medical Licensure Compact |

For the full glossary, see [product/glossary.md](product/glossary.md).

---

## 7. Authentication and authorization

Three authentication models — keep them strictly separated.

### 7.1 Staff (Auth.js v5 + Entra ID)

- Provider: Microsoft Entra ID via OIDC. JWT session strategy.
- Local dev provider: Credentials, **only** when `AUTH_LOCAL_CREDENTIALS=true`.
- Session cookie: HttpOnly, Secure, SameSite=Lax, JWT, 1-day rolling, force re-auth at 7 days, idle timeout 30 min.
- Roles (via Entra group membership, synced nightly): `SPECIALIST`, `MANAGER`, `COMMITTEE_MEMBER`, `ADMIN`, `ROSTER_MANAGER`, `COMPLIANCE_OFFICER`.
- MFA enforced by Entra Conditional Access; the platform does not implement its own MFA.

### 7.2 Providers (single-active JWT magic link)

- No account. JWT signed with `NEXTAUTH_SECRET`, claims `{ typ: "provider-invite", providerId, email, iat, exp }`, `exp` = 72h.
- Token hash stored in `Provider.inviteToken`. Issuing a new token atomically replaces the old one (single-active).
- `verifyProviderInviteToken()` checks signature, expiration, type, hash match, and that `Provider.status` is one of `INVITED | ONBOARDING_IN_PROGRESS | DOCUMENTS_PENDING`.
- Token is **revoked on attestation** (cleared from `Provider.inviteToken`). Subsequent requests fail closed.
- All provider-token endpoints verify `providerId` claim equals the target resource owner (defense against IDOR).
- Provider session inactivity timeout: 15 minutes.

### 7.3 Public API (API keys with scopes)

- Format: `ecred_<32-char-random>`. DB stores SHA-256 hash only.
- Header: `Authorization: Bearer ecred_<...>`.
- Scopes: `providers:read`, `sanctions:read`, `enrollments:read`, `fhir:read`. **No write scopes.**
- Per-key rate limits via fixed-window counter in `src/lib/api/rate-limit.ts` (Redis-backed when scaled past one container).
- Every API request writes an `AuditLog` row via `auditApiRequest()` in `src/lib/api/audit-api.ts`.

### 7.4 tRPC procedure tiers

- `staffProcedure` — any signed-in staff member.
- `managerProcedure` — `MANAGER` or `ADMIN`.
- `adminProcedure` — `ADMIN` only.
- `committeeProcedure` — `COMMITTEE_MEMBER`, `MANAGER`, or `ADMIN`.

Do **not** create a `providerProcedure`; providers authenticate with tokens at
the API-route layer.

---

## 8. Data model

The complete schema lives in `prisma/schema.prisma`. Key models (60+ in total):

- `Provider`, `ProviderProfile` (PHI fields encrypted), `ProviderType`
- `License`, `Document`, `DocumentRequirement`, `ChecklistItem`
- `VerificationRecord`, `BotRun`, `BotExceptionVerdict`
- `Task`, `TaskComment`, `Communication`
- `Enrollment`, `EnrollmentFollowUp`, `PayerRoster`, `RosterSubmission`
- `Expirable`
- `SanctionsCheck`, `MonitoringAlert`
- `MedicaidEnrollment`, `NPDBRecord`, `FsmbPdcSubscription`, `FsmbPdcEvent`
- `HospitalPrivilege`, `PrivilegeCategory`, `PrivilegeItem`, `FacilityCoverageMinimum`
- `RecredentialingCycle`
- `CommitteeSession`, `CommitteeProvider`
- `PracticeEvaluation` (OPPE/FPPE), `PeerReviewMeeting`, `PeerReviewMinute`, `SupervisionAttestation`
- `CmeCredit`, `WorkHistoryVerification`, `ProfessionalReference`
- `MalpracticeVerification`
- `TelehealthPlatformCert`
- `DirectoryOrganization`, `DirectoryLocation`, `DirectoryEndpoint`, `DirectoryPractitionerRole` (FHIR)
- `NcqaCriterion`, `NcqaCriterionAssessment`, `NcqaComplianceSnapshot`
- `ComplianceControl`, `ComplianceEvidence`, `ComplianceGap`, `ComplianceAuditPeriod`
- `AiModelCard`, `AiConversation`, `AiMessage`, `AiDecisionLog`
- `TrainingCourse`, `TrainingAssignment`, `StaffTrainingRecord`
- `AppSetting`, `Workflow`, `SavedReport`, `ApiKey`, `User`
- `AuditLog` — append-only, HMAC-chained

PHI fields encrypted at the application layer in `ProviderProfile`: `ssn`,
`dateOfBirth`, `homeAddressLine1`, `homeAddressLine2`, `homeCity`, `homeState`,
`homeZip`, `homePhone`. Database stores ciphertext + nonce + auth tag in a
single `bytea`/`text` field (see `src/lib/encryption.ts`).

`AuditLog` row shape:
- `id`, `actorUserId | null`, `actorApiKeyId | null`, `actorType`
- `action` (verb-noun), `entityType`, `entityId`
- `before`, `after` (JSON)
- `reason`, `requestId`, `ipAddress`, `userAgent`
- `previousHash`, `hash`, `sequence`
- `createdAt`

DB triggers `audit_log_no_delete` and `audit_log_no_truncate` block DELETE and
TRUNCATE; UPDATE is allowed only for the one-time NULL→value transition on
`hash` (used to compute the chain after insert).

---

## 9. Background jobs and PSV bots

### 9.1 Queues

| Queue | Producer | Consumer | Schedule |
|---|---|---|---|
| `bot-runs` | tRPC `bot.triggerBot`, onboarding submit, scheduled recheck | `botWorker` | On-demand |
| `scheduled` | Cron | `scheduledWorker` | Various |
| `sanctions-recheck` | Cron | `scheduledWorker` | Weekly Mon 02:00 ET |
| `expirables-outreach` | Cron | `scheduledWorker` | Daily 07:00 ET |
| `recredentialing-initiation` | Cron | `scheduledWorker` | Daily 06:00 ET |
| `roster-generation` | Cron | `scheduledWorker` | Monthly 1st 03:00 ET |
| `notifications` | App | `notificationWorker` | On-demand |
| `enrollments` | Provider approval | `enrollmentWorker` | On-demand |

### 9.2 Bot framework (`BotBase`)

Every bot extends `BotBase` and implements `execute(page, ctx)`:

- `BotBase.run(job)` marks the run RUNNING, opens a Playwright page, calls `execute`, then:
  - if subclass set `run.status = REQUIRES_MANUAL`, do NOT auto-complete and do NOT write `VerificationRecord`.
  - else mark COMPLETED, write `VerificationRecord`, upload PDF to Blob with the legacy naming convention.
- Default retries: 3 attempts, exponential backoff 30s / 2m / 8m. After failure, mark FAILED and alert.
- Captcha → `REQUIRES_MANUAL` with reason. UI changes that break selectors → fix selectors and add fixture-based tests.
- Secrets resolved just-in-time from Key Vault (`dea.totpSecret`, `availity.username`, etc.). Never logged.
- Bots staff can manually trigger live in `TRIGGERABLE_BOT_TYPES` in `src/server/api/routers/bot.ts`. System-only bots are excluded.

### 9.3 Bot file naming (preserved from K: drive)

```
License:    "{State} License Verification, Exp. MM.DD.YYYY"
DEA:        "DEA Verification, Exp. MM.DD.YYYY"
Boards:     "Boards Verification {Board} exp MM.DD.YYYY"
Sanctions:  "OIG Sanctions Check MM.DD.YYYY"
            "SAM Sanctions Check MM.DD.YYYY"
```

Folders inside the Blob container:

```
/providers/{provider-id}/
  /documents/        # provider-uploaded credential docs
  /verifications/    # bot-generated PSV PDFs
  /summaries/        # committee summary sheets
  /committee/        # agenda PDFs
```

---

## 10. Public APIs

### 10.1 REST v1 (`/api/v1/...`)

- Read-only.
- API-key auth + scope check + per-key rate limit + audit log on every request.
- PHI fields stripped from every response regardless of scope.
- Errors: `{ "error": { "code": "...", "message": "..." } }`.
- Endpoints (initial set): `GET /providers`, `GET /providers/:id`, `GET /sanctions`, `GET /enrollments`.

### 10.2 FHIR R4 (`/api/fhir/...`)

- Implements `Practitioner` resource per CMS-0057-F minimum.
- Pagination via `_count` and `_offset`; `Bundle.total` is accurate.
- Errors return `OperationOutcome` resources.
- Resources shipped as of Wave 3.3 (CMS-0057-F / DaVinci PDex Plan-Net IG):
  `Practitioner`, `PractitionerRole`, `Organization`, `Location`,
  `Endpoint`, `HealthcareService`, `InsurancePlan`. Instance-level
  `$everything` operation. `CapabilityStatement` at `/api/fhir/metadata`
  enumerates supported resources, search params, and operations.

### 10.3 Public surfaces (Wave 5 — commercial readiness)

These five surfaces are publicly reachable without auth and should be
built from day one of any regeneration:

- `/` — marketing landing, leads with CVO positioning.
- `/cvo` — CVO explainer (NCQA element catalog, TJC NPG-12, CMS-0057-F).
- `/pricing` — Starter / Growth / Enterprise tiers.
  Live values from Stripe when `BILLING_ENABLED=true`.
- `/sandbox` — read-only REST API on synthetic data
  (`@faker-js/faker` seeded deterministically per session).
- `/changelog` (Server Component) + `/changelog.rss` (RSS 2.0).
  Source of truth: hand-edited `docs/changelog/public.md`. Never
  regenerated from `CHANGELOG.md`. Pure parser at
  `src/lib/changelog/parser.ts`; pure RSS renderer at
  `src/lib/changelog/rss.ts`. ADR 0018.

### 10.4 Auditor-package export (Wave 5.4)

Admins can trigger a single ZIP bundle that includes:
- Every NCQA criterion assessment with its evidence.
- HMAC-chained audit-log proof (range, head sequence, head hash).
- Versioned legal/policy text snapshots (`docs/legal/`).
- SOC 2 Type I gap analysis Markdown.
- A machine-readable `manifest.json` listing every file with SHA-256.
The endpoint is admin-only at all times. ADR 0017.

---

## 11. Security and compliance baseline (must-have before go-live)

- TLS 1.2+ everywhere.
- AES-256-GCM at the application layer for all PHI fields listed above.
- Azure Storage Service Encryption on Blob; Azure DB encryption at rest.
- Entra ID MFA enforced.
- Sessions HttpOnly + Secure + SameSite=Lax.
- Audit log: append-only, HMAC-chained, 7-year retention.
- Logger redacts PHI via `pino` redact paths; unit test verifies redaction on every known field.
- Input validation: zod schemas on every tRPC procedure and API route.
- File uploads: streamed to Blob through `/api/upload`; only `blobPath` persisted; AV scan in pipeline.
- Document downloads: served through `/api/documents/[id]/download`, which returns a 5-minute SAS URL; raw blob URLs are never exposed to clients.
- Public APIs: rate-limited, scoped, audited; AUDIT_HMAC_KEY required (server refuses to start without it in prod).
- CSRF: Auth.js handles its own; session-authed mutations on REST routes use `src/lib/api/csrf.ts` double-submit token.
- Provider invite tokens: single-active, 72-hour TTL, revoked on attestation.
- IDOR protection: every provider-token API verifies `providerId` claim against the target resource.
- ALLOW_DEPLOY env guard on `.claude/deploy.py` to prevent accidental production deploys.

NCQA CR 1–9 mappings are in [compliance/ncqa-cvo.md](compliance/ncqa-cvo.md).

---

## 12. UI/UX standards

- Tailwind + shadcn/ui only. No second design system.
- Every page must:
  1. Render an accessible heading hierarchy (`<h1>` once per page).
  2. Pass `axe` with zero serious/critical violations.
  3. Be operable by keyboard alone.
  4. Provide a meaningful empty state when there is no data.
  5. Provide loading skeletons or shimmer rather than spinners for full-page loads.
  6. Show inline form validation messages (zod resolver). Standard copy in [functional/messaging-catalog.md](functional/messaging-catalog.md).
- Toast notifications use the shadcn `Toast` primitive. Severity colors use semantic tokens (`success`, `warning`, `destructive`, `info`).
- Color tokens, typography scale, and spacing rules: see [functional/ui-ux-style-guide.md](functional/ui-ux-style-guide.md).
- All numeric fields use `number` inputs with explicit `step` and `min`. Money is rendered as `Intl.NumberFormat`. Dates render in the user's locale.

---

## 13. Environments and ports

| Container | Port | URL (dev) | URL (prod) |
|---|---|---|---|
| Web (Next.js) | 6015 | http://localhost:6015 | https://credentialing.hdpulseai.com |
| Worker (Bull Board) | 6025 | http://localhost:6025 | (internal) |

Shared dev infra (do not recreate):

- Postgres `localai-postgres-1:5432` on host port 5433.
- Redis `redis:6379`.
- Both on Docker network `localai_default`.

Production server: `69.62.70.191`, path `/var/www/E_Credentialing`, branch
`master`. Deploys via `python .claude/deploy.py` (paramiko-based; native SSH
does not work from the dev machine). Database is on
`supabase_db_hdpulse2000:5432`; Redis on `host.docker.internal:6379`.

---

## 14. Environment variables

```
# Database
DATABASE_URL=postgresql://...

# Auth
NEXTAUTH_URL=...
NEXTAUTH_SECRET=<openssl rand -base64 32>
AZURE_AD_TENANT_ID=...
AZURE_AD_CLIENT_ID=...
AZURE_AD_CLIENT_SECRET=...
AUTH_LOCAL_CREDENTIALS=true        # dev only

# Redis
REDIS_URL=redis://...

# Azure
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_KEY_VAULT_URL=https://<vault>.vault.azure.net/

# PHI encryption
ENCRYPTION_KEY=<32-byte base64>

# Audit chain HMAC (REQUIRED in prod)
AUDIT_HMAC_KEY=<32+ char secret>

# Public-facing URLs
NEXT_PUBLIC_APP_URL=https://credentialing.hdpulseai.com
NEXT_PUBLIC_WORKER_URL=http://localhost:6025

# SendGrid + ACS
SENDGRID_API_KEY=...
ACS_CONNECTION_STRING=...

# Anti-abuse
TURNSTILE_SITE_KEY=...
TURNSTILE_SECRET_KEY=...

# Deploy guard
ALLOW_DEPLOY=1
```

---

## 15. Testing baseline

- **Unit (Vitest, jsdom + node):** pure functions, presentational components, zod schemas. No I/O. Mock Prisma via `vi.mock`.
- **Integration (Vitest + Testcontainers):** services, tRPC routers, API routes, worker jobs, real Prisma against ephemeral Postgres. No browsers.
- **E2E (Playwright):** real user journeys; chromium + firefox; `storageState` for auth fixtures; `@axe-core/playwright` on every page.
- **Contract (REST + FHIR):** validate every response against JSON schema / FHIR profile.
- **Load (k6):** REST p95 < 200 ms at 50 RPS; FHIR p95 < 400 ms at 20 RPS.
- **Coverage floors (`vitest.config.ts`):** lines 60%, functions 50%, branches 50%, statements 60%. Critical paths (auth, encryption, bot, audit) require 90% branch coverage.
- **Mandatory tests:** PHI encryption round-trip; PHI redaction in logs; provider-token failure modes; IDOR across providers; rate-limit behaviour and headers; bot lifecycle (RUNNING→COMPLETED, REQUIRES_MANUAL, FAILED, RETRYING); audit completeness on every mutation; role-based access enforcement.
- **Iterator coverage (Wave 6, ADR 0019):** matrix specs MUST iterate
  the inventories rather than copy-pasting route lists. See
  `tests/contract/pillar-j-trpc-iterator.spec.ts` and
  `tests/contract/pillar-j-api-iterator.spec.ts` for the canonical
  shape. The detection rule lives in `scripts/qa/iterator-coverage.ts`
  and is pinned by `tests/unit/scripts/iterator-coverage.test.ts`.
  Per-procedure / per-cell tests via `describe.each` give well-targeted
  failure names AND credit the gate for full inventory coverage.
- **Production-bundle E2E (Wave 1.1):** never run pillar E (or any
  E2E) against `next dev`. Use `npm run qa:e2e:prod` which orchestrates
  `npm run build` → `npm start` → wait-for-`/api/health` →
  `playwright test --config=playwright.prod.config.ts`. Pre-compiled
  routes mean Playwright never times out compiling on first request.
  This closed DEF-INFRA-0001 and is the only sanctioned way to run E2E.

For the comprehensive test strategy and per-module test cases see
[qa/test-strategy.md](qa/test-strategy.md), [qa/unit-testing.md](qa/unit-testing.md),
[qa/functional-testing.md](qa/functional-testing.md), and
[qa/uat-plan.md](qa/uat-plan.md).

---

## 16. Documentation deliverables to keep current

When you change behaviour, update **all** of these in the same PR:

1. `prisma/schema.prisma` and migrations.
2. The relevant tRPC router(s) and zod input schemas.
3. The relevant page(s) and components.
4. Tests (unit + integration + E2E).
5. `docs/user/<module>.md` (plain-language).
6. `docs/functional/functional-requirements.md` (per-screen behaviour, validation, messages).
7. `docs/technical/architecture.md` and/or `docs/dev/<subsystem>.md`.
8. `docs/compliance/<standard>.md` if it touches NCQA, HIPAA, or CMS-0057-F.
9. `docs/api/<endpoint>.md` if it touches the public API.
10. `CHANGELOG.md` (root) and `docs/pm/changelog-product.md`.
11. `docs/qa/functional-testing.md` and `docs/qa/uat-criteria.md` for new acceptance scenarios.
12. **This `system-prompt.md`** if the change is architectural.
13. **`docs/development-plan.md`** if the change shifts the schedule or scope.

---

## 17. Build order (suggested)

If starting from zero:

1. Repo skeleton, Next.js + tRPC + Prisma + Auth.js scaffolding.
2. Auth (Entra ID) + middleware + role tiers.
3. Audit log + HMAC chain + DB triggers.
4. PHI encryption + Provider/ProviderProfile + smoke seed data.
5. Provider list + detail page (read-only).
6. Provider create / edit / status state machine + audit hooks.
7. Document upload via `/api/upload` to Azure Blob; download via SAS endpoint.
8. Provider invite tokens + provider portal application form + attestation revocation.
9. PSV BotBase + License Verification bot (one state, end-to-end). Then DEA, Boards, OIG, SAM.
10. Sanctions weekly sweep + expirables tracking.
11. Committee module (sessions, agenda, summary sheets, decisions).
12. Enrollments + roster generation.
13. NPDB initial query, then continuous query enrollment.
14. Recredentialing scheduler.
15. Public REST v1 + FHIR R4 Practitioner endpoint.
16. Compliance dashboard + NCQA criterion catalog + auditor package generator.
17. OPPE/FPPE + peer-review minutes + privileging library.
18. CME tracking + auto-generated CV.
19. Telehealth, behavioral health, FSMB PDC, AI governance.
20. Performance, analytics, training/LMS.

After each step, prove correctness with tests and update docs.

---

## 18. Anti-goals

- Do **not** introduce a global client-side state store (Redux, Zustand, etc.).
  Server components are the source of truth; mutations call `router.refresh()`.
- Do **not** add a second design system; shadcn + Tailwind only.
- Do **not** reintroduce Socket.io. Real-time is tRPC polling at 5 s for
  in-flight bot status, 30 s for dashboard counts.
- Do **not** put PHI in logs, query strings, or public API responses.
- Do **not** allow API write scopes on the public surface.
- Do **not** auto-transition a bot from `REQUIRES_MANUAL` to `COMPLETED`.
- Do **not** delete or truncate `AuditLog`. Triggers will block you.
- Do **not** edit migrations in place after they have been merged. Add a new
  migration instead.

---

## 19. References

- [development-plan.md](development-plan.md) — phased delivery plan
- [technical/architecture.md](technical/architecture.md) — comprehensive architecture
- [technical/technical-requirements.md](technical/technical-requirements.md) — TRD
- [functional/business-requirements.md](functional/business-requirements.md) — BRD
- [functional/functional-requirements.md](functional/functional-requirements.md) — FRD
- [qa/test-strategy.md](qa/test-strategy.md) — Test Strategy
- [planning/scope.md](planning/scope.md) — full functional scope (20 modules)
- [planning/data-model.md](planning/data-model.md) — entity definitions and ERD
- [planning/architecture.md](planning/architecture.md) — original architecture rationale
- [planning/integrations.md](planning/integrations.md) — every external system
- [planning/credentialing-bots.md](planning/credentialing-bots.md) — PSV bot specs
- [compliance/ncqa-cvo.md](compliance/ncqa-cvo.md) — NCQA CR 1–9 mapping
- [compliance/hipaa.md](compliance/hipaa.md) — HIPAA controls
- [api/README.md](api/README.md) — REST + FHIR reference

---

## 20. Acceptance — when this prompt is "done"

You have rebuilt the platform when:

1. `npm run typecheck && npm run lint && npm run test && npm run test:e2e` all pass.
2. `docker compose -f docker-compose.dev.yml up --build` brings up `web` on
   `:6015` and `worker` on `:6025`, and a fresh sign-in works against the seeded
   admin user.
3. The Master Test Plan workbook (see [testing/README.md](testing/README.md))
   regenerates and the auto-runner (`run_master_test_plan.py`) executes against
   the live local stack with the same coverage as the reference build.
4. The NCQA CVO compliance dashboard renders all CR 1–9 tiles green when seed
   data is loaded.
5. A senior engineer can read this document and the [docs/](README.md) tree
   alone and ship a new feature end-to-end without reading source code outside
   the modules they're touching.

---

## 21. Change log for this prompt

| Date | Author | Change |
|---|---|---|
| 2026-04-17 | Documentation refresh | Initial comprehensive prompt; supersedes inline guidance in `CLAUDE.md`. |
| 2026-04-18 | Cursor (autonomous Wave 7) | Added §10.3 (public surfaces shipped in Wave 5), §10.4 (auditor-package export), iterator-coverage and production-bundle E2E expectations in §0 and §15. A regenerator now builds the Wave 5–6 commercial-readiness band from day one rather than retrofitting it. Cross-references ADR 0017, ADR 0018, ADR 0019. |
