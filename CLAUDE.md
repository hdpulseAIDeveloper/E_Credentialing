# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**ESSEN Credentialing Platform** — a healthcare provider credentialing and onboarding web application for Essen Medical. This platform **replaces PARCS** (the previous credentialing system) and serves as the new system of record for all provider credentialing activity.

The Medallion CVO process flow diagrams in `docs/upload/` are reference/inspiration only — Essen is building this in-house (the "build" decision vs. the "buy" option Medallion represented).

## Planning Documents

All detailed requirements and architecture decisions live in `docs/planning/`:

| Document | Contents |
|----------|----------|
| [docs/planning/scope.md](docs/planning/scope.md) | Full functional requirements for all 10 modules |
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

## Platform Modules

The platform consists of 10 functional modules:

1. **Provider Onboarding** — outreach, account creation, data ingestion, application form, document upload
2. **Onboarding Dashboard** — staff-facing status tracking, task management, communications, audit trail
3. **Committee Dashboard** — committee prep, review sessions, agenda generation, approvals
4. **Enrollments** — delegated, facility (BTC), and direct enrollment tracking across all payers
5. **Expirables Tracking** — expiration monitoring, renewal automation, provider outreach
6. **Credentialing Bots (PSV)** — automated primary source verification via external websites
7. **Sanctions Checking** — OIG and SAM.gov exclusion list queries
8. **NY Medicaid / ETIN** — eMedNY enrollment, ETIN affiliation, Medicaid revalidation
9. **Hospital Privileges** — per-facility privilege application, approval, and renewal tracking
10. **NPDB** — National Practitioner Data Bank queries and continuous monitoring

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

**Key commands** (once repo is scaffolded):
```bash
npm run dev          # Start Next.js dev server
npm run dev:worker   # Start BullMQ worker (separate terminal)
npm run db:migrate   # Run Prisma migrations
npm run db:seed      # Seed provider types and admin user
npm run bot:headed   # Run a specific bot with visible browser (debugging)
npm test             # Run test suite
npm run build        # Production build
```

## Source Documents

- `docs/upload/ESSEN Credentialing Platform Requirements.docx` — end-user experience walkthrough
- `docs/upload/Credentialing Bots Workflow.docx` — PSV bot workflows (subset, more to be added)
- `docs/upload/Essen Cred Platform.pptx` — bottleneck analysis (what PARCS fails at)
- `docs/upload/Medallion - Essen Process Flow_Future State updated.png` — CVO reference flow
- `docs/upload/Medallion- NY Medicaid - Essen updated.png` — NY Medicaid/ETIN reference flow
