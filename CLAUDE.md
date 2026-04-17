# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Testing Standard (BINDING)

This repo follows the **HDPulseAI QA Standard — Comprehensive QA Test Layer**, the
versioned binding spec at [docs/qa/STANDARD.md](docs/qa/STANDARD.md). The
per-PR checklist is [docs/qa/definition-of-done.md](docs/qa/definition-of-done.md).
Both apply to every code change you make.

Every change you produce MUST:

1. Be covered by at least one spec under the relevant pillar(s) A–R
   (see `STANDARD.md` §2). The spec lives under `tests/e2e/<pillar>/**`,
   `tests/contract/**`, `tests/perf/**`, `tests/security/**`, `tests/data/**`,
   `tests/observability/**`, or `tests/docs/**` as appropriate.
2. Pass the smoke pillar (`tests/e2e/smoke/**`) before you claim "done".
3. Add a per-screen card under `docs/qa/per-screen/<slug>.md` for any new
   route, and a per-flow card under `docs/qa/per-flow/<slug>.md` for any new
   user flow. Cards without `Linked specs:` count as missing coverage.
4. Update the inventories under `docs/qa/inventories/` (regenerate via
   `npm run qa:inventory`) so `scripts/qa/check-coverage.ts` stays green.
5. Treat the following as **hard failures**, never as warnings:
   - any browser console `error`,
   - any React hydration warning (`Expected server HTML to contain a matching …`),
   - any uncaught `TypeError: Cannot read properties of undefined (reading 'call')`,
   - any 5xx from a first-party route, tRPC procedure, or webhook,
   - any axe-core `serious`/`critical` violation,
   - any PHI leakage to a role that should not see it.
6. End any test report you produce with the **headline reporting block** from
   `STANDARD.md` §3 — coverage numbers FIRST, pass/fail second:

   ```
   Routes covered:    X of Y
   Roles exercised:   X of N
   Pillars touched:   <A–R IDs>
   Pillars green:     <A–R IDs>
   Pillars not run:   <A–R IDs>     (must be empty for release)
   Pass / Fail / Skip: P / F / S
   ```

**Forbidden report shape:** "Pass: 33, Fail: 0, Not Run: 223" without a
coverage line is explicitly disallowed (`STANDARD.md` §10). A run with any
"Not Run" entry for a covered pillar is a **fail** of the gate, not a pass.

If you are about to mark a feature as "tested" without (a) automation under
the right pillar AND (b) a per-screen / per-flow card with `Linked specs:`
populated, stop and write both before you report.

### Fix-Until-Green loop (BINDING — `STANDARD.md` §4.1)

If any spec fails or any §4 hard-fail condition fires, you MUST enter the
loop and stay in it until the pillar is green. You may NOT report results,
mark the work "done", or hand the branch back while red.

Loop:

1. **Capture** evidence: spec name + path, console error, stack trace,
   `trace.zip`, screenshot, video, network HAR for any 5xx, browser, role,
   route at time of fail.
2. **File a defect card** at `docs/qa/defects/DEF-####.md` (template at
   `docs/qa/defects/_TEMPLATE.md`).
3. **Diagnose** the root cause. Fix priority: (a) production code →
   (b) genuinely-wrong assertion → (c) flaky fixture. Never weaken the
   assertion.
4. **Apply the minimum fix** (one root cause per commit). Update the DEF card.
5. **Re-run the FULL pillar**, not just the single spec. The smoke pillar
   (A) is re-run on every fix regardless. Cross-cutting fixes
   (auth / layout / middleware / schema) require re-running every pillar
   that exercises the touched layer.
6. **Loop** until green OR until 3 attempts on the same root cause have
   failed.

**Attempt cap: N=3 per root cause.** After three unsuccessful attempts on
the same root cause: STOP, update the defect card with every attempt and
output, escalate to the user explicitly with the evidence, and do NOT mark
the work done.

**Anti-weakening (`STANDARD.md` §4.2).** A failing spec MUST NOT be made to
pass by: weakening the assertion, deleting / renaming / `.skip` / `.todo` /
`.fixme` / `xtest` / `xit` / `describe.skip`, widening a selector to match
anything, swallowing the error with `try { } catch {}` / `.catch(() => {})` /
`expect.soft` / `test.fail`, adding `@ts-expect-error` or
`eslint-disable-next-line`, mocking out the failing path without proving the
mock matches production, increasing a timeout to mask a race, replacing
strict equality with substring / regex match, lowering a coverage threshold,
or editing `scripts/qa/check-coverage.ts` / pillar inventories to silence
a complaint. Any one of these is, by itself, a violation and grounds for
revert.

The only legitimate ways to turn a red spec green are: (1) fix the
production code, (2) fix a genuinely-wrong assertion (cite the
doc / ADR / requirement that establishes the corrected expectation in the
DEF card), (3) fix a flaky fixture (prove with 3 consecutive green runs
recorded in the DEF card).

## Project Overview

**ESSEN Credentialing Platform** — a healthcare provider credentialing and onboarding web application for Essen Medical. This platform **replaces PARCS** (the previous credentialing system) and serves as the new system of record for all provider credentialing activity.

The Medallion CVO process flow diagrams in `docs/upload/` are reference/inspiration only — Essen is building this in-house (the "build" decision vs. the "buy" option Medallion represented).

## Planning Documents

All detailed requirements and architecture decisions live in `docs/planning/`:

| Document | Contents |
|----------|----------|
| [docs/planning/scope.md](docs/planning/scope.md) | Full functional requirements for all 20 modules |
| [docs/planning/user-roles.md](docs/planning/user-roles.md) | Roles, permissions matrix, access control rules |
| [docs/planning/data-model.md](docs/planning/data-model.md) | Entity definitions, field-level detail, ERD |
| [docs/planning/integrations.md](docs/planning/integrations.md) | All external systems, API methods, data flows |
| [docs/planning/workflows.md](docs/planning/workflows.md) | Business workflows with Mermaid flowcharts |
| [docs/planning/credentialing-bots.md](docs/planning/credentialing-bots.md) | PSV bot specs for all credential types |
| [docs/planning/open-questions.md](docs/planning/open-questions.md) | Unresolved decisions before implementation |
| [docs/planning/architecture.md](docs/planning/architecture.md) | Recommended tech stack, system architecture, ADRs, infra, CI/CD |

Source documents from stakeholders: `docs/upload/`

## Domain Glossary

| Term | Definition |
|------|-----------|
| **Provider** | A healthcare professional (MD, DO, PA, NP, LCSW, LMHC, etc.) being credentialed |
| **Credentialing** | The process of verifying a provider's qualifications, licenses, and history before allowing them to practice |
| **PARCS** | Previous credentialing system — being replaced by this platform |
| **CAQH** | Council for Affordable Quality Healthcare — industry provider data repository; Essen ingests from it and updates it |
| **PSV** | Primary Source Verification — verifying a credential directly from the issuing authority (e.g., state medical board) |
| **PCD Folder** | Provider Credentialing Document folder — previously stored on K: drive; replaced by Azure Blob Storage in this platform |
| **Expirables** | Credentials and certifications with expiration dates requiring periodic renewal |
| **NPI** | National Provider Identifier — unique 10-digit identifier for US healthcare providers |
| **DEA** | Drug Enforcement Administration number — required for providers who prescribe controlled substances |
| **ETIN** | Enrollment Tracking Identification Number — used for NY Medicaid ETIN affiliation |
| **OIG** | Office of Inspector General — maintains the exclusion list of sanctioned providers |
| **SAM.gov** | System for Award Management — federal exclusions database |
| **NPDB** | National Practitioner Data Bank — stores malpractice and adverse action reports |
| **eMedNY** | New York Medicaid management information system / enrollment portal |
| **iCIMS** | Essen's HRIS system — source of provider demographic data at onboarding |
| **Committee** | Credentialing committee — reviews and approves providers after full application + PSV completion |
| **Attestation** | Provider's sworn confirmation that their application is complete and accurate |
| **BTC** | Facility enrollment type (Behavioral Treatment Center) |
| **Delegated Enrollment** | Enrollment where Essen submits on behalf of the provider to payers |
| **Direct Enrollment** | Enrollment submitted directly by the provider or Essen per-payer |
| **Availity** | Payer portal used for Anthem and Carelon submissions |
| **My Practice Profile** | Payer portal used for UHC and UBH Optum submissions |
| **Verity** | Payer portal used for Archcare submissions |
| **Bot / PSV Bot** | Automated browser script (Playwright) that navigates external websites to verify credentials |
| **TOTP** | Time-based One-Time Password — used for automated DEA MFA |
| **Azure Blob Storage** | Cloud file storage replacing the K: drive for all PDFs and documents |
| **NCQA** | National Committee for Quality Assurance — accreditation body for CVO (Credentials Verification Organization) programs |
| **CVO** | Credentials Verification Organization — an entity accredited by NCQA to perform primary source verification on behalf of healthcare organizations |
| **OPPE** | Ongoing Professional Practice Evaluation — routine periodic assessment of a credentialed provider's clinical competency |
| **FPPE** | Focused Professional Practice Evaluation — targeted evaluation triggered by new privileges, performance concerns, or adverse events |
| **FHIR** | Fast Healthcare Interoperability Resources — HL7 standard for exchanging healthcare data electronically |
| **CMS-0057-F** | CMS final rule requiring payers/providers to expose provider directory data via FHIR R4 APIs |
| **CME** | Continuing Medical Education — required ongoing education credits for licensed healthcare providers |
| **IMLC** | Interstate Medical Licensure Compact — agreement allowing expedited multi-state medical licensure |
| **EFT** | Electronic Funds Transfer — electronic payment enrollment with payers |
| **ERA** | Electronic Remittance Advice — electronic explanation of benefits/payment from payers |

## Platform Modules

The platform consists of 20 functional modules:

1. **Provider Onboarding** — outreach, account creation, data ingestion, application form, document upload
2. **Onboarding Dashboard** — staff-facing status tracking, task management, communications, audit trail
3. **Committee Dashboard** — committee prep, review sessions, agenda generation, approvals
4. **Enrollments** — delegated, facility (BTC), and direct enrollment tracking across all payers
5. **Expirables Tracking** — expiration monitoring, renewal automation, provider outreach
6. **Credentialing Bots (PSV)** — automated primary source verification via external websites
7. **Sanctions Checking** — OIG and SAM.gov exclusion list queries (weekly)
8. **NY Medicaid / ETIN** — eMedNY enrollment, ETIN affiliation, Medicaid revalidation
9. **Hospital Privileges** — per-facility privilege application, approval, and renewal tracking
10. **NPDB** — National Practitioner Data Bank queries and continuous monitoring
11. **Recredentialing** — 36-month cycle management, bulk initiation, status tracking, committee integration
12. **Compliance & Reporting** — NCQA CVO readiness dashboard, ad-hoc report builder, saved reports, CSV exports
13. **Verifications** — work history employer verification, professional reference checking (public token-based forms)
14. **Roster Management** — payer roster generation, CSV formatting, validation, submission tracking
15. **OPPE/FPPE** — Ongoing and Focused Professional Practice Evaluation tracking and scheduling
16. **Privileging Library** — delineation catalog by specialty, CPT/ICD-10 codes, core vs requested privileges
17. **CME & CV** — CME credit tracking (Category 1/2), requirement monitoring, auto-generated CV
18. **Public REST API & FHIR** — v1 REST API with API key auth, FHIR R4 Practitioner endpoint (CMS-0057-F)
19. **Telehealth Credentialing** — telehealth platform tracking, multi-state licensure, training certification
20. **Performance & Analytics** — provider scorecards, turnaround analytics, pipeline visualization, EFT/ERA tracking, staff training/LMS

## Authentication

- **Staff roles** (all internal users): Microsoft/Azure AD SSO via OAuth 2.0 / OIDC
- **Providers** (external): Auth method TBD — options include Azure AD B2B, email/password, or magic link
- All staff must authenticate through Essen's Azure AD tenant

## File Storage

All documents, verification PDFs, and bot outputs are stored in **Azure Blob Storage** using this container structure:

```
/providers/{provider-id}/
  /documents/           # uploaded credential documents
  /verifications/       # bot-generated PSV PDFs
  /summaries/           # committee summary sheets
  /committee/           # agenda PDFs
```

Bot output file naming conventions (preserved from legacy K: drive):
- License: `{State} License Verification, Exp. MM.DD.YYYY`
- DEA: `DEA Verification, Exp. MM.DD.YYYY`
- Boards: `Boards Verification {Board} exp MM.DD.YYYY`
- Sanctions: `OIG Sanctions Check MM.DD.YYYY`, `SAM Sanctions Check MM.DD.YYYY`

## Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| System of record | This platform | Replaces PARCS entirely |
| Staff auth | Azure AD SSO | Essen already on Microsoft stack |
| File storage | Azure Blob Storage | Replaces K: drive; programmatic access, no VPN needed |
| DEA MFA | TOTP via Azure Key Vault | Enables fully automated DEA verification |
| HRIS source | iCIMS REST API | Essen's HRIS system |
| Bot framework | Playwright | Reliable browser automation for PSV workflows |
| Provider types | Extensible via admin | Start with MD, DO, PA, NP, LCSW, LMHC |
| Public API auth | API key (SHA-256 hashed) | Simple server-to-server auth; PHI excluded from responses |
| FHIR compliance | FHIR R4 Practitioner endpoint | CMS-0057-F provider directory requirement |
| Sanctions frequency | Weekly (OIG + SAM.gov) | NCQA standard; increased from monthly |

## Tech Stack

**Recommended and adopted** — see [docs/planning/architecture.md](docs/planning/architecture.md) for full rationale and ADRs.

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14+ (App Router) — TypeScript |
| API | tRPC (type-safe client/server) |
| ORM | Prisma + PostgreSQL |
| Auth | Auth.js v5 — Microsoft Entra ID (Azure AD) provider |
| UI | shadcn/ui + Tailwind CSS |
| Real-time | Socket.io (bot status updates) |
| Bot automation | Playwright (headless Chromium) |
| Job queue | BullMQ + Redis (Azure Cache for Redis) |
| File storage | Azure Blob Storage (`@azure/storage-blob`) |
| Secrets | Azure Key Vault (`@azure/keyvault-secrets`) |
| OCR | Azure AI Document Intelligence |
| SMS | Azure Communication Services |
| Email | SendGrid + React Email |
| TOTP (DEA MFA) | otplib |
| PHI encryption | AES-256-GCM (Node.js `crypto`) |
| IaC | Azure Bicep |
| Hosting | Azure Container Apps (web + worker containers) |
| Database | Azure Database for PostgreSQL (Flexible Server) |

**Architecture**: Two containers — `web` (Next.js app) and `worker` (BullMQ + Playwright bots). Workers communicate results back to the UI via Redis pub/sub → Socket.io.

## Ports

| Container | Port | URL |
|-----------|------|-----|
| Web (Next.js — UI + tRPC API) | **6015** | http://localhost:6015 |
| Worker (BullMQ + Bull Board) | **6025** | http://localhost:6025 |

## Docker Commands

```bash
# Start full stack (web :6015 + worker :6025)
docker compose -f docker-compose.dev.yml up --build

# Start in background
docker compose -f docker-compose.dev.yml up -d --build

# View logs
docker compose -f docker-compose.dev.yml logs -f

# Stop
docker compose -f docker-compose.dev.yml down

# Production
docker compose -f docker-compose.prod.yml up -d --build
```

## Database Setup (one-time)

```bash
# Create the database in the shared localai-postgres-1 container
docker exec localai-postgres-1 psql -U postgres -c "CREATE DATABASE e_credentialing_db;"

# Run migrations (after containers are up)
docker exec ecred-web npx prisma migrate dev

# Seed initial data
docker exec ecred-web npm run db:seed
```

## Local Infrastructure (shared containers — do not recreate)

| Service | Container | Host Port | Internal URL |
|---------|-----------|-----------|-------------|
| PostgreSQL | `localai-postgres-1` | 5433 | `localai-postgres-1:5432` |
| Redis | `redis` | 6379 | `redis:6379` |

Both containers are on the `localai_default` Docker network. The app connects by joining that network (configured in docker-compose.dev.yml).

## Key Commands (inside containers or local npm)

```bash
npm run dev          # Start Next.js on :6015 (hot reload)
npm run dev:worker   # Start BullMQ worker + Bull Board on :6025
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed provider types and admin user
npm run bot:headed   # Run a specific bot with visible browser (debugging)
npm test             # Run test suite
npm run build        # Production build (web)
npm run build:worker # Production build (worker)
```

## Prerequisites (confirmed installed 2026-04-14)

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | v22.17.0 | ✅ |
| npm | 11.5.2 | ✅ |
| Docker Desktop | 29.1.5 | ✅ |
| Docker Compose | v5.0.1 | ✅ |
| Git | 2.50.0 | ✅ |
| Python 3.13 | 3.13.5 | ✅ at `C:\Users\admin\AppData\Local\Programs\Python\Python313\` |
| paramiko | Installed | ✅ Required for deploy script |
| Azure CLI | Not installed | ⚠️ Required for Key Vault local dev |

**Azure CLI**: Install from https://aka.ms/installazurecliwindows. After installing, run `az login`.

**Python in bash**: Use the full path `C:/Users/admin/AppData/Local/Programs/Python/Python313/python.exe` or add Python to PATH if `python3` is not found in bash.

---

## Production Deployment

- **Server**: 69.62.70.191 (user: `hdpulse2000`)
- **Server path**: `/var/www/E_Credentialing`
- **Branch**: `master`
- **Compose file**: `docker-compose.prod.yml`
- **Containers**: `ecred-web-prod`, `ecred-worker-prod`
- **Prod URL**: `credentialing.hdpulseai.com`

### Push & Deploy Workflow

When the user says "push and deploy" (or similar), execute these steps immediately without asking questions:

1. Stage all modified and untracked files (except `.claude/` and `test-results/`)
2. Commit with a clear, descriptive message summarizing the changes
3. `git push origin master`
4. `python .claude/deploy.py` — pulls from GitHub, rebuilds containers, prunes old images, shows status

**Do NOT ask the user which files to include, whether to show diffs, or how to split commits. Just commit everything, push, and deploy.**

For arbitrary SSH commands on the production server: `python .claude/deploy.py "<command>"`

### Important

- **Native SSH does not work from this machine** — always use `.claude/deploy.py` (paramiko-based)
- Do NOT use `ssh hdpulse2000@69.62.70.191` directly
- Server git credentials are configured globally on the production server
- Run Python with full path if needed: `C:/Users/admin/AppData/Local/Programs/Python/Python313/python.exe .claude/deploy.py`

### Production Infrastructure

| Service | Host (prod server) | Notes |
|---------|--------------------|-------|
| PostgreSQL | `supabase_db_hdpulse2000:5432` | Shared prod DB container on `supabase_network_hdpulse2000` |
| Redis | `host.docker.internal:6379` | Shared Redis container on prod server |

Production DB credentials: user `postgres`, password `postgres`, database `e_credentialing_db`.
Full connection string: `postgresql://postgres:postgres@supabase_db_hdpulse2000:5432/e_credentialing_db`

Before first deploy, create the database:
```bash
python .claude/deploy.py "docker exec supabase_db_hdpulse2000 psql -U postgres -c 'CREATE DATABASE e_credentialing_db;'"
```

Then run migrations:
```bash
python .claude/deploy.py "cd /var/www/E_Credentialing && docker exec ecred-web-prod npx prisma migrate deploy"
```

Production DB credentials: user `postgres`, password `postgres` (matches all sibling apps on this server).

### Nginx Setup (one-time, done on the server)

```bash
# Copy the nginx site config to the server
python .claude/deploy.py "cat > /etc/nginx/sites-available/credentialing.hdpulseai.com << 'NGINXEOF'
$(cat nginx/credentialing.hdpulseai.com)
NGINXEOF"

# Enable the site and get SSL cert via Certbot
python .claude/deploy.py "ln -sf /etc/nginx/sites-available/credentialing.hdpulseai.com /etc/nginx/sites-enabled/ && certbot --nginx -d credentialing.hdpulseai.com && nginx -t && systemctl reload nginx"
```

### First-Time Production Deploy

1. Create the database on the shared PostgreSQL:
   ```bash
   python .claude/deploy.py "docker exec supabase_db_hdpulse2000 psql -U postgres -c 'CREATE DATABASE e_credentialing_db;'"
   ```

2. Create `.env` on the server at `/var/www/E_Credentialing/.env` with real values (see `.env.example`). Critical vars:
   - `DB_PASSWORD=postgres` (shared prod DB)
   - `NEXTAUTH_SECRET=<openssl rand -base64 32>`
   - `AZURE_AD_TENANT_ID`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`
   - `ENCRYPTION_KEY=<32-byte base64>`

3. Push and deploy:
   ```bash
   # (Claude Code) push and deploy
   ```

4. After containers are up, run Prisma migrations:
   ```bash
   python .claude/deploy.py "docker exec ecred-web-prod npx prisma migrate deploy"
   ```

5. Seed initial data:
   ```bash
   python .claude/deploy.py "docker exec ecred-web-prod npm run db:seed"
   ```

6. Set up nginx (see above) and obtain SSL certificate.

## Source Documents

- `docs/upload/ESSEN Credentialing Platform Requirements.docx` — end-user experience walkthrough
- `docs/upload/Credentialing Bots Workflow.docx` — PSV bot workflows (subset, more to be added)
- `docs/upload/Essen Cred Platform.pptx` — bottleneck analysis (what PARCS fails at)
- `docs/upload/Medallion - Essen Process Flow_Future State updated.png` — CVO reference flow
- `docs/upload/Medallion- NY Medicaid - Essen updated.png` — NY Medicaid/ETIN reference flow
