# Functional Requirements Document (FRD) — E-Credentialing CVO Platform

**Version:** 2.1
**Last Updated:** 2026-04-18
**Status:** Active — kept in sync with the shipped UI
**Audience:** Business Analysts, QA, Product, end users
**Owner:** Credentialing Manager + Product Lead

> **Positioning.** This FRD covers the full **Credentialing Verification
> Organization (CVO) platform** — internal Essen credentialing
> operations as well as the public CVO surfaces (`/`, `/cvo`,
> `/pricing`, `/sandbox`, `/changelog`, `/settings/billing`,
> `/settings/compliance`) used by external customers and partners.

---

## 1. How to read this document

For every module the FRD captures:

- **Purpose** — what the module does for the business.
- **Actors** — who uses it and at what role tier.
- **Routes & screens** — the URL paths and the screens behind them.
- **Layout** — header, navigation, content panels, action buttons.
- **Fields** — each form field with type, requiredness, and validation.
- **Business rules** — preconditions, transitions, edge cases.
- **Messages** — error, success, warning, alert, and notification copy
  (cross-referenced with the [Messaging Catalog](messaging-catalog.md)).
- **Audit** — what audit-log entries the module writes.
- **Permissions** — which roles can read and write.

For shared definitions:

- Field validation patterns: [validation-rules.md](validation-rules.md).
- Status workflows: [status-workflows.md](status-workflows.md).
- Visual standards: [ui-ux-style-guide.md](ui-ux-style-guide.md).
- Standard copy: [messaging-catalog.md](messaging-catalog.md).

---

## 2. Application structure

| Environment | URL pattern | Audience | Auth |
|---|---|---|---|
| Public landing | `/` | Anyone | None |
| Sign in | `/auth/signin` | Staff | Entra ID redirect |
| Staff portal | `/(staff)/...` | Staff | Entra ID session |
| Provider portal | `/application`, `/attestation`, `/upload` | Provider | Single-active JWT in URL |
| External verifier | `/verify/<token>` | Employer / peer reference | Per-token |
| Public APIs | `/api/v1/...`, `/api/fhir/...` | API consumers | API key |

The staff portal sidebar (visibility depends on role):

- Dashboard
- Providers
- Onboarding
- Credentialing (verifications)
- Committee
- Enrollments
- Roster
- Expirables
- Recredentialing
- Hospital Privileges
- OPPE / FPPE (Evaluations)
- CME
- Telehealth
- Behavioral Health
- Medicaid
- FSMB PDC
- Monitoring
- Compliance
- Reports
- Analytics / Scorecards
- Training
- Administration

A persistent top bar shows the user's name, role badge, global search (`/`),
notifications bell, and sign-out menu.

---

## 3. Global UI rules

The following apply to every screen unless stated otherwise.

- Heading hierarchy starts with one `<h1>`. Section headings are `<h2>`/`<h3>`.
- Loading: full-page loads use shimmer skeletons; in-line actions use button
  spinners with disabled state during request.
- Empty states: every list has an empty state with a one-line explanation and
  a primary action. Standard copy: see Messaging Catalog § Empty states.
- Error rendering:
  - Inline form errors appear under the field; red text; aria-describedby links the field to the error.
  - Page-level errors render in a top banner using the `destructive` token.
- Success / warning rendering:
  - Toast notifications for transient confirmations.
  - Persistent banners for compliance / blocking warnings.
- Confirmation modals: required for destructive actions (deactivate user,
  rotate API key, delete optional records).
- Date pickers: ISO display in tables; locale-aware in inputs; backend stores ISO 8601 UTC.
- Accessibility: every interactive element keyboard-operable; focus visible;
  axe must report zero serious / critical violations.

---

## 4. Module 1 — Provider Onboarding

### 4.1 Purpose
Capture a new provider end-to-end: invitation, account, application form,
documents, attestation, and handoff to PSV.

### 4.2 Actors
- Specialist (initiate, manage)
- Manager (override, reassign)
- Provider (complete application + attestation)

### 4.3 Routes & screens
- `(staff)/providers` — provider list (entry point for "+ New Provider").
- `(staff)/providers/[id]` — provider detail; tab "Onboarding".
- `/(provider)/application` — provider portal application.
- `/(provider)/application/sections/[section]` — per-section pages.
- `/attestation` — final attestation.
- `/upload` — provider document upload (multipart).

### 4.4 "+ New Provider" modal (staff)

| Field | Type | Required | Validation |
|---|---|---|---|
| First Name | text | yes | 2–60 chars; letters, spaces, `'`, `-` |
| Middle Name | text | no | ≤ 30 chars |
| Last Name | text | yes | 2–60 chars; letters, spaces, `'`, `-` |
| Provider Type | select | yes | Must be active in `ProviderType` table |
| NPI | text | no | exactly 10 digits; Luhn check (NPI checksum); uniqueness checked |
| Personal Email | email | no | RFC 5322; ≤ 254 chars |
| Mobile Phone | phone | no | E.164 or US 10-digit; auto-formatted |
| Assigned Specialist | select | no | Active staff users with role `SPECIALIST` or higher |

**Submit behaviour:** Provider record created with `status = INVITED`. If
"Send invite now" is checked, an invite email is queued. Audit row written:
`provider.created`.

**Inline validation messages:** see Messaging Catalog § Field validation.
Examples:

- `firstName.required` → "First name is required."
- `npi.format` → "NPI must be exactly 10 digits."
- `npi.checksum` → "This NPI failed the standard checksum."
- `npi.duplicate` → "An active provider already exists with this NPI."
- `email.invalid` → "Enter a valid email address."

**Success toast:** "Provider created. Invite is queued for delivery."

### 4.5 Provider invite email
Sent via SendGrid. Template variables: provider first name, magic link, sender
name (current user), org name, support email. Subject:
"Begin your Essen credentialing application".

Magic link points to `/(provider)/application?token=<JWT>`. Link expires 72
hours after issue.

### 4.6 Provider portal — application form (provider)
Multi-section form. Each section saves independently via
`POST /api/application/save-section`. On every save, the JWT is verified, the
`providerId` claim must match the resource, and PHI fields are encrypted at the
application layer before persistence.

| Section | Key fields | Notes |
|---|---|---|
| Personal Information | Legal name, preferred name, date of birth (PHI), SSN (PHI), gender, race, ethnicity, language(s) | Race / ethnicity / language for NCQA 2026 |
| Contact Information | Home address (PHI), home phone (PHI), preferred email, work phone | |
| Education | Medical / professional school, degree, year, ECFMG # if IMG | Triggers Education PSV bots |
| Training | Internship, residency, fellowship — programs, dates, ACGME IDs | Triggers ACGME PSV |
| Licensure | Active state licenses with state, number, issue/expiry, status | Each row creates a `License` |
| DEA | DEA number, schedules, state of registration, expiry | Optional if N/A |
| Board Certification | Board, specialty, certification #, issue/expiry | |
| Work History | Past 5 years of work; gaps explained | Triggers Work History bots / verifier links |
| Hospital Affiliations | Facilities and current status | |
| Malpractice | Carrier, policy #, coverage limits, dates | Triggers Malpractice carrier bot |
| Disclosure Questions | License actions, malpractice claims, sanctions, drug/alcohol, mental health | Yes/no with explanations |
| Behavioral Health Path | NUCC taxonomy, supervision attestations, BCBS fast-track | If specialty BH |
| Telehealth | Platforms, IMLC enrollment | |
| Non-discrimination & EEO | Acknowledgement | Required by NCQA 2026 |
| References | Three professional references | Triggers reference verifier emails |

**Section save success:** "Section saved. You can return any time within the
next 72 hours."

**Section save error (validation):** Inline per field; section banner
summarises count.

**Section save error (token):** redirect to `/application/expired` page with
"Your invite link has expired or been replaced. Please contact your
credentialing specialist for a new link."

### 4.7 Provider portal — document upload
Drag-and-drop or chooser. Allowed file types: PDF, PNG, JPG. Max 25 MB per
file, 200 MB per session. Upload streams to Azure Blob via `/api/upload`. On
each successful upload a `Document` row is created with the provider's
checklist item linkage if a requirement is matched.

**Success toast:** "Uploaded {filename}. Linked to {requirement} on your
checklist." (or "Awaiting checklist match" if no requirement was matched.)

**Error messages:** size limit, file type, virus scan failure, network — see
Messaging Catalog.

### 4.8 Provider portal — attestation
Single page summarising the answers. The provider re-confirms accuracy by
typing their full legal name and clicking **I Attest**.

On submit:
- Verify token (single-use enforcement).
- Mark provider `status = DOCUMENTS_PENDING` if all required sections are
  complete; otherwise leave in `ONBOARDING_IN_PROGRESS` with a list of missing
  sections rendered.
- **Revoke the invite token** (clear `Provider.inviteToken`).
- Write audit row `provider.attested` with timestamp + IP.
- Send email confirmation to the provider; notify the assigned Specialist
  in-app and via email.

**Success page:** "Thank you. Your attestation has been recorded. You will
hear from your specialist as we complete primary source verification."

### 4.9 Status state machine
Defined in [status-workflows.md § Provider](status-workflows.md#provider). Only
valid transitions are surfaced as buttons; backend enforces the same rules
through `provider-status` service.

### 4.10 Audit
Every mutation in this module writes audit rows (`provider.created`,
`provider.updated`, `provider.invited`, `provider.attested`,
`provider.status_changed`, `document.uploaded`).

### 4.11 Permissions
- Provider record creation: `SPECIALIST` and above.
- Provider record edit: `SPECIALIST` (own panel) or `MANAGER`+.
- Reassign specialist: `MANAGER`+.
- Reissue invite: `SPECIALIST`+.
- Hard-deactivate provider: `ADMIN`.

---

## 5. Module 2 — Onboarding Dashboard

### 5.1 Purpose
Pipeline view for staff: where everyone is, what is overdue, what needs me.

### 5.2 Routes
- `(staff)/dashboard` — KPIs and personal queues.
- `(staff)/providers` — full list with filters.
- `(staff)/providers/[id]` — provider detail (8 tabs).

### 5.3 Dashboard layout

| Section | Content | Refresh |
|---|---|---|
| KPI cards | Total Providers, Approved, Pending Committee, Open Tasks, Pending Enrollments, Expired Expirables | 30 s polling |
| Tasks assigned to me | Task list with priority, due date, provider link | 30 s polling |
| Providers I own | Specialist's panel | 30 s polling |
| Soon to expire | Expirables in next 90 days for owned providers | 30 s polling |
| Alerts | Bot failures, sanction flags, committee actions, audit findings | 15 s polling |

### 5.4 Provider list filters

| Filter | Type | Options |
|---|---|---|
| Search | text | First / last / NPI (case-insensitive substring) |
| Status | multi-select | All `ProviderStatus` values |
| Provider Type | multi-select | All active types |
| Assigned Specialist | multi-select | Active staff users |
| Days waiting | range | days since `invitedAt` or last status change |
| Expirables | toggle | "Has expirable in next 90 days" |

Active filters render as removable chips above the table. URL query string is
the source of truth (shareable links).

### 5.5 Provider detail tabs
1. **Overview** — provider info card + timeline of milestones.
2. **Documents & Checklist** — checklist items with status, upload control, "Mark complete", "Flag issue".
3. **Verifications** — `VerificationRecord` rows with credential type, verified date, expiration, status badge, "FLAGGED" badge if flagged.
4. **Tasks** — open tasks with priority badge, "+ Add Task", "Complete" action.
5. **Communications** — chronological log (email / call / SMS) with "+ Log Communication".
6. **Enrollments** — payer enrollments table; row click → enrollment detail.
7. **Expirables** — color-coded urgency.
8. **Audit Trail** — full audit history for this provider with actor, action, before/after.

### 5.6 Provider header actions

| Button | Visibility | Behaviour |
|---|---|---|
| Edit Info | always (with edit permission) | Opens modal: NPI, DEA, CAQH ID, iCIMS ID, Internal Notes, Assigned Specialist |
| Reassign | Manager+ | Modal to reassign specialist with optional reason |
| Resend Invite | when in `INVITED` or `ONBOARDING_IN_PROGRESS` | Issues a new JWT; old token invalidated; email re-sent |
| Status transition buttons | context-aware per state machine | See [status-workflows.md](status-workflows.md) |

Deny / Defer require a reason (modal, ≥ 10 chars). Reason is saved to audit
log and surfaced in committee history.

### 5.7 + Add Task modal

| Field | Type | Required |
|---|---|---|
| Title | text | yes (≤ 120 chars) |
| Description | textarea | no (≤ 2000 chars) |
| Assign To | select | yes (active staff) |
| Priority | select | yes (HIGH / MEDIUM / LOW; default MEDIUM) |
| Due Date | date | no |

Success toast: "Task created and assigned to {name}."

### 5.8 Communications

`+ Log Communication` modal:

| Field | Type | Required |
|---|---|---|
| Type | select | yes (Email / Call / SMS / In-Person) |
| Direction | select | yes (Inbound / Outbound) |
| Date / time | datetime | yes (default now) |
| Subject | text | yes (≤ 120 chars) |
| Body | textarea | yes (≤ 8000 chars) |
| Attachments | file picker | no |

Success toast: "Communication logged." Inbound emails captured via SendGrid
Inbound Parse webhook are auto-created and linked.

---

## 6. Module 3 — Committee Dashboard

### 6.1 Purpose
Run committee review sessions efficiently; record decisions with attestations.

### 6.2 Routes
- `(staff)/committee` — committee queue.
- `(staff)/committee/sessions` — list of scheduled sessions.
- `(staff)/committee/sessions/new` — create a session.
- `(staff)/committee/sessions/[id]` — session detail with agenda and decisions.

### 6.3 Create session modal

| Field | Type | Required |
|---|---|---|
| Date / time | datetime | yes (in the future) |
| Type | select | yes (Regular / Special / Credentials) |
| Chair | select | yes (active committee members) |
| Members | multi-select | yes (≥ 1) |
| Notes | textarea | no |

### 6.4 Agenda
Auto-populated from providers in `COMMITTEE_READY` (oldest first) and any
manual additions. Each agenda item shows summary sheet inline (name,
specialty, license states, board, sanctions status, NPDB status, expirables).

### 6.5 Decisions

| Action | Required input | Result |
|---|---|---|
| Approve | none | Provider → `APPROVED`; downstream enrollments enqueued |
| Approve with conditions | conditions text (≥ 10 chars) | Provider → `APPROVED`; conditions stored on `CommitteeProvider` |
| Deny | reason (≥ 10 chars) | Provider → `DENIED` |
| Defer | reason + recheck date | Provider → `DEFERRED`, returns to queue on recheck date |

After a session ends, the chair attests the minutes via a one-time email
token. Attestation captured in `PeerReviewMinute` (used for OPPE/FPPE +
NCQA CR2).

### 6.6 Notifications
- Committee day: members notified the morning of the session by email.
- Decision notifications: assigned Specialist notified in-app + email.
- Provider notification: email with outcome (or "more information needed" for
  deferral). Templates in [messaging-catalog.md](messaging-catalog.md).

---

## 7. Module 4 — Enrollments

### 7.1 Routes
- `(staff)/enrollments` — list with filters.
- `(staff)/enrollments/[id]` — detail.

### 7.2 List filters: payer, status, type (delegated / direct / BTC), method,
follow-up overdue, provider name search.

### 7.3 Enrollment detail layout

- Header: payer, type, provider link, status badge, action buttons
  (`Update Status`, `Log Follow-Up`).
- Card: payer, type, method, status, submitted date, effective date,
  confirmation #, next follow-up due.
- Card: payer response notes (if present).
- Section: follow-up history (newest first).

### 7.4 Update Status modal

| Field | Type | Required when | Validation |
|---|---|---|---|
| Status | select | always | `DRAFT / SUBMITTED / PENDING_PAYER / ENROLLED / DENIED / ERROR / WITHDRAWN` |
| Confirmation # | text | status = ENROLLED | ≤ 60 chars |
| Effective Date | date | status = ENROLLED | ≤ today + 365 days |
| Denial Reason | textarea | status = DENIED | ≥ 10 chars |
| Payer Response Notes | textarea | optional | ≤ 8000 chars |
| Next Follow-Up Due | date | optional | ≥ today |

Audit row `enrollment.status_changed`. Success toast: "Status updated."

### 7.5 Log Follow-Up modal

| Field | Type | Required |
|---|---|---|
| Outcome / notes | textarea | yes (≥ 5 chars) |
| Next follow-up date | date | no (sets `followUpDueDate`) |

### 7.6 State machine
See [status-workflows.md § Enrollment](status-workflows.md#enrollment).

---

## 8. Module 5 — Expirables Tracking

### 8.1 Routes
- `(staff)/expirables` — global list, sorted soonest-first.
- Provider detail § Expirables tab — per-provider view.

### 8.2 Display
Color-coded urgency badges:

| Window | Color (token) | Label |
|---|---|---|
| Already expired | `destructive` | "Expired" |
| < 14 days | `destructive` | "Expires in N days" |
| 14–30 days | `warning` | "Expires in N days" |
| 31–60 days | `caution` | "Expires in N days" |
| 61–90 days | `info` | "Expires in N days" |
| > 90 days | neutral | "OK" |

### 8.3 Actions
- **Mark renewed** — opens a modal to capture renewed credential number, new
  effective and expiry dates; uploads renewal PDF; writes audit row.
- **Send reminder** — manual email send; standard cadence runs nightly.

### 8.4 Notifications cadence
- Email to provider: 120, 90, 60, 30, 7 days prior; final 1-day SMS.
- In-app alert to assigned Specialist: 30, 7, 1 day prior; daily after expiry
  until resolved.
- Compliance dashboard tile updated nightly.

---

## 9. Module 6 — Credentialing Bots (PSV)

### 9.1 Routes
- `(staff)/providers/[id]/bots` — bot control panel.
- `(staff)/bots` — admin overview (Bull Board link, queue health).

### 9.2 Bot card

| Element | Description |
|---|---|
| Title | Human-friendly bot name |
| Last run | Timestamp + status badge (PENDING / RUNNING / COMPLETED / FAILED / REQUIRES_MANUAL) |
| Result summary | Parsed key fields and "Open PDF" link |
| **Run Bot** button | Disabled while running; shows spinner |
| **Open PDF** | Opens via `/api/documents/[id]/download` (5-minute SAS) |
| **Acknowledge / Resolve** | Shown when REQUIRES_MANUAL; opens modal to enter completion notes and upload manual evidence |

### 9.3 Real-time updates
tRPC polling at 5-second intervals while at least one bot is RUNNING. The card
animates to its new state without a full reload.

### 9.4 Messages
- Run queued: toast "Bot queued. We'll update this card when it starts."
- Run started: card status flips to RUNNING.
- Completed: card flips to COMPLETED; success toast "Verification complete."
- REQUIRES_MANUAL: card flips with reason (e.g., "Captcha encountered. Please
  complete this verification manually.")
- Failed (after retries): card shows FAILED with error code; action: "Open
  runbook" link to [`dev/runbooks/bot-outage.md`](../dev/runbooks/bot-outage.md).

---

## 10. Module 7 — Sanctions Checking

### 10.1 Routes
- `(staff)/providers/[id]` § Verifications tab → sanctions rows.
- `(staff)/monitoring` — global sanctions queue with flagged matches.

### 10.2 Behaviour
- OIG and SAM run weekly (Monday 02:00 ET).
- Manual re-check available from each provider.
- Flagged matches surface in the global queue with three actions: Acknowledge,
  Escalate, Confirm. Confirmed matches pause clinical privileges (configurable
  via `AppSetting`) and notify the CMO.

---

## 11. Modules 8–20 — summary

The same level of per-screen detail exists for every module. The remaining
modules follow the same documentation pattern: routes, layout, fields,
validation, state machines, messages, audit, permissions. Detailed entries
follow.

> Note for QA: every module's per-screen tests live under
> [qa/functional-testing.md](../qa/functional-testing.md). Every UAT scenario
> lives under [qa/uat-plan.md](../qa/uat-plan.md). The Master Test
> Plan workbook ([testing/](../testing/README.md)) consolidates 250+ rows across
> modules.

### 11.1 Module 8 — NY Medicaid / ETIN
Routes `(staff)/medicaid`, `(staff)/medicaid/[id]`. Track enrollment status,
ETIN affiliation per facility, revalidation due date, eMedNY confirmation #.
Bot triggers eMedNY portal flows.

### 11.2 Module 9 — Hospital Privileges
Routes `(staff)/providers/[id]` § Privileges, plus admin-managed
`(staff)/admin/privileging-library`. Per-facility privilege application,
approval, renewal. Library catalog by specialty with CPT/ICD-10 codes; mark
core vs requested.

### 11.3 Module 10 — NPDB
Initial query and Continuous Query enrollment. Records persist as
`NPDBRecord`; flagged results surface to compliance queue.

### 11.4 Module 11 — Recredentialing
Routes `(staff)/recredentialing`. Cycles initiated 180 days prior to
anniversary. Bulk initiation via filters. Each cycle reuses the application
form (abbreviated) and re-runs PSV.

### 11.5 Module 12 — Compliance & Reporting
Routes `(staff)/compliance` and `(staff)/reports`. NCQA CVO compliance
dashboard with CR 1–9 tiles; ad-hoc report builder (filter, group, export);
saved reports re-runnable; CSV export with PHI optionally masked.

### 11.6 Module 13 — Verifications (Work history & references)
External verifier flows under `/verify/<token>`. Token-based, no account.
Form fields per request. Submission writes a verification record and notifies
the assigned specialist.

### 11.7 Module 14 — Roster Management
Routes `(staff)/roster`. Monthly auto-generation at 03:00 on the 1st;
per-payer formatting; validation; submit (Availity API where possible,
SFTP per-payer, or email); record acknowledgments and per-row reconciliation.

### 11.8 Module 15 — OPPE / FPPE (Evaluations)
Routes `(staff)/evaluations`. Semi-annual OPPE auto-scheduled; FPPE triggered
by new privileges or events. `PeerReviewMeeting` and `PeerReviewMinute`
capture committee-level evidence with email attestation.

### 11.9 Module 16 — Privileging Library
Admin route. Catalog by specialty; CPT/ICD-10 mapping; core vs requested
privileges. Used by Hospital Privileges flow.

### 11.10 Module 17 — CME & CV
Routes `(staff)/cme`. CME credit ingest (manual + LMS feed); requirement
monitoring per state/board; auto-generated CV PDF for committee summary.

### 11.11 Module 18 — Public REST API & FHIR
External-facing under `/api/v1` and `/api/fhir`. Documented in
[api/README.md](../api/README.md). Read-only. PHI excluded.

### 11.12 Module 19 — Telehealth Credentialing
Routes `(staff)/telehealth`. Track platform certifications, IMLC enrollment,
multi-state license coverage; coverage gap alerts.

### 11.13 Module 20 — Performance & Analytics
Routes `(staff)/analytics` and `(staff)/scorecards`. Provider scorecards
(approval rate, time-to-credential, OPPE outcomes); pipeline visualization;
EFT/ERA tracking; staff training status; bot success rates.

### 11.14 Administration
Route `(staff)/admin`. Sub-routes:

- `users` — staff users (list, edit, deactivate, invite). Validation per
  Validation Rules. Cannot deactivate self.
- `provider-types` — manage provider types (active/inactive).
- `roles` — view permissions matrix.
- `integrations` — Entra group mapping, API keys, SFTP per-payer config,
  Key Vault references.
- `feature-flags` — view and toggle feature flags.
- `templates` — email and SMS templates.
- `app-settings` — toggles (auto-pause on sanction, sanctions cadence, etc.).

---

## 12. Cross-cutting messages, alerts, and notifications

### 12.1 Channels

| Channel | Used for |
|---|---|
| Inline form errors | Field-level validation |
| Toast | Transient confirmations and recoverable errors |
| Banner (page) | Persistent warnings (e.g., "Your session will expire in 5 minutes") |
| Modal confirmation | Destructive or irreversible actions |
| Notifications bell | Async events (bot completed, sanction flagged, new task) |
| Email | Provider outreach, committee notifications, manager escalations |
| SMS | High-urgency expirable reminders, optional 2FA fallback |

### 12.2 Severity tokens

| Token | Use |
|---|---|
| `info` | Neutral information |
| `success` | Confirmations |
| `warning` | Action recommended |
| `caution` | Approaching deadline |
| `destructive` | Errors, expirations, denials |

### 12.3 Standardized copy
All standard message strings live in
[messaging-catalog.md](messaging-catalog.md). Engineers must reference catalog
keys (e.g., `npi.duplicate`) rather than hard-coding strings.

---

## 13. Permissions matrix (summary)

| Capability | Specialist | Roster Manager | Manager | Committee | Compliance | Admin |
|---|---|---|---|---|---|---|
| View dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create / edit provider | ✓ | view | ✓ | view | view | ✓ |
| Trigger bot | ✓ | – | ✓ | – | view | ✓ |
| Reassign provider | – | – | ✓ | – | – | ✓ |
| Run committee session | – | – | ✓ | ✓ | view | ✓ |
| Approve / deny / defer | – | – | – | ✓ | – | ✓ |
| Manage enrollments | ✓ | ✓ | ✓ | – | view | ✓ |
| Generate / submit roster | – | ✓ | ✓ | – | view | ✓ |
| Manage staff users | – | – | – | – | – | ✓ |
| Manage integrations | – | – | – | – | – | ✓ |
| View audit log | own | own | ✓ | own | ✓ | ✓ |
| View compliance dashboard | – | – | ✓ | view | ✓ | ✓ |
| API key management | – | – | – | – | – | ✓ |

The full RACI table lives in [pm/raci.md](../pm/raci.md).

---

## 14. Audit-event vocabulary

A non-exhaustive list of audit `action` values (verb-noun):

```
provider.created       provider.updated         provider.invited
provider.attested      provider.status_changed  provider.deactivated
document.uploaded      document.downloaded      document.deleted
bot.queued             bot.started              bot.completed
bot.failed             bot.requires_manual      bot.acknowledged
verification.created   verification.flagged     verification.resolved
sanction.flagged       sanction.confirmed       sanction.escalated
committee.session_created  committee.decision   committee.minutes_attested
enrollment.created     enrollment.status_changed  enrollment.followup_logged
expirable.created      expirable.renewed        expirable.lapsed
roster.generated       roster.submitted         roster.acked
api.request            api.key_created          api.key_revoked
user.created           user.updated             user.deactivated
```

---

## 15. Change log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-04-14 | 0.1 | Initial functional spec | HDPulse |
| 2026-04-15 | 1.0 | Updated to reflect implemented features; all screen descriptions | Claude Code |
| 2026-04-17 | 2.0 | Documentation refresh — added per-screen UI/UX, validation, message catalog references, full permissions matrix, audit vocabulary, modules 11–20 detail | Documentation refresh |
