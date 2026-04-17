# ESSEN Credentialing Platform — Functional Documentation

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Status**: Active — Updated as features ship  
**Audience**: Product, QA, stakeholders  

---

## 1. Overview

This document describes what each feature does from a functional perspective — what the user sees, what happens in the system, and what the business outcomes are. It is organized by screen/workflow and stays in sync with the implemented codebase.

---

## 2. Application Structure

The platform has two distinct user environments:

| Environment | URL Path | Users | Auth |
|------------|----------|-------|------|
| Staff Portal | `/dashboard`, `/providers`, `/enrollments`, `/committee`, `/admin` | Credentialing Specialists, Managers, Admins, Committee Members | Azure AD SSO |
| Provider Portal | `/application` | Healthcare providers (external) | Token-based (magic link) |
| Public Landing Page | `/` | Anyone | None required |

---

## 3. Navigation & Layout

The staff portal uses a persistent left sidebar with the following navigation items:

- **Dashboard** — KPI cards and alerts
- **Providers** — all provider records
- **Committee** — committee sessions and ready queue
- **Enrollments** — payer enrollment tracking
- **Expirables** — credential expiration monitoring
- **Admin** — user management, provider types (ADMIN/MANAGER only)

The top bar shows the current user's name and a sign-out link.

---

## 4. Dashboard (`/dashboard`)

### What it shows
- **Stat cards**: Total Providers, Approved, Pending Committee, Open Tasks, Pending Enrollments, Expired Expirables
- **Urgent Attention list**: providers with expirables expiring within 30 days

### Business logic
- Numbers pull live from the database on each page load
- "Pending Committee" counts providers in `COMMITTEE_READY` or `COMMITTEE_IN_REVIEW` status
- "Expired Expirables" counts records where `status = EXPIRED`

---

## 5. Providers List (`/providers`)

### What it shows
A table of all providers with columns: Name (link), Provider Type, NPI, Status badge, Assigned Specialist, Actions.

### Filtering
- Free-text search across first name, last name, and NPI (case-insensitive)
- Status dropdown filter
- "Filter" submits the form; "Clear" resets to all providers

### Actions column
- **View** — navigates to the provider detail page
- **Bots** — navigates to the bot control panel for that provider

### Adding a new provider
The **+ New Provider** button opens a modal with fields:
- First Name (required), Last Name (required), Middle Name (optional)
- Provider Type (required dropdown)
- NPI (optional, 10 digits)
- Personal Email (optional)
- Mobile Phone (optional)
- Assigned Specialist (optional dropdown)

On success, the user is redirected to the new provider's detail page.

---

## 6. Provider Detail (`/providers/[id]`)

The provider detail page is the central hub for all credentialing activity on a single provider. It has a tabbed interface with 8 tabs.

### Header
Shows provider name, type badge, status badge, and NPI. Right side shows assigned specialist, application submission date, and action buttons:

**Edit Info** — opens a modal to update:
- NPI, DEA Number, CAQH ID, iCIMS ID
- Internal Notes
- Assigned Specialist

**Status transition buttons** — context-aware based on current status. Only valid next states are shown:

| Current Status | Available Transitions |
|---------------|----------------------|
| Invited | Start Onboarding |
| Onboarding In Progress | Mark Docs Pending |
| Documents Pending | Start Verification |
| Verification In Progress | Mark Committee Ready |
| Committee Ready | Begin Review |
| Committee In Review | Approve / Deny / Defer |
| Approved | Mark Inactive |
| Denied | Re-invite |
| Deferred | Return to Queue |
| Inactive | Re-activate |

Deny and Defer transitions require a reason (entered in a secondary modal). This reason is saved to the audit log.

### Tab: Overview
Two panels:
- **Provider Information**: NPI, DEA, CAQH ID, iCIMS ID, Provider Type, Internal Notes
- **Timeline**: key milestone dates (invited, app started, app submitted, committee ready, approved)

### Tab: Documents & Checklist
Shows the document checklist for this provider's type. Each item shows document name, requirement level, status, and upload date. Staff can mark items, upload documents, and flag issues.

### Tab: Verifications
List of all primary source verification records. Each row shows credential type, verified date, expiration date, status (VERIFIED / FAILED), and a FLAGGED badge if flagged.

### Tab: Tasks
Shows all open (non-completed) tasks assigned to this provider. Each task shows:
- Priority badge (HIGH = red, MEDIUM = yellow, LOW = gray)
- Title, assignee name, due date (red if overdue)
- Description (truncated)
- **Complete** button — marks the task complete immediately

**+ Add Task** button opens a modal:
- Title (required)
- Description (optional)
- Assign To (required — staff dropdown)
- Priority (High/Medium/Low)
- Due Date (optional)

### Tab: Communications
Chronological list of all communication logs (emails, calls, SMS) for this provider. Each entry shows type, date, sender, and body preview.

### Tab: Enrollments
List of payer enrollments. Each row shows payer name, status badge, enrollment type, submission method, and follow-up due date. Clicking a row navigates to the enrollment detail page.

### Tab: Expirables
List of all tracked credentials with expiration dates. Color-coded urgency badges show days remaining. Credentials show type and expiration date.

### Tab: Audit Trail
Placeholder — links to the full audit log. Full audit detail will be added in a future iteration.

---

## 7. Bot Control Panel (`/providers/[id]/bots`)

### What it shows
A panel listing all available bot types for this provider. Each bot card shows:
- Bot type name and last run status
- Last run date and result summary
- **Run Bot** button

### Real-time updates
When a bot job is queued, its card shows a "Running…" status. As the worker processes the job, status updates stream back via Socket.io and update the card in real time without a page refresh.

### Bot output
On completion, bot results (status, verification PDF link, notes) are saved to the provider's verification records and viewable on the Verifications tab.

---

## 8. Enrollment Detail (`/enrollments/[id]`)

### What it shows
- Payer name, enrollment type, and provider name in the header
- Status badge with **Update Status** and **Log Follow-Up** action buttons
- Enrollment Details card: payer, type, method, status, submitted date, effective date, confirmation number
- Payer Response Notes card (shown if notes exist)
- Follow-Up History list (chronological, newest first)

### Update Status modal
Fields:
- Status dropdown (DRAFT / SUBMITTED / PENDING_PAYER / ENROLLED / DENIED / ERROR / WITHDRAWN)
- If ENROLLED: Confirmation Number, Effective Date
- If DENIED: Denial Reason
- Payer Response Notes (always available)
- Next Follow-Up Due date

### Log Follow-Up modal
Fields:
- Outcome / Notes (required free text)
- Next Follow-Up Date (optional — sets the `followUpDueDate` on the enrollment)

---

## 9. Committee (`/committee`)

### Committee Queue (`/committee`)
Lists all providers with status `COMMITTEE_READY` or `COMMITTEE_IN_REVIEW`. Shows provider name, type, specialist, and days waiting.

**Create Session** button opens a form to schedule a committee meeting with date, type (Regular / Special / Credentials), and notes.

### Committee Sessions (`/committee/sessions`)
Lists all scheduled committee sessions with date, type, provider count, and status.

### Session Detail (`/committee/sessions/[id]`)
Shows session info and the list of providers on the agenda. For each provider, committee members can:
- **Approve** — transitions provider to APPROVED
- **Deny** — requires denial reason, transitions to DENIED
- **Defer** — requires deferral reason, transitions to DEFERRED

---

## 10. Expirables (`/expirables`)

Lists all tracked expirable credentials across all providers, sorted by soonest expiring. Filters available for status (expired, expiring soon, etc.). Color coding matches the provider detail expirables tab.

---

## 11. Admin — Staff Users (`/admin/users`)

### What it shows
Table of all staff users with: Name, Email, Role badge, Status badge (Active/Inactive), Last Login, Actions.

### Actions
- **Edit** — opens a modal to update Display Name and Role
- **Deactivate** — shows a confirmation modal, then sets `isActive = false`. User loses platform access immediately.
- **Reactivate** — (shown for inactive users) sets `isActive = true`.

### Invite User
**+ Invite User** button opens a modal:
- Email (required, must be valid)
- Display Name (required)
- Role (Specialist / Manager / Committee Member / Admin)

The user record is created in the database. The user must sign in via Azure AD SSO the first time — the system matches their Azure AD email to the pre-created record.

---

## 12. Status Workflows

### Provider Status Flow

```
INVITED
  └─ ONBOARDING_IN_PROGRESS
       └─ DOCUMENTS_PENDING
            └─ VERIFICATION_IN_PROGRESS
                 └─ COMMITTEE_READY
                      └─ COMMITTEE_IN_REVIEW
                           ├─ APPROVED ──► INACTIVE ──► INVITED (re-activate)
                           ├─ DENIED ──► INVITED (re-invite)
                           └─ DEFERRED ──► COMMITTEE_READY (return to queue)
```

### Enrollment Status Flow

```
DRAFT ──► SUBMITTED ──► PENDING_PAYER ──► ENROLLED
                   └──► DENIED
                   └──► ERROR
                   └──► WITHDRAWN (soft-delete equivalent)
```

---

## 13. Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-14 | 0.1 | Initial functional spec from planning docs |
| 2026-04-15 | 1.0 | Updated to reflect implemented features; added all screen descriptions |
