# ESSEN Credentialing Platform — Implementation Plan

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Status**: Active  

---

## Executive Summary

This document defines the phased implementation plan for the ESSEN Credentialing Platform, from its current production-deployed state through full organizational rollout and PARCS decommissioning. The platform replaces PARCS as Essen Medical's system of record for all provider credentialing activity.

**Current State**: The core platform (all 10 modules) is built, tested (234 automated tests, 100% pass), and deployed to production at `credentialing.hdpulseai.com`. The implementation plan below covers remaining integration activation, data migration, training, piloting, and full rollout.

---

## Phase Overview

| Phase | Name | Timeline | Duration | Key Outcome |
|-------|------|----------|----------|-------------|
| 1 | **Core Platform** | Completed | 4 weeks | All 10 modules built, tested, deployed |
| 2 | **Integration Activation** | Q2 2026 (May–Jun) | 8 weeks | External systems connected, bots operational |
| 3 | **Training & Pilot** | Q3 2026 (Jul–Aug) | 8 weeks | Staff trained, pilot running with live providers |
| 4 | **Full Rollout** | Q3–Q4 2026 (Sep–Oct) | 8 weeks | All providers migrated, PARCS sunset |
| 5 | **Optimization** | Q4 2026 (Nov–Dec) | Ongoing | Performance tuning, feedback-driven improvements |

---

## Phase 1: Core Platform Build (COMPLETED)

**Duration**: 4 weeks (completed April 2026)

### Deliverables (All Complete)

| Deliverable | Status |
|-------------|--------|
| Provider Onboarding Module (application form, document upload, OCR, checklist) | Done |
| Onboarding Dashboard (pipeline view, task management, communications, audit trail) | Done |
| Committee Dashboard (sessions, agenda generation, approvals) | Done |
| Enrollment Management (per-payer tracking, follow-up cadence, status workflow) | Done |
| Expirables Tracking (20+ credential types, 90/60/30/14/7-day alerts) | Done |
| PSV Bot Framework (10+ bot types, BullMQ queue, Playwright, retry logic) | Done |
| Sanctions Checking (OIG + SAM.gov) | Done |
| NY Medicaid / ETIN Module | Done |
| Hospital Privileges Module | Done |
| NPDB Module | Done |
| Role-Based Access Control (5 roles, permission matrix) | Done |
| Azure AD SSO Authentication | Done |
| AES-256-GCM PHI Encryption | Done |
| Immutable Audit Trail | Done |
| Production Deployment (Docker, Nginx, SSL) | Done |
| Comprehensive Testing (234 tests, 100% pass) | Done |
| Documentation (architecture, scope, workflows, data model, user training) | Done |

---

## Phase 2: Integration Activation (Q2 2026 — May–June)

**Duration**: 8 weeks  
**Goal**: Connect all external systems, activate production credentials, validate bot operations with real data.

### Week 1–2: Azure Infrastructure Setup

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Provision Azure Key Vault (production) | DevOps / IT | Azure subscription | Vault accessible from production containers |
| Store all external system credentials in Key Vault | DevOps | Credentials from credentialing team | All secrets stored; zero plaintext in configs |
| Provision Azure Blob Storage container | DevOps | Azure subscription | Container `essen-credentialing` created, RBAC configured |
| Configure Managed Identity for containers | DevOps | Container Apps setup | Containers authenticate to Key Vault/Blob via MI |
| Install Azure CLI on dev machine | Developer | — | `az login` works, local dev can reach Key Vault |

### Week 3–4: Data Integrations

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Configure iCIMS OAuth credentials | IT / iCIMS Admin | iCIMS API access granted | API returns provider data for known iCIMS ID |
| Test iCIMS webhook integration | Developer | iCIMS webhook URL registered | New hire in iCIMS triggers provider record creation |
| Configure CAQH API credentials | Credentialing Manager | CAQH UPDS API access | CAQH data ingested for known CAQH ID |
| Test CAQH write-back (practice updates) | Developer | CAQH API write access | Practice hours updated successfully in CAQH |
| Configure Azure AD production app registration | IT | Azure AD admin consent | Staff SSO works with production Azure AD |
| Configure SendGrid domain authentication | IT / DevOps | SendGrid account, DNS access | Emails from `@essenmed.com` delivered, not spam |
| Configure Azure Communication Services (SMS) | IT | ACS resource created | Test SMS delivered to staff phone |

### Week 5–6: Bot Activation

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Configure DEA portal credentials + TOTP secret in Key Vault | Credentialing Manager / DevOps | DEA portal access, TOTP secret | Bot authenticates and completes MFA |
| Test license verification bot (5 states) | Developer + QA | — | Bot verifies 5 licenses, saves PDFs, creates records |
| Test DEA verification bot | Developer + QA | DEA credentials | Bot verifies DEA, handles TOTP, saves PDF |
| Test NCCPA, ABIM, ABFM board bots | Developer + QA | — | Each bot produces valid verification record |
| Test OIG sanctions bot | Developer + QA | — | Returns clear/flagged result with PDF |
| Configure SAM.gov API key | DevOps | SAM.gov API key obtained | API returns exclusion data for test NPI |
| Configure NPDB entity credentials | Credentialing Manager / DevOps | NPDB entity account | NPDB query returns result for test provider |
| Configure enrollment portal credentials (My Practice Profile, Availity, Verity, EyeMed) | Credentialing Manager / DevOps | Portal access | Each bot logs in and navigates to enrollment section |
| Configure eMedNY portal credentials | Credentialing Manager / DevOps | eMedNY access | Bot accesses eMedNY portal successfully |
| End-to-end bot test: full PSV suite for 3 test providers | QA | All bots configured | All bots complete, all records created, all PDFs stored |

### Week 7–8: Integration Validation & Hardening

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Load test: 50 concurrent bot runs | Developer | All bots configured | No queue failures, all complete within 30 min |
| Validate Azure Blob file naming conventions | QA | Bot tests complete | All files follow legacy naming convention |
| Test notification pipeline (email + in-app) | QA | SendGrid configured | All notification types delivered correctly |
| Validate audit trail completeness | QA | All integrations active | Every action logged with actor, timestamp, details |
| Security review: verify no PHI in logs | Security / Developer | — | Grep of all logs shows zero SSN/DOB values |
| Integration health dashboard validation | QA | All integrations active | Admin dashboard shows status of all 21 integrations |
| Document all integration configurations | Developer | — | Runbook created for each integration |

---

## Phase 3: Training & Pilot (Q3 2026 — July–August)

**Duration**: 8 weeks  
**Goal**: Train all credentialing staff, run a controlled pilot with 10–20 live providers, validate end-to-end workflows.

### Week 1–2: Training Preparation

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Finalize user training guide (docs/user-training.md) | Training Lead | Phase 2 complete | Guide covers all workflows, screenshots current |
| Create role-specific quick reference cards | Training Lead | — | One-page card for each of 5 roles |
| Create training environment with demo data | Developer | — | Training instance seeded with 50 demo providers |
| Schedule training sessions (4 sessions) | Training Lead / Manager | Staff calendars | Sessions confirmed for all credentialing staff |
| Prepare training videos (screen recordings) | Training Lead | Training env ready | 5 videos: login, onboarding, bots, committee, enrollments |

### Week 3–4: Staff Training

| Session | Audience | Duration | Content |
|---------|----------|----------|---------|
| Session 1: Overview & Navigation | All staff | 2 hours | Login, dashboard, provider search, role permissions |
| Session 2: Onboarding Workflow | Specialists + Managers | 3 hours | Add provider, manage checklist, trigger bots, tasks, communications |
| Session 3: Committee & Approvals | Managers + Committee Members | 2 hours | Sessions, agendas, approvals, denials, deferrals |
| Session 4: Enrollments & Expirables | Specialists + Managers | 2 hours | Enrollment records, follow-up cadence, expirable monitoring |

Each session includes:
- Live demonstration on training environment
- Hands-on practice (each attendee performs tasks on demo data)
- Q&A
- Post-session survey for feedback

### Week 5–8: Pilot

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Select 10–20 pilot providers (new hires preferred) | Credentialing Manager | Training complete | Providers selected, not yet in PARCS |
| Onboard pilot providers through new platform | Specialists | Training complete | All 10–20 providers created, applications started |
| Run PSV bots on all pilot providers | Specialists | Bot activation complete | All verifications complete or flagged appropriately |
| Process 2–3 providers through full committee review | Manager | Committee training | Providers approved/denied through platform |
| Create enrollment records for approved providers | Specialists | Approvals complete | At least 5 enrollment records with follow-up cadences |
| Track expirables for pilot providers | Specialists | Providers in system | Expirable records created and alerts firing |
| Daily standup: pilot feedback (15 min) | Training Lead + Team | — | Issues logged and resolved within 24 hours |
| Weekly pilot review: metrics + feedback | Manager + Developer | — | Metrics tracked: time-to-credential, bot success rate |

### Pilot Success Criteria

| Metric | Target |
|--------|--------|
| Time to credential (invite → committee ready) | < 20 days |
| Bot success rate (no manual fallback needed) | > 90% |
| Staff satisfaction survey | > 4.0 / 5.0 |
| Zero compliance gaps (no missed expirations) | 100% |
| Zero data loss incidents | 100% |
| All audit trail entries present | 100% |

---

## Phase 4: Full Rollout (Q3–Q4 2026 — September–October)

**Duration**: 8 weeks  
**Goal**: Migrate all active providers from PARCS, transition all credentialing operations, decommission PARCS.

### Week 1–2: Data Migration

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Export all active provider data from PARCS | Developer + Manager | PARCS data access | CSV/JSON export of all active providers |
| Build migration script: PARCS → Platform | Developer | Export complete | Script imports providers, preserving all fields |
| Map PARCS fields to platform fields | Developer + Manager | — | Field mapping document reviewed and approved |
| Import provider records (dry run on staging) | Developer | Migration script ready | All providers imported, zero data loss |
| Validate imported data (spot-check 20 providers) | QA + Specialists | Dry run complete | All 20 providers match PARCS records exactly |
| Import production data | Developer | Validation passed | All active providers in platform |

### Week 3–4: Document Migration

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Inventory K: drive PCD folders | Developer | K: drive access | Count of providers and files documented |
| Build K: drive → Azure Blob migration script | Developer | Blob container ready | Script copies files maintaining naming convention |
| Run document migration (batch) | Developer | Script tested | All files in Azure Blob, linked to provider records |
| Validate document migration (spot-check 20 providers) | QA | Migration complete | All 20 providers have all expected documents |
| Link imported documents to checklist items | Developer | Documents in Blob | Checklist reflects migrated documents |

### Week 5–6: Operational Transition

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| All new providers onboarded through platform (no more PARCS) | Manager | Data migration complete | Zero new records in PARCS |
| All bot verifications running through platform | Specialists | Bots active | Zero manual website checks |
| All enrollment tracking in platform | Specialists | Data imported | PARCS enrollment sheets retired |
| All expirable tracking in platform | Specialists | Data imported | Spreadsheet tracking retired |
| Committee sessions conducted in platform | Manager | Committee trained | No paper agendas or manual summary sheets |
| Daily PARCS → Platform reconciliation | QA | Both systems active | Records match, no orphaned data |

### Week 7–8: PARCS Decommissioning

| Task | Owner | Dependencies | Acceptance Criteria |
|------|-------|-------------|---------------------|
| Final PARCS data export (archival) | Developer / IT | All data migrated | Full PARCS database archived |
| K: drive PCD folder archived (read-only) | IT | Documents migrated | K: drive set to read-only, no new writes |
| PARCS access revoked for staff | IT / Manager | Full rollout confirmed | No staff logging into PARCS |
| PARCS sunset announcement | Manager | — | All stakeholders notified |
| 30-day hold: PARCS archived but accessible if needed | IT | — | Emergency rollback possible for 30 days |
| PARCS decommissioned | IT | 30-day hold passed | PARCS offline |

---

## Phase 5: Optimization (Q4 2026 — Ongoing)

**Duration**: Ongoing  
**Goal**: Continuous improvement based on operational data and user feedback.

### Planned Enhancements

| Enhancement | Priority | Timeline |
|-------------|----------|----------|
| Provider self-service portal (magic link or Azure AD B2B) | High | Q4 2026 |
| CAQH attestation auto-renewal bot | High | Q4 2026 |
| Bulk enrollment submission tool | Medium | Q4 2026 |
| Advanced reporting & analytics dashboard | Medium | Q1 2027 |
| Mobile-responsive UI optimization | Medium | Q1 2027 |
| Azure Container Apps migration (from VPS) | Low | Q2 2027 |
| CI/CD pipeline (GitHub Actions) | Medium | Q1 2027 |
| NPDB continuous query webhook integration | Low | Q2 2027 |

---

## Risk Register

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| External website changes break PSV bots | Medium | High | Bot framework designed for easy selector updates. Retry + manual fallback. Monitor bot success rates. |
| PARCS data export quality issues | Medium | Medium | Dry-run migration on staging. Spot-check validation. Manual correction buffer. |
| Staff resistance to new system | Low | Medium | Early involvement in pilot. Training with hands-on practice. Quick feedback loops. |
| Azure AD configuration delays | Low | High | Start Azure AD app registration in Phase 2 Week 1. Engage IT early. |
| iCIMS API access delays | Medium | Medium | Manual provider creation available as fallback. CAQH ingestion as alternative. |
| DEA portal MFA changes | Low | High | TOTP secret rotatable in Key Vault. Manual fallback for DEA verification. |
| Document migration file corruption | Low | High | Checksum validation on all migrated files. K: drive preserved read-only for 90 days. |

---

## Resource Requirements

| Role | FTE | Phase 2 | Phase 3 | Phase 4 | Phase 5 |
|------|-----|---------|---------|---------|---------|
| Developer | 1.0 | Full time | Part time | Full time | Part time |
| QA/Tester | 0.5 | Part time | Part time | Full time | — |
| DevOps/IT | 0.25 | Part time | — | Part time | — |
| Credentialing Manager | 0.25 | Part time | Full time | Full time | Part time |
| Training Lead | 0.25 | — | Full time | Part time | — |

---

## Success Metrics

| Metric | Current (PARCS) | Target (Platform) | Measurement Method |
|--------|----------------|-------------------|-------------------|
| Average time to credential | 45+ days | < 18 days | System timestamp: invite → approved |
| Manual PSV hours per provider | 3–4 hours | < 30 minutes | Bot run duration + manual fallback time |
| Expired credential discovery | Reactive (days/weeks late) | Proactive (90-day advance) | Expirable alert lead time |
| Committee prep time | 2–3 hours per session | < 15 minutes | Auto-generation time |
| Enrollment follow-up compliance | ~60% on-time | > 95% on-time | Follow-up cadence adherence rate |
| Audit trail completeness | Partial / manual | 100% automated | Random audit sampling |

---

## Governance

- **Executive Sponsor**: [TBD — CTO or VP of Operations]
- **Project Manager**: Credentialing Manager
- **Technical Lead**: Lead Developer
- **Weekly Status Report**: Every Friday, distributed to all stakeholders
- **Steering Committee Review**: Monthly, during Phase 2–4
- **Go/No-Go Decision Points**: End of Phase 2 (proceed to pilot?), End of Phase 3 (proceed to full rollout?)
