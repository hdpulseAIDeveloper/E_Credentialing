# ESSEN Credentialing Platform — Functional Scope

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Draft — Pending stakeholder review

---

## Overview

This document defines the complete functional scope of the ESSEN Credentialing Platform across all 10 modules. It serves as the primary specification artifact and should be kept in sync with any implementation changes.

Every feature is described with:
- **What** it does
- **Who** initiates or uses it
- **When** it is triggered
- **Business rules** (conditions, validations, edge cases)
- **Data inputs/outputs**
- **UI/UX behavior**
- **Error/exception handling**

---

## Module 1: Provider Onboarding

### 1.1 Purpose

The onboarding module covers the full lifecycle from initial outreach to a completed credentialing application. It is the entry point for all new providers and produces a complete, verified application packet ready for committee review.

### 1.2 Outreach & Account Creation

**What**: An automated email is sent to a new provider inviting them to begin their credentialing application. The email contains a single prominent call-to-action button: "BEGIN APPLICATION."

**Who**: Triggered by a Credentialing Specialist or Credentialing Manager when a provider is added to the system (e.g., after a signed offer or contract).

**When**: Manually initiated by staff, or automatically triggered via iCIMS integration when a new hire's status changes to a credentialing-eligible state.

**Business rules**:
- Each provider must have a unique email address in the system before the outreach email can be sent.
- The outreach email link must be a unique, time-limited token (72-hour expiry) tied to that provider's record.
- If the link expires before the provider clicks it, staff can regenerate and resend it.
- A provider cannot have more than one active application at a time.
- The audit trail must record: who sent the outreach, when, and to which email address.

**Account creation**:
- Provider clicks the link → landing page prompts them to create login credentials.
- Provider auth method (Azure AD B2B, email/password, or magic link) — TBD; see `open-questions.md`.
- On account creation, a provider profile record is initialized in the database with status `onboarding_invited`.
- Provider is redirected to the application form upon successful account creation.

**Email content**:
- From: `cred_onboarding@essenmed.com`
- Subject: "Begin Your Credentialing Application — Essen Medical"
- Body: Brief welcome message + one large "BEGIN APPLICATION" button
- No credential data in the email body

**Error handling**:
- If email delivery fails, the system retries 3 times (15 min, 1 hr, 4 hr intervals) and then flags the record for manual follow-up.
- Staff are alerted via the onboarding dashboard if delivery fails after all retries.

---

### 1.3 Data Ingestion

When a provider begins their application, the system attempts to pre-populate their profile from up to three sources. The provider may correct or supplement any pre-populated data.

#### 1.3.1 CAQH Ingestion

**What**: If the provider has an existing CAQH profile, the system fetches their demographics and credential data via the CAQH API.

**When**: Provider enters their CAQH ID during onboarding, or staff enters it manually.

**Data ingested from CAQH**:
- Full legal name, date of birth, SSN (if available)
- NPI, DEA number
- License(s): state, number, type, expiration
- Board certifications
- Malpractice insurance details
- Work history, education/training
- Practice locations and hours

**Business rules**:
- CAQH integration is one-way ingest only — Essen reads from CAQH, does not write back through this ingestion step (CAQH is updated separately in the Enrollments module).
- If a CAQH ID is invalid or the provider has no CAQH profile, the system skips CAQH ingestion and falls back to photo ID / HRIS.
- All CAQH-populated fields are visually flagged as "pre-filled from CAQH" so the provider can verify accuracy.
- CAQH data is treated as a starting point, not authoritative — provider must attest to accuracy.

**Error handling**:
- If the CAQH API is unavailable, the system retries once and then proceeds without CAQH data, alerting the provider that CAQH import was unavailable.

#### 1.3.2 Photo Identification OCR

**What**: Provider uploads a photo of their government-issued ID (passport or driver's license). The system uses OCR to extract name, date of birth, and ID number.

**When**: Provider uploads ID during onboarding if no CAQH ID is available, or to supplement CAQH data.

**Accepted formats**: JPEG, PNG, PDF. Max file size: 20MB.

**Data extracted**:
- Full legal name
- Date of birth
- ID number (driver's license number or passport number)
- State/country of issuance
- Expiration date of the ID

**Business rules**:
- OCR confidence score must meet a minimum threshold (e.g., 85%). If below threshold, fields are left blank and flagged for manual entry.
- Extracted data pre-populates the application form fields; provider reviews and confirms.
- The original photo ID file is saved to Azure Blob Storage as a credential document.

**Error handling**:
- If OCR fails entirely, the system notifies the provider and prompts manual entry. The document is still saved.

#### 1.3.3 iCIMS (HRIS) Integration

**What**: When a provider exists in Essen's iCIMS HRIS system, their demographic data is automatically fetched and used to pre-populate the application.

**When**: At the time the provider record is created in the credentialing platform (triggered by a hire event in iCIMS, or by manual iCIMS ID entry).

**Data ingested from iCIMS**:
- Full legal name, preferred name
- Date of birth, SSN (if available)
- Home address, contact phone and email
- Job title, department, hire date
- Start date, facility/location assignment

**Business rules**:
- iCIMS data takes precedence over no data, but can be overridden by CAQH if both are available (CAQH is more credentialing-specific).
- Fields populated from iCIMS are flagged as "pre-filled from HR system."
- If the iCIMS ID cannot be matched, ingestion is skipped and the provider fills fields manually.

**Error handling**:
- iCIMS API errors are logged and the system falls back to manual entry.

---

### 1.4 Application Form

**What**: A multi-section web form that collects all information required for credentialing. Sections collapse and expand for ease of navigation.

**Who**: Completed by the provider (external). Pre-populated fields may be reviewed and corrected.

**Sections**:

1. **Personal Information** — legal name, preferred name, DOB, SSN (encrypted at rest), gender, languages spoken
2. **Contact Information** — home address, phone(s), email, emergency contact
3. **Professional Identifiers** — NPI (Type 1), DEA number, state license(s), Medicare PTAN, Medicaid ID, CAQH ID
4. **Education & Training** — medical school/graduate program, graduation year, ECFMG number (if applicable), internship/residency/fellowship (institution, dates, specialty)
5. **Board Certification** — certifying board(s), certification number, initial certification date, expiration date
6. **Work History** — current and past employment (employer, address, dates, supervisor)
7. **Malpractice Insurance** — carrier name, policy number, coverage amounts, effective/expiration dates
8. **Hospital Affiliations** — current and past hospital appointments (institution, privilege type, dates)
9. **Licenses & Registrations** — all state licenses (state, license number, type, status, expiration)
10. **Attestation Questions** — standard credentialing attestation (malpractice history, board actions, felony convictions, substance abuse, mental/physical health limitations, etc.)
11. **Attestation & Signature** — provider certifies all information is true and accurate; electronic signature with timestamp

**Business rules**:
- Required fields vary by provider type (MD, DO, PA, NP, LCSW, LMHC). Requirements are configured via the admin-managed `DocumentRequirement` table.
- Missing required fields are highlighted in RED and the provider cannot submit (attest) until all required fields are complete.
- Optional/conditional fields (e.g., ECFMG for international medical graduates only) are shown or hidden based on provider type and earlier answers.
- Provider may save progress and return — application is auto-saved every 60 seconds.
- Provider may not submit the application without electronic attestation.
- Application status transitions: `draft` → `in_progress` → `submitted` → `under_review` → `committee_ready` → `approved` / `denied`
- All field changes are recorded in the audit trail (before/after values).

**UI/UX behavior**:
- Each section shows a completion indicator (e.g., "3/5 fields complete").
- Entire application shows overall completion percentage.
- Collapsed sections display a summary line and completion status.
- Auto-save indicator shows last saved time.
- Provider is warned before navigating away if there are unsaved changes.

**Error handling**:
- Auto-save failures are displayed as a non-blocking warning. Provider is warned to manually save.
- Session timeout warning at 25 minutes of inactivity; session expires at 30 minutes. Draft is preserved.

---

### 1.5 Document Upload & OCR Auto-Population

**What**: A drag-and-drop file upload area where providers drop credential documents. The system runs OCR/AI extraction on each document and auto-populates the corresponding application form fields.

**When**: During or after filling out the application form (can be done in parallel).

**Supported document types and their target fields**:

| Document Type | Fields Auto-Populated |
|---------------|-----------------------|
| Photo ID | Name, DOB, ID number, expiration |
| SSN Card | SSN |
| Medical License | License number, state, expiration |
| DEA Certificate | DEA number, schedule, expiration |
| Board Certificate | Board name, certification number, expiration |
| Medical School Diploma | School name, degree, graduation year |
| Malpractice Insurance | Carrier, policy number, coverage amounts, dates |
| BLS/ACLS/PALS Card | Cert type, expiration date |
| Hospital Appointment Letter | Facility name, appointment type, effective date |
| Training Certificate | Institution, program type, dates |

**Business rules**:
- Each uploaded file is stored in Azure Blob Storage immediately upon upload.
- OCR extraction runs asynchronously; the user sees a "processing" indicator until complete.
- Extracted values are pre-filled in form fields with a visual indicator ("auto-filled from document"). Provider reviews and confirms or edits.
- If the same field is populated by both CAQH/HRIS and OCR, OCR takes precedence (more specific document), and the conflict is flagged for provider review.
- Documents previously received from HR are automatically ingested and appear in the checklist as pre-uploaded.
- Supported file formats: PDF, JPEG, PNG, DOCX. Max file size: 25MB per file.
- Maximum total documents per provider: 100 files (configurable).

**UI/UX behavior**:
- Drag-and-drop zone with file type indicators.
- Upload progress bar per file.
- After OCR: fields that were auto-populated are highlighted and the source document is linked.
- Provider can reject an auto-fill by clicking the field and editing manually.

**Error handling**:
- If OCR fails for a document, the document is saved and the provider is notified to fill the corresponding fields manually.
- Unsupported file types are rejected with a clear error message listing accepted formats.

---

### 1.6 Document Checklist

**What**: A visible, real-time checklist of all required documents for the provider's type, showing which have been received, which are pending, and which need attention.

**Statuses**:
- ✅ **Received** — document uploaded and present
- ⭕ **Pending** — document not yet uploaded; no issue
- ❗ **Needs Attention** — document is required and overdue, flagged by staff, or failed verification

**Provider-type-specific requirements** (configured in admin):
- Each document requirement is tagged as: `required`, `conditional` (e.g., ECFMG for IMGs), or `not_applicable` for a given provider type.
- Example: ECFMG Certificate is `required` for MD/DO with international medical degree, `not_applicable` for PA/NP/LCSW.

**Document types in checklist**:
- Photo ID
- SSN Card
- Current CV/Resume
- Professional Liability Insurance (past and current)
- Original License(s)
- Current and past license registrations (signed)
- DEA Certificate(s)
- Medical School Diploma / Graduate Certificate
- ECFMG Certificate (conditional — international MDs only)
- Board Certification
- CME credits documentation
- BLS Card
- ACLS Card
- PALS Card
- Infection Control Certificate (conditional)
- Child Abuse Certificate (conditional)
- Pain Management Certificate (conditional)
- Physical Exam — MMR titres proof
- Physical Exam — PPD result (if positive: Chest X-ray)
- Flu Shot documentation
- Hospital Appointment/Re-appointment Letters (all current facilities)
- Internship Certificate (conditional)
- Residency Certificate (conditional)
- Fellowship Certificate (conditional)

**Business rules**:
- The checklist is visible to both the provider (on their application) and to staff (on the onboarding dashboard).
- Staff can manually mark items as received, pending, or needing attention.
- When a document is uploaded and successfully OCR-processed, the corresponding checklist item automatically transitions to ✅.
- Documents received from HR (via HRIS integration or email) are auto-ingested and marked ✅ on the checklist.
- The provider cannot attest to their application while any `required` checklist item is ⭕ or ❗.
- Changes to checklist status are recorded in the audit trail.

---

## Module 2: Onboarding Dashboard

### 2.1 Purpose

The onboarding dashboard is the primary staff-facing workspace for managing active provider applications. It provides a unified view of all providers in the onboarding pipeline with tools for task management, communications, verification tracking, and audit.

### 2.2 Provider Pipeline View

**What**: A table/kanban view of all providers currently in the onboarding process, grouped by status stage.

**Stages displayed**:
- Invited (email sent, not yet started)
- In Progress (application partially complete)
- Documents Pending (application complete, waiting on documents)
- Verification In Progress (bots running PSV)
- Committee Ready (all complete, moved to committee queue)

**Per-provider information shown**:
- Provider name, type (MD/PA/NP/etc.)
- Application completion percentage
- Days since invited / days since last activity
- Number of pending checklist items
- Number of outstanding tasks assigned
- Active verification status (which bots are running)
- Quick-action buttons: Send Reminder, View Profile, Assign Task

**Business rules**:
- Specialists see all providers assigned to their queue. Managers see all providers.
- Providers can be filtered by stage, provider type, assigned specialist, or facility.
- Providers inactive for 7+ days are automatically flagged with a warning indicator.
- Providers inactive for 14+ days trigger an automatic reminder email (configurable threshold).

### 2.3 Task Management

**What**: A task system allowing staff to create, assign, and track action items related to specific providers.

**Who**: Credentialing Specialists and Managers.

**Task fields**:
- Title / description
- Assigned to (staff member)
- Provider (linked)
- Priority (High / Medium / Low)
- Due date
- Status (Open / In Progress / Completed / Blocked)
- Notes / comments thread

**Business rules**:
- Any staff member can create a task and assign it to any other staff member.
- Task notifications are sent to the assignee via email and in-app notification.
- Tasks overdue by 24+ hours are escalated — highlighted in red and a notification is sent to the Credentialing Manager.
- All task actions (create, assign, comment, complete) are recorded in the audit trail.
- Tasks are visible on the provider's profile page.

### 2.4 Communications

**What**: A unified communication log and sending interface for internal (staff-to-staff) and external (staff-to-provider) communications.

#### Internal Communications
- Staff can leave notes on a provider record visible to all team members.
- Notes support @mentions to notify specific staff members.
- All notes are timestamped and attributed.

#### External Communications (Provider Outreach)
**Channels**: Email, SMS, Phone (logged manually)

- **Email**: Composed in-platform using pre-configured templates. Sent from `cred_onboarding@essenmed.com`. Delivery status tracked.
- **SMS**: Short message sent to provider's phone number via Azure Communication Services or Twilio. Character limit: 160 characters for SMS, longer messages sent as MMS.
- **Phone**: Staff logs a phone call manually — date, time, duration, notes, outcome.

**One-click follow-up reminders**:
- Pre-configured reminder templates for common scenarios (e.g., "Missing Documents," "Application Incomplete," "Please Attest").
- Staff selects the template and the channel (email / SMS / phone log), then clicks Send.
- Reminder is logged in the communication history with timestamp and actor.

**Business rules**:
- All outgoing communications are logged in the provider's communication history.
- Staff cannot send an SMS without a confirmed phone number on file for the provider.
- Bulk reminders (sending the same reminder to multiple providers at once) are supported for Managers.

### 2.5 Verification Status Tracking

**What**: Real-time display of bot-driven PSV (Primary Source Verification) status per provider.

**Displayed per provider**:
- Each credential type being verified (license, DEA, boards, sanctions, NPDB, etc.)
- Bot status: Queued / Running / Completed / Failed / Needs Attention
- Last run time and result
- Link to the verification PDF in Azure Blob Storage

**Business rules**:
- Verification statuses update in real-time (via WebSockets or server-sent events) as bots complete.
- A failed bot run alerts the assigned specialist via in-app notification and email.
- Verification results that are flagged (e.g., license expired, sanction found) are shown with ❗ and require specialist acknowledgment before the application can proceed.

### 2.6 Audit Trail

**What**: A complete, tamper-proof log of every action taken in the system related to a provider record.

**Events logged**:
- Application created, viewed, modified (with before/after field values)
- Documents uploaded, deleted, or flagged
- Checklist item status changes
- Bot runs initiated, completed, failed
- Tasks created, assigned, commented, completed
- Communications sent (channel, content summary, delivery status)
- Status transitions (e.g., moved to Committee Ready)
- User logins and session activity on provider records

**Business rules**:
- Audit log entries are immutable — no entry may be edited or deleted.
- Each entry records: timestamp (UTC), actor (user ID + name), action type, entity affected, and change details.
- Audit log is accessible per-provider by Specialists and Managers, and system-wide by Admins.
- Audit logs must be retained for a minimum of 10 years (HIPAA/credentialing compliance).

---

## Module 3: Committee Dashboard

### 3.1 Purpose

The committee dashboard manages the final review and approval stage of the credentialing process. Providers enter this stage only after completing their entire application. The platform automates committee prep work that is currently done manually (summary sheet creation, agenda generation).

### 3.2 Entry into Committee Queue

**What**: A provider is automatically moved to the committee queue when all entry criteria are met.

**Entry criteria** (all must be true):
1. All required application fields are completed
2. All required documents have been uploaded (no ⭕ or ❗ on required items)
3. All primary source verifications (PSV bots) have run and returned with no unacknowledged flags
4. Provider has completed the electronic attestation
5. No open ❗ items on the checklist

**What happens on entry**:
- Provider status transitions to `committee_ready`
- A time-stamped summary sheet is auto-generated (see 3.3)
- The provider appears in the Committee Dashboard queue
- Assigned specialist and manager are notified via in-app notification

**Business rules**:
- Staff can manually override and add a provider to the committee queue (with a required justification note) even if not all automated criteria are met.
- Manual overrides are recorded in the audit trail with the justification.

### 3.3 Provider Summary Sheet (Auto-Generated)

**What**: A structured PDF document auto-generated for each provider entering the committee queue. It serves as the committee's reference document for that provider.

**Content**:
1. Cover page: Provider name, NPI, provider type, date added to committee queue, prepared by (system)
2. Verified credentials summary:
   - License(s): state, number, status, expiration, date verified, source
   - DEA: number, schedule, expiration, date verified
   - Board certification(s): board, certification number, expiration, date verified
   - NPDB status: query date, result (clear or adverse actions listed)
   - Sanctions: OIG status, SAM status, date checked
   - Hospital privileges: facility, status, expiration
   - Malpractice insurance: carrier, coverage amounts, expiration
3. Document checklist — all items with ✅/⭕/❗ status
4. Full verified credential packet (all PSV PDFs attached)
5. Attestation questions responses
6. Any flagged items or specialist notes

**Business rules**:
- Summary sheet is generated as a PDF and stored in Azure Blob Storage.
- If any new verification is run or a document is updated after the summary sheet is generated, a new version is generated and the old version is retained (versioned).
- Summary sheets are accessible to Credentialing Managers and Committee Members.

### 3.4 Committee Review Session Management

**What**: Staff creates and manages committee review sessions, adding providers to review agendas.

**Session fields**:
- Session date and time
- Location or video conference link
- Committee members (from roster of Medical Directors and Committee Members)
- Providers included in this session
- Agenda PDF (auto-generated)
- Status: Scheduled / In Progress / Completed

**Adding/removing providers**:
- Credentialing Manager drags providers from the queue into a session.
- Providers can be removed from a session and returned to the queue.
- Order of providers on the agenda can be adjusted manually.

**Business rules**:
- A provider can only be on one active committee session at a time.
- Minimum of one committee member must be assigned before an agenda can be sent.
- Committee sessions can be created up to 90 days in advance.
- Providers not reviewed in a session are automatically returned to the queue.

### 3.5 Agenda Generation and Distribution

**What**: The platform auto-generates a PDF agenda for each committee session, summarizing all providers under review.

**Agenda content per provider**:
- Provider name, NPI, type, specialty
- Summary of verified credentials (condensed from summary sheet)
- Any flagged items
- Space for committee vote/notes

**Distribution**:
- Agenda PDF is emailed internally to: all committee members on the session, assigned Medical Director(s)
- Email sent from `cred_committee@essenmed.com` (or configurable sender)
- Agenda is also accessible in the platform under the session record

**Business rules**:
- Agenda can only be sent when the session has at least one provider and one committee member assigned.
- Resending the agenda after changes regenerates a new PDF (version-controlled).
- Committee members receive read-only access to the committee dashboard; they cannot modify sessions.

**Note**: Committee agenda format example is pending from stakeholder — agenda layout will be finalized when provided.

### 3.6 Approvals

**What**: Credentialing Manager marks each provider as approved or denied following the committee session.

**Approval actions**:
- **Approve**: Provider status transitions to `approved`. Approval date is stamped on the provider profile. Approval is recorded with the committee session reference and the approving user.
- **Deny/Defer**: Provider is marked `denied` or `deferred` with a required reason. Denied providers are removed from the pipeline. Deferred providers return to the onboarding queue.
- **Conditional Approval**: Provider is approved pending specific outstanding items (listed and tracked).

**Business rules**:
- Only Credentialing Managers can mark approvals. Committee Members have read-only access.
- Approval cannot be granted until the committee session has a recorded session date.
- The approval date on the profile is the committee session date, not the date the Manager clicks approve (unless they differ, in which case Manager must confirm).
- All approval actions are recorded in the audit trail with actor, timestamp, and decision.

---

## Module 4: Enrollments

### 4.1 Purpose

The enrollments module tracks and manages the submission of provider enrollment applications across all payers and plan types. It replaces the partially manual roster and enrollment tracking currently done in PARCS and spreadsheets.

### 4.2 Enrollment Types

#### 4.2.1 Delegated Enrollments

Essen submits on behalf of the provider to the payer using their established delegated credentialing agreements.

| Payer | Portal / Submission Method | Notes |
|-------|---------------------------|-------|
| UHC (United Healthcare) | My Practice Profile portal | Portal login managed by Essen |
| UHC/UBH Optum | My Practice Profile portal | Same portal as UHC |
| Anthem | Availity portal | Availity account managed by Essen |
| MetroPlus | Email (roster submission) | Roster file generated by platform |
| All other payers | FTP site upload + email credentials | Platform generates roster file, uploads to FTP, then emails payer with FTP login confirmation |

#### 4.2.2 Facility Enrollments (BTC — Behavioral Treatment Center)

| Payer | Portal / Submission Method | Notes |
|-------|---------------------------|-------|
| UBH Optum | My Practice Profile portal | |
| VNS | Online Provider Demographic Update Form | Bot-assisted form submission |
| All other payers | Email | Platform generates email with provider details |

#### 4.2.3 Direct Enrollments

Provider is enrolled directly with the payer, often requiring individual applications.

| Payer | Submission Method | Notes |
|-------|------------------|-------|
| Archcare | Verity portal | Bot-assisted |
| Carelon | Availity portal | Bot-assisted |
| UHC/UBH Optum | My Practice Profile portal | Bot-assisted |
| EyeMed | EyeMed portal | Bot-assisted |
| Humana | FTP site + email credentials | |
| Centerlight | FTP site + email credentials | |
| All other payers | Email | |

Direct enrollments also include **CAQH updates**:
- Days/hours of practice
- Practice locations
- Provider schedule
Updated via CAQH API (write direction).

### 4.3 Enrollment Record

Each enrollment is tracked as an individual record per provider per payer.

**Fields**:
- Provider (linked)
- Payer name
- Enrollment type (Delegated / Facility-BTC / Direct)
- Submission method (portal name, email, FTP)
- Status: Draft / Submitted / Pending Payer Response / Enrolled / Denied / Error
- Submitted date
- Submitted by (staff user)
- Submission file (link to Azure Blob if applicable — roster, application PDF)
- Payer response date
- Payer response details / denial reason
- Follow-up due date (cadence-based)
- Follow-up history (log of follow-up contacts)
- Effective enrollment date

**Business rules**:
- A provider can have multiple enrollment records (one per payer).
- The follow-up cadence is configurable per payer type and must be tracked and enforced (key pain point: currently not automated).
- When a follow-up due date is reached, the assigned specialist receives an in-app and email notification.
- Submission files (roster CSVs, application PDFs) are stored in Azure Blob Storage.
- Any error in portal submission (bot failure, FTP failure, email bounce) is logged and the enrollment is flagged for manual attention.

### 4.4 Follow-Up Cadence Tracking

**What**: Automated tracking and alerting for required payer follow-up after enrollment submission.

**Business rules**:
- Each payer has a configured follow-up cadence (e.g., "follow up every 14 days until enrolled or denied").
- When a follow-up date is reached, the system: (1) notifies the assigned specialist, (2) creates a follow-up task, and (3) logs the cadence trigger in the audit trail.
- Staff records the follow-up outcome (e.g., "Payer confirmed receipt," "Still processing," "Denied — reason: X").
- The system sets the next follow-up date based on the configured cadence.
- If a provider is enrolled or denied, the follow-up cadence stops automatically.

### 4.5 Participation Gap Analysis

**What**: A report/view showing which payers a provider is enrolled with vs. which they should be enrolled with based on their panel and specialty.

**Business rules**:
- Gap analysis is generated per provider on demand or on a scheduled basis.
- Expected payer enrollment requirements are configured per provider type and specialty.
- Gaps (missing expected enrollments) are flagged and can generate new enrollment tasks.

### 4.6 Roster Generation

**What**: The platform generates formatted roster files for payers that require roster submissions (MetroPlus, some FTP payers).

**Business rules**:
- Roster format varies by payer — each payer's required format is configured in the system.
- Rosters can be generated manually (on-demand) or on a scheduled basis.
- Generated roster files are stored in Azure Blob Storage and linked to the enrollment record.
- FTP upload is automated where payer provides FTP credentials (stored in Azure Key Vault).
- After FTP upload, the system automatically sends a confirmation email to the payer with FTP credentials and a note confirming the upload.

---

## Module 5: Expirables Tracking

### 5.1 Purpose

Monitor all provider credentials and certifications that have expiration dates. Automate renewal confirmation, document collection, and provider outreach to prevent expired credentials from causing compliance gaps.

### 5.2 Tracked Expirable Types

| Expirable | Typical Renewal Cadence |
|-----------|------------------------|
| ACLS (Advanced Cardiac Life Support) | Every 2 years |
| BLS (Basic Life Support) | Every 2 years |
| PALS (Pediatric Advanced Life Support) | Every 2 years |
| Infection Control Certificate | Every 1-2 years (varies by facility) |
| Pain Management — HCS Attestation | Annually |
| Pain Management Part 1: Managing Pain & Opioid | Annually |
| Pain Management Part 2: Scope of Pain | Annually |
| Flu Shot | Annually (September–November) |
| Annual Physical Exam | Annually |
| PPD / QuantiFERON Gold | Annually |
| Chest X-ray (if PPD positive) | Per clinical direction |
| Government-Issued Identification | Per expiration on ID |
| Hospital Privileges | Per facility (typically 2 years) |
| CAQH Attestation | Every 120 days |
| Medicaid ETINs | Per state schedule |
| Medicaid Revalidation (Provider) | Every 5 years (CMS requirement) |
| Medicaid Revalidation (Group) | Every 5 years (CMS requirement) |
| Medicare Revalidation (Provider) | Every 5 years (CMS requirement) |
| Medicare Revalidation (Group) | Every 5 years (CMS requirement) |
| State Medical License | Per state (typically 1-3 years) |
| DEA Certificate | Every 3 years |
| Board Certification | Varies by board (typically 7-10 years) |
| Malpractice Insurance | Annually |

**Note**: Cadences above are defaults. Actual cadence per provider is set from the credential's actual expiration date.

### 5.3 Expirables Workflow

**Trigger**: Expirables tracking is initialized when a provider is approved by committee. Expiration dates are populated from the application data, PSV records, and ongoing document updates.

**Automated workflow for each expirable**:

1. **Detection**: System identifies that an expirable is approaching its expiration date.
   - Alert thresholds: 90 days, 60 days, 30 days, 14 days, 7 days, expired
   - Each threshold triggers a notification to the assigned specialist.

2. **Renewal Confirmation (Bot-assisted)**:
   - For credentials that can be confirmed via an external website (e.g., license renewals via state board websites, CAQH attestation), a bot navigates to the relevant site and confirms whether the renewal has occurred.
   - Bot takes a screenshot/PDF with timestamp and saves to Azure Blob Storage.
   - If confirmed renewed, the expiration date is updated in the system.

3. **Provider Outreach**:
   - System generates an outreach task for the specialist to contact the provider for updated documentation.
   - Outreach can be sent via email or SMS from the expirables dashboard.
   - Reminders escalate in urgency as expiration approaches.

4. **Document Collection**:
   - When the provider submits the renewed document, it is uploaded to their profile.
   - The expirable record is updated with the new expiration date.
   - The PSV bot may re-run to re-verify the renewed credential from primary source.

5. **Escalation**:
   - If a credential expires without renewal, the record is flagged as `expired` with ❗.
   - An alert is sent to the Credentialing Manager.
   - Depending on the credential type, the provider may be flagged for suspension from practice.

**Business rules**:
- All expiration dates in the system are indexed and evaluated nightly by a scheduled job.
- Expirable records link back to the original document and PSV verification record.
- Multiple expirables can be tracked simultaneously per provider.
- Expirable status: `current` / `expiring_soon` / `expired` / `pending_renewal` / `renewed`

---

## Module 6: Credentialing Bots (PSV Automation)

See [docs/planning/credentialing-bots.md](credentialing-bots.md) for detailed bot specifications.

### 6.1 Purpose

Automate primary source verifications (PSVs) — the process of verifying a provider's credentials directly with the issuing authority. This eliminates manual web-based verification workflows.

### 6.2 Bot Trigger

**What**: Bot runs are triggered automatically when a provider's contract is signed and they enter the credentialing pipeline.

**Trigger conditions**:
- Contract signed status confirmed in system
- Minimum required data available: name, NPI, license number (for license bot), DEA number (for DEA bot), etc.
- Bot runs are queued and executed asynchronously via a background job system

### 6.3 Bot Types

| Bot | Credential Verified | Trigger |
|-----|--------------------|----|
| License Verification | State medical license (all states) | License number + state available |
| DEA Verification | DEA registration | DEA number available |
| Board Verification — PA (NCCPA) | PA board certification | Provider type = PA |
| Board Verification — MD Internal Medicine (ABIM) | Internal medicine board | Provider type = MD, specialty = IM or subspecialty |
| Board Verification — MD Family Medicine (ABFM) | Family medicine board | Provider type = MD, specialty = FM |
| Board Verification — [Other boards] | Specialty-specific | Per board + specialty |
| Sanctions — OIG | OIG exclusion list | All providers |
| Sanctions — SAM.gov | Federal exclusions | All providers |
| NPDB Query | Malpractice + adverse actions | All providers |
| eMedNY / ETIN | NY Medicaid affiliation | NY Medicaid enrollment initiated |
| Expirables Renewal | License/cert renewal confirmation | Expirable approaching expiry |

### 6.4 Output Standard

All bots produce:
- PDF or screenshot saved to Azure Blob Storage at: `/providers/{id}/verifications/`
- File named per convention (see `credentialing-bots.md`)
- `VerificationRecord` database entry with: credential type, run date, expiration date, status, blob URL
- Checklist item updated
- Audit trail entry

### 6.5 Failure Handling

- Bot failures are retried up to 3 times with exponential backoff.
- After 3 failures, the bot run is marked `failed` and the assigned specialist is notified.
- Bot run logs (stdout, screenshots of errors) are saved for debugging.
- Human-in-loop fallback: specialist can manually run the verification and upload the result, which creates the `VerificationRecord` manually.

---

## Module 7: Sanctions Checking

### 7.1 Purpose

Verify that providers are not excluded from participation in federal healthcare programs by checking the OIG (Office of Inspector General) exclusion list and SAM.gov (System for Award Management).

### 7.2 OIG Exclusion List

**Source**: HHS Office of Inspector General — List of Excluded Individuals/Entities (LEIE)

**Method**: OIG provides a downloadable database (updated monthly) and an online search portal. Essen will use the OIG API (if available) or bot-driven web search.

**Data matched**: Full name + NPI, or full name + DOB, or NPI alone (NPI is most reliable)

**Frequency**:
- Initial check: Run when provider enters the credentialing pipeline
- Ongoing: Monthly automated check for all active providers (scheduled job)
- On-demand: Any staff member can trigger an on-demand check

**Output**:
- Result: `Clear` or `Excluded`
- If excluded: Exclusion type, effective date, exclusion basis
- PDF/screenshot saved to Azure Blob Storage
- `SanctionsCheck` record created with timestamp

**Business rules**:
- A positive OIG exclusion match is a hard stop — provider cannot be approved for committee.
- Positive match alerts the Credentialing Manager immediately via email and in-app notification.
- All checks (even clear results) are recorded with timestamp in the provider profile.
- OIG check must be completed and clear before committee review.

### 7.3 SAM.gov Exclusions

**Source**: SAM.gov — federal debarment and suspension list

**Method**: SAM.gov provides a public API for exclusion queries.

**Data matched**: NPI, legal name, or SSN

**Frequency**: Same as OIG (initial + monthly + on-demand)

**Business rules**:
- Same hard-stop rules as OIG.
- Both OIG and SAM are checked together and presented as a combined sanctions status.

---

## Module 8: NY Medicaid Enrollment & ETIN Tracking

### 8.1 Purpose

Track and manage provider enrollment in New York Medicaid via the eMedNY system and ETIN (Enrollment Tracking Identification Number) affiliation process.

### 8.2 ETIN Affiliation Workflow

**Trigger**: A NY Medicaid enrollment is initiated for a provider (manually by staff or based on enrollment requirements for their specialty/location).

**Workflow steps** (based on Medallion reference flow):

1. **Check eMedNY Status**: System (or bot) checks whether the provider is already in the eMedNY portal.
   - If yes → check if they are in the Maintenance File → update ETIN affiliation via ETIN Affiliation Portal.
   - If no → begin ETIN affiliation process from scratch.

2. **Populate Application**: Populate the revalidation/registration application with provider data from the platform.

3. **Provider Signature** (if required): Mail or email application to provider for signature, with a coversheet. Track receipt of signed document.
   - Some payers/situations allow submission without provider signature (e.g., Medicaid-enrolled coversheet).

4. **Submit via eMedNY**: Bot submits the completed application through the eMedNY Service Portal.

5. **Follow-Up**: Track submission status. Bot or staff follows up with eMedNY as needed.

6. **Enrollment Complete**: Record ETIN affiliation completion. Update provider's `MedicaidEnrollment` record with ETIN, affiliation status, and expiration date.

7. **Revalidation Monitoring**: Track revalidation due date. Alert specialist before expiration.

### 8.3 Medicaid Enrollment Record Fields

- Provider (linked)
- Enrollment type (Individual / Group)
- Payer (eMedNY / other state Medicaid)
- ETIN number
- Affiliation status: `pending` / `in_process` / `enrolled` / `revalidation_due` / `expired`
- Application submitted date
- Provider signature received date (if applicable)
- eMedNY submission date
- Enrollment effective date
- Revalidation due date
- Last follow-up date and notes

**Business rules**:
- Both Provider and Group enrollments are tracked separately.
- Revalidation alerts follow the same cadence as other expirables (90/60/30/14/7 days).
- The ETIN number is stored on the provider profile once assigned.

---

## Module 9: Hospital Privileges Tracking

### 9.1 Purpose

Track hospital privilege applications, approvals, and renewals for all facilities where Essen providers have or are seeking privileges.

### 9.2 Privilege Record

**Fields**:
- Provider (linked)
- Facility name
- Facility address
- Privilege type (e.g., Admitting, Courtesy, Consulting, Telemedicine)
- Application submitted date
- Status: `applied` / `pending_review` / `approved` / `denied` / `expired` / `reappointment_due`
- Approved date
- Effective date
- Expiration / re-appointment due date
- Appointment letter (document link — Azure Blob)
- Re-appointment letter (document link — Azure Blob)
- Submitted by (staff)
- Notes

### 9.3 Workflow

1. **Application**: Staff initiates a privilege application for a provider at a specific facility. Application materials are uploaded or generated.

2. **Tracking**: Status is updated as the application progresses through the facility's credentialing process.

3. **Approval**: Upon approval, the approval date and effective date are recorded. The appointment letter is uploaded to the provider's document repository.

4. **Renewal**: Privileges are tracked for expiration. When approaching expiry, the expirables workflow triggers re-appointment outreach.

**Business rules**:
- A provider may have privileges at multiple facilities simultaneously.
- Hospital appointment/re-appointment letters are also part of the onboarding document checklist (Module 1).
- Expired privileges are flagged with ❗ and the specialist is notified.
- Privilege denials are recorded with reason and trigger a review by the Credentialing Manager.

---

## Module 10: NPDB (National Practitioner Data Bank)

### 10.1 Purpose

Query the National Practitioner Data Bank for malpractice payment history and adverse action reports as part of primary source verification.

### 10.2 NPDB Query Types

**One-time (initial) query**: Run as part of the PSV process for new providers.

**Continuous Query**: Enrollment in NPDB's continuous query service provides ongoing monitoring. Any new report filed against the provider triggers an automatic notification to Essen.

### 10.3 Query Process

**Method**: NPDB HIQA (Healthcare Integrity and Protection Data Bank) web service API or NPDB's bulk query submission.

**Data submitted**:
- Provider's full legal name
- Date of birth
- SSN (last 4 or full, per NPDB requirements)
- NPI
- License number(s) and state(s)

**Output**:
- Query result report from NPDB
- If clear: `no_reports_found` with timestamp
- If reports found: list of reports with type (malpractice payment, licensure action, clinical privileges action, DEA action, etc.), dates, and reporting entity

**Data stored**:
- `NPDBRecord` entry: query date, result type, report details (if any), query confirmation number
- Report PDF saved to Azure Blob Storage

### 10.4 Business Rules

- Initial NPDB query must be completed and reviewed before committee approval.
- Continuous query enrollment should be maintained for all credentialed providers.
- Any adverse report received via continuous query is immediately flagged with ❗ for Credentialing Manager review.
- NPDB query results are confidential — access restricted to Credentialing Managers and Admins.
- NPDB results must be retained per NPDB policy (typically duration of credentialing file).
- NPDB query credentials (API key, entity ID) are stored in Azure Key Vault.
- Providers cannot be approved by committee if NPDB shows unreviewed adverse reports.

---

## Cross-Cutting Requirements

### Audit & Compliance

- All actions across all modules are recorded in the central `AuditLog` table.
- Audit logs are immutable and retained for minimum 10 years.
- The platform must comply with HIPAA — PHI (SSN, DOB, medical information) is encrypted at rest (AES-256) and in transit (TLS 1.2+).
- SSNs are stored encrypted and only decrypted at the application layer when needed for bot operations.

### Notifications

- In-app notifications for: task assignments, task overdue, bot failures, flagged verifications, expirables alerts, enrollment follow-up due
- Email notifications for: all of the above + outreach emails to providers + committee agenda distribution
- SMS notifications for: provider follow-up reminders (opt-in)
- Notification preferences are configurable per user.

### Reporting

- Dashboard metrics: total providers by stage, average time-to-credentialing, bot success rates, expirables summary
- Export to CSV/Excel: provider pipeline, enrollment status, expirables report, audit log
- Reporting accessible to Credentialing Managers and Admins

### Search

- Global search across provider names, NPI, license numbers, DEA numbers
- Filter providers by status, type, assigned specialist, facility, stage
- Full-text search within audit logs (Admin only)
