# ESSEN Credentialing Platform — Open Questions

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Active — must be resolved before implementation of affected module

---

## How to Use This Document

Each open question is tagged with:
- **Priority**: `Blocking` (cannot build the module without this answer) | `High` (needed before sprint starts) | `Medium` (needed before feature is built) | `Low` (can decide during implementation)
- **Affects**: Which module(s) or document(s) are impacted
- **Owner**: Who at Essen needs to answer this

When a question is resolved, move it to the Resolved section at the bottom with the answer and date.

---

## Open Questions

---

### Q1: Committee Agenda Format

**Priority**: High
**Affects**: Module 3 (Committee Dashboard), scope.md, credentialing-bots.md
**Owner**: Credentialing Manager

**Question**: What does the committee agenda look like? A sample agenda format was referenced in requirements but not yet provided.

**Why it matters**: The platform auto-generates committee agenda PDFs. The format, layout, and content of this document must match what committee members and medical directors expect.

**What we need**: A sample agenda (even a Word doc or PDF of an old one). Key items to confirm:
- What information is shown per provider on the agenda?
- What order are sections presented?
- Are there signature blocks / vote recording sections?
- Is there a cover page?
- What fonts/branding are expected?

---

### Q2: Provider Authentication Method

**Priority**: Blocking (for Module 1 — Onboarding)
**Affects**: Module 1 (Provider Onboarding), integrations.md, data-model.md
**Owner**: IT / Credentialing Manager

**Question**: How should external providers (non-Essen employees) log into the credentialing application?

**Options**:
1. **Azure AD B2B Guest Invite** — Provider gets a guest invite to Essen's Azure AD tenant. Clean, consistent with staff auth. Requires provider to have or create a Microsoft account.
2. **Email/password (custom auth)** — Provider creates their own credentials in the platform. Requires Essen to manage password resets, account recovery, etc.
3. **Magic Link** — Provider receives a one-time login link via email. No password needed; each session requires a new link. Simplest for one-time use.
4. **Social login** — Provider logs in with Google or Microsoft personal account via OAuth. Reduces friction.

**Recommendation**: Azure AD B2B or Magic Link — both avoid password management overhead and are appropriate for an infrequent-use portal.

---

### Q3: Provider Type Taxonomy — Document Checklist Differences

**Priority**: High
**Affects**: Module 1 (Onboarding), data-model.md (DocumentRequirement)
**Owner**: Credentialing Manager / Credentialing Specialists

**Question**: For each provider type (MD, DO, PA, NP, LCSW, LMHC, and any others), what is the exact list of required, conditional, and not-applicable documents?

**Why it matters**: The platform generates a customized document checklist based on provider type. If the requirements are wrong, providers will be asked for the wrong documents.

**What we need**: A complete matrix like:

| Document | MD | DO | PA | NP | LCSW | LMHC |
|----------|----|----|----|----|------|------|
| Medical School Diploma | Required | Required | N/A | N/A | N/A | N/A |
| ECFMG Certificate | Conditional (IMG) | Conditional (IMG) | N/A | N/A | N/A | N/A |
| DEA Certificate | Required | Required | Required | Required | N/A | N/A |
| Board Certification | Required | Required | Required | Required | Required | Required |
| … | … | … | … | … | … | … |

Essen team to provide this completed matrix.

---

### Q4: iCIMS Webhook / Event Configuration

**Priority**: High
**Affects**: integrations.md, Module 1 (Onboarding)
**Owner**: IT / iCIMS Admin

**Question**: Which iCIMS workflow status should trigger the credentialing platform to create a new provider record and pull demographics?

**Specific questions**:
- What is the exact iCIMS status name (e.g., "Offer Accepted," "Hire," "Credentialing")?
- Does iCIMS support outbound webhooks, or does the platform need to poll the iCIMS API?
- Who owns the iCIMS API credentials and what is the approval process for API access?
- Is the iCIMS sandbox environment available for integration testing?

---

### Q5: CAQH API Contract / Access

**Priority**: Blocking (for CAQH integration feature)
**Affects**: integrations.md, Module 1 (Onboarding), Module 4 (Enrollments — CAQH updates)
**Owner**: Credentialing Manager / Leadership

**Question**: Does Essen currently have a CAQH ProView API agreement, or does this need to be established?

**Specific questions**:
- Does Essen have active CAQH API credentials (Client ID, API key)?
- Is the current CAQH access read-only (what we're using for ingestion) or does it include write access for CAQH updates?
- If no API contract exists, who initiates the application with CAQH? (CAQH requires an agreement for API access)

**Note**: If CAQH API is not yet available, CAQH ingestion will need to fall back to a manual entry process until the API contract is in place.

---

### Q6: DEA Portal — Exact URL and MFA Type Confirmation

**Priority**: Blocking (for DEA bot)
**Affects**: credentialing-bots.md, integrations.md
**Owner**: Credentialing Specialists who currently perform DEA verification

**Question**: What is the exact DEA Diversion Control portal URL used for DEA number verification? And what MFA method does it use?

**Specific questions**:
- Is the DEA verification portal `https://www.deadiversion.usdoj.gov/` or a different URL?
- What MFA method is used — Authenticator app (TOTP), SMS code, or email code?
- If TOTP: Can Essen obtain the TOTP shared secret by re-registering the MFA device? (Required for bot automation)
- If SMS: Is there a dedicated phone number that can receive SMS for automation purposes?
- Who currently handles DEA MFA at Essen?

---

### Q7: NPDB Entity Registration

**Priority**: Blocking (for NPDB bot)
**Affects**: credentialing-bots.md, integrations.md
**Owner**: Credentialing Manager / Leadership

**Question**: Is Essen currently registered as a querying entity with the NPDB?

**Specific questions**:
- Does Essen have an active NPDB entity account with username, password, and entity ID?
- Is Essen enrolled in NPDB's Continuous Query service for any currently credentialed providers?
- If not registered: who initiates NPDB registration? (Requires an authorized querying organization — typically healthcare organizations, hospitals, or credentialing entities)

---

### Q8: Additional Provider Types

**Priority**: Medium
**Affects**: data-model.md (ProviderType), Module 1 (Onboarding)
**Owner**: Credentialing Manager

**Question**: Beyond the initial 6 (MD, DO, PA, NP, LCSW, LMHC), what other provider types does Essen currently credential or plan to credential?

**Examples that may apply**: RN, LPN, CRNA, CNM, DDS, OD, DC, DPM, BCBA, psychologist (PhD/PsyD), etc.

These can be added incrementally via the Admin configuration — no code changes needed. However, knowing them upfront helps with initial setup and testing.

---

### Q9: Specialty Board Coverage Beyond ABIM/ABFM/NCCPA

**Priority**: Medium
**Affects**: credentialing-bots.md, Module 6 (Bots)
**Owner**: Credentialing Specialists

**Question**: Which specialty boards beyond NCCPA (PA), ABIM (Internal Medicine), and ABFM (Family Medicine) need automated board verification?

**Examples**:
- ABPN (American Board of Psychiatry and Neurology) — for psychiatrists
- ABP (American Board of Pediatrics)
- ABS (American Board of Surgery)
- AAFP (American Academy of Family Physicians — for AAFP certification, distinct from ABFM)
- ABIM subspecialties
- NASW (National Association of Social Workers — for LCSW)
- NBCC (National Board for Certified Counselors — for LMHC)

For each board needed: provide the verification URL, required inputs, and output format.

---

### Q10: Hospital Privilege Facilities List

**Priority**: Medium
**Affects**: Module 9 (Hospital Privileges), data-model.md
**Owner**: Credentialing Manager

**Question**: What is the list of facilities where Essen seeks hospital privileges for its providers?

**Why it matters**: Hospital privilege tracking is per-provider per-facility. Knowing the facilities helps pre-populate dropdown options and may enable facility-specific bot workflows if those facilities have online verification portals.

---

### Q11: Expirables Renewal Cadences

**Priority**: Medium
**Affects**: Module 5 (Expirables), data-model.md
**Owner**: Credentialing Specialists

**Question**: For each expirable type, what is Essen's internal renewal alert cadence (when should the first alert fire)?

**Default cadences assumed** (in scope.md) — please confirm or correct:

| Expirable | Assumed Cadence | Correct? |
|-----------|-----------------|----------|
| ACLS/BLS/PALS | 2 years | ❓ |
| Infection Control | 1-2 years | ❓ |
| Pain Management certs | Annually | ❓ |
| Flu Shot | Annually | ❓ |
| Physical Exam | Annually | ❓ |
| CAQH Attestation | Every 120 days | ❓ |
| Medicaid Revalidation | Every 5 years | ❓ |
| Medicare Revalidation | Every 5 years | ❓ |
| State License | Per state | ❓ |
| DEA | Every 3 years | ❓ |
| Board Certification | Per board | ❓ |

Also: At what lead time should the first alert fire? (90 days before expiry? 60?)

---

### Q12: Payer Follow-Up Cadences

**Priority**: Medium
**Affects**: Module 4 (Enrollments)
**Owner**: Credentialing Specialists

**Question**: For each payer, how many days after submission should the first follow-up occur, and how often should follow-ups repeat?

**Example format needed**:

| Payer | First Follow-Up (days after submission) | Repeat Every (days) |
|-------|----------------------------------------|---------------------|
| UHC | ? | ? |
| Anthem | ? | ? |
| MetroPlus | ? | ? |
| eMedNY | ? | ? |
| … | … | … |

---

### Q13: Tech Stack Selection

**Priority**: Blocking (for implementation)
**Affects**: Architecture, all modules
**Owner**: Credentialing Manager + IT/Development Lead

**Question**: What tech stack will this platform be built on?

**Factors to weigh**:
- Must support Azure AD SSO (all web frameworks support this)
- Must support Playwright browser automation (Node.js is native; Python also works)
- Should integrate with Azure services (Blob, Key Vault, Communication Services)
- Bot-heavy workload suggests a strong background job queue is essential
- OCR/AI document processing: Azure AI Document Intelligence (formerly Form Recognizer) is a natural fit given Azure alignment

**Leading candidates**:
1. **Next.js (Node.js) + PostgreSQL** — Full-stack, Playwright native, Azure-friendly
2. **React + Node.js/Express API + PostgreSQL** — Explicit frontend/backend separation
3. **Python FastAPI + React + PostgreSQL** — Strongest Python bot ecosystem (pyotp, Playwright Python)

---

### Q14: Deployment Environment

**Priority**: High (needed for architecture decisions)
**Affects**: Architecture, integrations.md
**Owner**: IT

**Question**: Where will the platform be hosted?

**Expected answer**: Azure (consistent with Azure AD, Blob Storage, Key Vault decisions already made). Specific service TBD:
- Azure App Service (simplest)
- Azure Container Apps (containerized, scalable)
- Azure Kubernetes Service (AKS — complex but highly scalable)

Also needed:
- Azure subscription and resource group details
- Azure region preference (East US, East US 2, etc.)
- Whether a staging/dev environment will be maintained separately

---

### Q15: Reporting Requirements

**Priority**: Low
**Affects**: Scope (cross-cutting)
**Owner**: Credentialing Manager / Leadership

**Question**: What reports or analytics does the team need from the platform?

**Possible reports** (confirm which are needed):
- Provider pipeline summary (count by stage, average days in each stage)
- Time-to-credentialing (days from invite to approval)
- Bot success/failure rates
- Expirables summary (upcoming expirations by type)
- Enrollment status by payer
- Sanctions check history
- Audit log export
- Committee approval rates and session frequency

Are there any external reporting requirements (regulatory, leadership dashboards, board reports)?

---

## Resolved Questions

| # | Question | Answer | Resolved Date |
|---|----------|--------|---------------|
| R1 | Does this platform replace PARCS? | Yes — replaces PARCS credentialing functionality entirely. New system of record. | 2026-04-14 |
| R2 | Is Medallion (CVO) an active integration? | No — Medallion was the "buy" option. Medallion diagrams are reference only. | 2026-04-14 |
| R3 | Initial provider types | MD, DO, PA, NP, LCSW, LMHC — extensible via admin for additional types | 2026-04-14 |
| R4 | Sanctions checking (OIG/SAM) in scope? | Yes | 2026-04-14 |
| R5 | NY Medicaid ETIN in scope? | Yes — dedicated module | 2026-04-14 |
| R6 | Hospital Privileges in scope? | Yes | 2026-04-14 |
| R7 | NPDB in scope? | Yes | 2026-04-14 |
| R8 | DEA MFA approach | Fully automated preferred. TOTP via Azure Key Vault. Minimize human tasks. | 2026-04-14 |
| R9 | HRIS system | iCIMS — use iCIMS REST API | 2026-04-14 |
| R10 | File storage (K: drive) | Replace with Azure Blob Storage. Dual-write during transition. | 2026-04-14 |
| R11 | Staff auth method | Microsoft Azure AD SSO | 2026-04-14 |
