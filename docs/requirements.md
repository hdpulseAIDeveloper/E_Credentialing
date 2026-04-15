# ESSEN Credentialing Platform — Requirements Document

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Status**: Active — Updated as features are implemented  
**Owner**: HDPulse / Essen Medical Credentialing Team  

---

## 1. Purpose & Scope

The ESSEN Credentialing Platform is an internally built healthcare provider credentialing system that **replaces PARCS** (the previous credentialing system). It serves as the new system of record for all provider credentialing activity at Essen Medical.

This document defines what the platform must do, organized by functional module. It is the authoritative source for feature requirements and should be updated any time scope changes.

---

## 2. Stakeholders

| Role | Responsibility |
|------|---------------|
| Credentialing Specialists | Primary end users — manage daily credentialing workflow |
| Credentialing Managers | Oversee team, approve escalations, run reports |
| Committee Members | Review and vote on provider approvals |
| System Administrators | Manage users, provider types, system config |
| Providers | Complete their own credentialing applications |
| IT / DevOps | Infrastructure, security, deployments |

---

## 3. Business Requirements

### BR-001 — Replace PARCS
The platform must fully replace PARCS as Essen's system of record for provider credentialing. All active provider records must be migrated or re-entered.

### BR-002 — Single Source of Truth
All credentialing documents, verification results, enrollment records, and audit history must be stored in this platform. The K: drive is no longer the document store.

### BR-003 — HIPAA Compliance
All PHI (Protected Health Information) stored in the system must be encrypted at rest (AES-256) and in transit (TLS 1.2+). Access must be role-based with full audit logging.

### BR-004 — Audit Trail
Every create, update, status change, and document action must be logged with actor identity, timestamp, before/after state, and reason where applicable.

### BR-005 — Azure AD Authentication
All Essen staff must authenticate via Microsoft Azure AD SSO. No separate credential management for internal users.

### BR-006 — Automated Primary Source Verification
The platform must automate PSV for at least: state medical licenses, DEA registrations, board certifications, OIG sanctions, and SAM.gov sanctions.

### BR-007 — Payer Enrollment Tracking
The platform must track all payer enrollment records (delegated, direct, and BTC/facility) including status, submission dates, follow-ups, and effective dates.

### BR-008 — Expirables Monitoring
The platform must track credentials with expiration dates and alert staff at 90, 60, 30, and 14 days before expiration.

### BR-009 — Reporting
Managers must be able to export provider status lists, enrollment summaries, expirables due, and committee agendas.

---

## 4. Functional Requirements by Module

### Module 1: Provider Onboarding

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M1-001 | Staff can add a new provider with name, provider type, NPI, and contact info | P0 | Implemented |
| M1-002 | System sends invite email with time-limited application link | P0 | Planned |
| M1-003 | Provider can complete online application form | P0 | Partial |
| M1-004 | System pre-populates application from CAQH API | P1 | Planned |
| M1-005 | System pre-populates demographics from iCIMS REST API | P1 | Planned |
| M1-006 | Provider can upload credential documents | P0 | Partial |
| M1-007 | Provider completes electronic attestation | P1 | Planned |
| M1-008 | Staff can reassign providers to different specialists | P0 | Implemented |

### Module 2: Onboarding Dashboard

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M2-001 | Staff can view all providers with status filtering and search | P0 | Implemented |
| M2-002 | Provider detail page shows all sections (info, docs, verifications, tasks, comms, enrollments, expirables) | P0 | Implemented |
| M2-003 | Staff can update provider status through defined workflow states | P0 | Implemented |
| M2-004 | Staff can create and assign tasks to team members | P0 | Implemented |
| M2-005 | Staff can mark tasks complete | P0 | Implemented |
| M2-006 | Staff can log communications (call, email, SMS) | P1 | Partial |
| M2-007 | Staff can view full audit trail per provider | P1 | Partial |

### Module 3: Committee Dashboard

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M3-001 | System lists providers ready for committee review | P0 | Implemented |
| M3-002 | Staff can create committee sessions with date and agenda | P0 | Implemented |
| M3-003 | System generates committee summary sheet per provider | P1 | Planned |
| M3-004 | Committee members can vote (approve/deny/defer) per provider | P0 | Implemented |
| M3-005 | System records denial and deferral reasons | P0 | Implemented |
| M3-006 | System generates committee agenda PDF | P2 | Planned |

### Module 4: Enrollments

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M4-001 | Staff can create enrollment records per provider per payer | P0 | Implemented |
| M4-002 | Staff can update enrollment status | P0 | Implemented |
| M4-003 | Staff can log follow-up activity on enrollments | P0 | Implemented |
| M4-004 | System tracks follow-up due dates and shows overdue enrollments | P0 | Implemented |
| M4-005 | System stores payer confirmation numbers and effective dates | P0 | Implemented |
| M4-006 | Enrollment list is filterable by status, payer, and provider | P1 | Partial |

### Module 5: Expirables Tracking

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M5-001 | System tracks expirable credentials with expiration dates | P0 | Implemented |
| M5-002 | Dashboard shows expirables sorted by soonest expiring | P0 | Implemented |
| M5-003 | Color-coded urgency: expired (red), <14d (red), <30d (orange), <60d (yellow), OK (green) | P0 | Implemented |
| M5-004 | Staff can mark credentials as renewed | P1 | Planned |
| M5-005 | System sends automated renewal reminder emails to providers | P1 | Planned |
| M5-006 | System alerts staff at 90/60/30/14 day thresholds | P1 | Planned |

### Module 6: Credentialing Bots (PSV)

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M6-001 | Bots run automated PSV for state medical licenses | P0 | Implemented |
| M6-002 | Bots run automated PSV for DEA registrations | P0 | Implemented |
| M6-003 | Bots run automated PSV for board certifications | P0 | Implemented |
| M6-004 | Bots run automated OIG sanctions checks | P0 | Implemented |
| M6-005 | Bots run automated SAM.gov sanctions checks | P0 | Implemented |
| M6-006 | Bot results (status, PDF, notes) are saved to the provider record | P0 | Implemented |
| M6-007 | Bot status updates are shown in real-time via Socket.io | P1 | Implemented |
| M6-008 | Staff can manually trigger individual bot runs from the provider page | P0 | Implemented |
| M6-009 | Bot PDFs are uploaded to Azure Blob Storage | P0 | Planned |

### Module 7: Sanctions Checking

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M7-001 | System queries OIG exclusion list by NPI and name | P0 | Implemented |
| M7-002 | System queries SAM.gov exclusion list | P0 | Implemented |
| M7-003 | Sanctions check results are stored with run date and result | P0 | Implemented |
| M7-004 | Flagged results are visually highlighted in the provider record | P0 | Implemented |
| M7-005 | Staff can trigger on-demand sanctions re-checks | P0 | Implemented |

### Module 8: NY Medicaid / ETIN

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M8-001 | Track NY Medicaid enrollment status per provider | P1 | Planned |
| M8-002 | Track ETIN affiliation per facility | P1 | Planned |
| M8-003 | Automate eMedNY enrollment submission | P2 | Planned |

### Module 9: Hospital Privileges

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M9-001 | Track hospital privilege applications per provider per facility | P1 | Planned |
| M9-002 | Track privilege approval status and renewal dates | P1 | Planned |

### Module 10: NPDB

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| M10-001 | System stores NPDB query results per provider | P0 | Implemented |
| M10-002 | Staff can initiate NPDB queries | P0 | Implemented |
| M10-003 | System supports NPDB continuous monitoring flag | P1 | Planned |

---

## 5. Non-Functional Requirements

### NFR-001 — Performance
- Page load time < 2 seconds for all staff-facing pages under normal load
- Bot job queue must process at least 10 concurrent jobs without degradation

### NFR-002 — Availability
- Target uptime: 99.5% during business hours (M–F 8am–6pm ET)
- Planned maintenance windows during off-hours with advance notice

### NFR-003 — Security
- All PHI encrypted at rest (AES-256-GCM) and in transit (TLS 1.2+)
- Role-based access control enforced at the API layer (tRPC procedures)
- All destructive actions require ADMIN role
- Session tokens expire after 8 hours of inactivity

### NFR-004 — Auditability
- Every data mutation generates an audit log entry
- Audit logs are immutable (append-only, no deletes)
- Logs include: actor ID, role, action, entity type/ID, before/after state, timestamp

### NFR-005 — Scalability
- Platform must support up to 500 concurrent providers in the system
- Document storage scales via Azure Blob Storage (no local disk reliance)

---

## 6. Out of Scope (Current Phase)

- Patient-facing features
- Billing/claims integration
- Telemedicine credentialing workflows
- Multi-tenant (other organizations) support
- Mobile native app (web-responsive only)

---

## 7. Change Log

| Date | Version | Change | Author |
|------|---------|--------|--------|
| 2026-04-14 | 0.1 | Initial requirements from planning docs | HDPulse |
| 2026-04-15 | 1.0 | Updated status for implemented features; added NFRs | Claude Code |
