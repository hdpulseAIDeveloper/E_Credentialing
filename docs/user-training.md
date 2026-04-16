# ESSEN Credentialing Platform — User Training Guide

**Version**: 2.0  
**Last Updated**: 2026-04-15  
**Audience**: Credentialing Specialists, Managers, Committee Members, Administrators  
**Platform URL**: `https://credentialing.hdpulseai.com`  

---

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding Your Role](#role-guide)
3. [The Dashboard](#the-dashboard)
4. [Working with Providers](#module-1-working-with-providers)
5. [Task Management](#module-2-tasks)
6. [Running Verification Bots](#module-3-running-verification-bots)
7. [Enrollment Management](#module-4-enrollments)
8. [Expirables Tracking](#module-5-expirables)
9. [Committee Review & Approvals](#module-6-committee)
10. [NY Medicaid & ETIN](#module-7-ny-medicaid--etin)
11. [Hospital Privileges](#module-8-hospital-privileges)
12. [Sanctions & NPDB](#module-9-sanctions--npdb)
13. [Admin Panel](#module-10-admin)
14. [Provider Self-Service Portal](#module-11-provider-portal)
15. [Tips & Best Practices](#tips--best-practices)
16. [Keyboard Shortcuts & Navigation](#keyboard-shortcuts--navigation)
17. [Troubleshooting](#troubleshooting)
18. [Glossary](#glossary)
19. [Getting Help](#getting-help)

---

## Getting Started

### System Requirements

| Requirement | Details |
|-------------|---------|
| Browser | Chrome 90+, Edge 90+, Firefox 90+, Safari 15+ |
| Internet | Stable broadband connection |
| Authentication | Essen Medical Azure AD account (`@essenmed.com`) |
| MFA | Microsoft Authenticator or approved MFA method |

### Signing In

1. Open your browser and navigate to `https://credentialing.hdpulseai.com` (or `http://localhost:6015` during development)
2. Click **Sign in with Microsoft**
3. Enter your Essen Medical email address and password (the same credentials you use for Outlook)
4. If prompted for Multi-Factor Authentication, complete it as usual
5. You are now on the Dashboard

> **Important**: You must use your Essen Medical work account (`@essenmed.com`). Personal Microsoft accounts will not work.

### First-Time Login

The first time you sign in, the platform matches your Azure AD account to your user record (created by an Admin). If you see a "Contact your administrator" message, it means your user account has not been created yet — ask your Admin to set you up.

### Signing Out

Click your name in the top-right corner, then click **Sign Out**. Your session expires automatically after 30 minutes of inactivity.

### Session Timeout

- A warning appears at 25 minutes of inactivity
- Session expires at 30 minutes
- Any unsaved work (draft provider edits) is preserved

---

## Role Guide

Your role determines what you can see and do. Roles are assigned by your System Admin.

| Role | What you can do |
|------|----------------|
| **Credentialing Specialist** | Manage provider records, run bots, send follow-ups, manage tasks, track enrollments and expirables |
| **Credentialing Manager** | Everything a Specialist can do, plus manage committee sessions, approve/deny providers, send bulk reminders, override checklists, view system-wide reports |
| **Committee Member** | View committee sessions and agendas, review provider summary sheets, submit approval votes |
| **System Admin** | Everything above, plus manage staff users and roles, configure provider types, set document requirements, manage system settings |

### What You Cannot Do

Understanding your boundaries helps avoid confusion:

- **Specialists** cannot approve providers or manage committee sessions
- **Committee Members** cannot see the onboarding dashboard, enrollment records, or send communications
- **Everyone** can only see data relevant to their role — the platform enforces this automatically

---

## The Dashboard

The Dashboard is your home screen. It shows a summary of everything that needs your attention.

### Dashboard Sections

| Section | What It Shows | Who Sees It |
|---------|--------------|-------------|
| **Provider Pipeline** | Count of providers at each status stage | Specialists, Managers |
| **My Tasks** | Open tasks assigned to you, sorted by due date | Specialists, Managers |
| **Recent Activity** | Last 10 actions across the system | Specialists, Managers |
| **Urgent Attention** | Expirables expiring within 30 days, overdue follow-ups | Specialists, Managers |
| **Committee Queue** | Number of providers waiting for committee review | Managers |

### Daily Workflow

Start every workday by checking the Dashboard:

1. Review **Urgent Attention** for expirables and overdue items
2. Check **My Tasks** for anything due today
3. Scan the **Provider Pipeline** for any bottlenecks (too many providers stuck at one stage)
4. Process items in priority order: expired credentials first, then overdue follow-ups, then regular tasks

---

## Module 1: Working with Providers

### Finding a Provider

1. Click **Providers** in the left sidebar
2. Use the search box to find by name or NPI number
3. Use the **Status** dropdown to filter by a specific stage
4. Use the **Provider Type** dropdown to filter by type (MD, DO, PA, NP, etc.)
5. Click **Filter** to apply your search
6. Click **Clear** to remove filters and see all providers

> **Tip**: Search works with partial names. Typing "John" will find "Johnson", "Johnston", etc.

### Adding a New Provider

1. On the Providers list page, click **+ New Provider** (top right)
2. Fill in the required fields:
   - **First Name** and **Last Name** (required)
   - **Provider Type** (required) — select from the dropdown (MD, DO, PA, NP, LCSW, LMHC)
3. Optionally fill in:
   - Middle Name
   - NPI (10 digits only — the system validates the format)
   - Personal Email and Mobile Phone
   - Assign to a Specialist (if not assigned, defaults to the creator)
4. Click **Create Provider**
5. You are taken directly to the new provider's detail page

> **What happens next**: The provider is created in **INVITED** status. A document checklist is automatically generated based on the provider type.

### Viewing a Provider's Record

Click the provider's name anywhere in the system to open their detail page. This page has 8 tabs:

| Tab | What's There | When to Use |
|-----|-------------|-------------|
| **Overview** | Identifiers (NPI, DEA, CAQH), timeline milestones, current status | Quick reference, status at a glance |
| **Documents & Checklist** | Required documents with upload status (Received / Pending / Needs Attention) | Managing document collection |
| **Verifications** | PSV bot results and verification records with dates and expiration | After running bots, before committee |
| **Tasks** | Open tasks assigned to this provider | Daily task management |
| **Communications** | Call logs, emails, and SMS records | Tracking outreach history |
| **Enrollments** | Payer enrollment records with status and follow-up dates | After committee approval |
| **Expirables** | Credentials with expiration dates and color-coded urgency | Ongoing compliance monitoring |
| **Audit Trail** | Full change history — every action ever taken | Compliance review, investigations |

### Editing a Provider's Information

1. On the provider detail page, click **Edit Info** (top right)
2. Update any of the following fields:
   - NPI, DEA Number, CAQH ID, iCIMS ID
   - Assigned Specialist
   - Internal Notes (only visible to staff, never to the provider)
3. Click **Save Changes**

> Your changes are saved immediately and recorded in the audit trail with before/after values.

### Understanding Provider Status

The provider status tells you exactly where they are in the credentialing lifecycle:

| Status | Meaning | What Needs to Happen Next |
|--------|---------|--------------------------|
| **INVITED** | Outreach sent, waiting for provider to start | Provider clicks the link and begins application |
| **ONBOARDING_IN_PROGRESS** | Provider is actively filling out their application | Provider completes all required fields |
| **DOCUMENTS_PENDING** | Application fields done, waiting on document uploads | Provider uploads remaining documents |
| **VERIFICATION_IN_PROGRESS** | All docs received, bots are running PSV checks | Wait for bots to complete, review flagged items |
| **COMMITTEE_READY** | All verifications clear, ready for committee review | Manager adds to a committee session |
| **COMMITTEE_IN_REVIEW** | On an active committee session agenda | Committee reviews and votes |
| **APPROVED** | Committee approved the provider | Begin payer enrollments |
| **DENIED** | Committee denied the provider | Application closed |
| **DEFERRED** | Committee deferred — needs more info | Returns to onboarding for additional work |
| **INACTIVE** | Provider left Essen or is no longer active | No action needed |

### Advancing a Provider's Status

As providers move through the credentialing process, you advance their status using the buttons in the top-right header. Only valid next steps appear — you cannot skip stages.

| When the provider is... | Click this to move forward |
|------------------------|--------------------------|
| Invited | **Start Onboarding** |
| Onboarding In Progress | **Mark Docs Pending** |
| Documents Pending | **Start Verification** |
| Verification In Progress | **Mark Committee Ready** |
| Committee Ready | **Begin Review** |

> **Deny** and **Defer** require you to enter a reason. This is mandatory and saved to the audit trail.

---

## Module 2: Tasks

Tasks help you track action items for each provider. Every task is assigned to a specific team member and linked to a provider.

### Creating a Task

1. Go to the provider's detail page, then the **Tasks** tab
2. Click **+ Add Task**
3. Fill in:
   - **Title** (required) — short description of what needs to be done
   - **Description** (optional) — additional context or instructions
   - **Assign To** (required) — select the team member responsible
   - **Priority** — High, Medium, or Low
   - **Due Date** (optional but recommended)
4. Click **Create Task**

### Priority Guidelines

| Priority | When to Use | Example |
|----------|------------|---------|
| **High** | Blocks credentialing progress | "Missing medical license — provider cannot proceed" |
| **Medium** | Routine work with a deadline | "Follow up with provider for updated malpractice insurance" |
| **Low** | Informational or non-urgent | "Update provider's preferred name in profile" |

### Completing a Task

On the Tasks tab, find the task and click the **Complete** button on the right. The task disappears from the open list and is marked complete in the audit trail.

> Completed tasks remain in the database for audit purposes — they just don't show in the active task list.

### Task Escalation

Tasks overdue by 24+ hours are automatically escalated:
- The task is highlighted in red on the dashboard
- The Credentialing Manager receives a notification
- This ensures nothing falls through the cracks

---

## Module 3: Running Verification Bots

Credentialing bots automatically verify credentials from primary sources (state boards, DEA, OIG, etc.). This replaces the manual process of navigating to each website.

### Available Bot Types

| Bot | What It Verifies | Requirements |
|-----|-----------------|-------------|
| **License Verification** | State medical license (all 50 states) | License number + state |
| **DEA Verification** | DEA registration | DEA number |
| **NCCPA Board** | PA board certification | Provider type = PA |
| **ABIM Board** | Internal medicine certification | Provider NPI |
| **ABFM Board** | Family medicine certification | Name + SSN last 4 + DOB |
| **OIG Sanctions** | OIG exclusion list | Provider NPI + name |
| **SAM.gov Sanctions** | Federal exclusions | Provider NPI |
| **NPDB Query** | Malpractice and adverse actions | Name + DOB + NPI + license info |

### Triggering a Bot

1. From the provider list, click **Bots** in the Actions column — OR — from the provider detail page, navigate to the Bots page
2. You see a panel with all available bot types for this provider
3. Click **Run Bot** next to the verification type you want to run
4. The bot status changes to **Running...** in real time (via WebSocket — no page refresh needed)
5. When complete, the result (Verified / Failed / Flagged) appears on the card

### Understanding Bot Results

| Result | Meaning | Your Action |
|--------|---------|-------------|
| **Verified** (green) | Credential confirmed from primary source | No action needed — record created automatically |
| **Failed** (gray) | Bot could not complete (website down, data issue) | Check the error, fix the issue, re-run or do manual verification |
| **Flagged** (red) | Credential has an issue (expired, not found, sanction found) | Review the flag, investigate, acknowledge or escalate |

### What Bots Produce

Each successful bot run automatically:
- Saves a timestamped PDF/screenshot to the provider's document folder
- Creates a `VerificationRecord` with credential type, status, and expiration date
- Updates the provider's checklist item to "Received"
- Logs an entry in the audit trail

### When Bots Fail

- Bots automatically retry 3 times with increasing wait periods
- After 3 failures, the bot is marked as failed and you receive a notification
- You can either re-run the bot or fall back to manual verification (upload the result yourself)

---

## Module 4: Enrollments

Enrollments track the status of provider applications to payers after committee approval.

### Enrollment Types

| Type | Description | Example Payers |
|------|------------|----------------|
| **Delegated** | Essen submits on behalf of the provider | UHC, Anthem, MetroPlus |
| **Facility (BTC)** | Behavioral Treatment Center enrollment | UBH Optum, VNS |
| **Direct** | Provider enrolled directly with the payer | Archcare, Carelon, EyeMed |

### Viewing All Enrollments

Click **Enrollments** in the left sidebar for the full list across all providers.

### Viewing a Provider's Enrollments

Go to the provider detail page, then the **Enrollments** tab. Click any enrollment to open its detail page.

### Creating an Enrollment

1. On the Enrollments page or provider's Enrollments tab, click **+ Add Enrollment**
2. Fill in:
   - **Provider** (if not already on a provider page)
   - **Payer** (required)
   - **Enrollment Type** — Delegated, Facility, or Direct
   - **Submission Method** — Portal, FTP, Email
3. Click **Create Enrollment**

### Updating an Enrollment's Status

1. On the enrollment detail page, click **Update Status**
2. Select the new status from the dropdown:

| Status | When to Use |
|--------|------------|
| **Draft** | Not yet submitted to the payer |
| **Submitted** | Application sent to the payer |
| **Pending Payer** | Waiting on payer response |
| **Enrolled** | Active enrollment confirmed by payer |
| **Denied** | Payer rejected the application |
| **Error** | Submission or technical error |
| **Withdrawn** | Enrollment pulled back by Essen |

3. If changing to **Enrolled**, enter the Confirmation Number and Effective Date
4. If changing to **Denied**, enter the Denial Reason
5. Optionally add Payer Response Notes and a Next Follow-Up Due date
6. Click **Save Status**

### Logging a Follow-Up

1. On the enrollment detail page, click **Log Follow-Up**
2. Enter what happened in **Outcome / Notes** (required)
3. Enter a **Next Follow-Up Date** — this updates the enrollment's follow-up due date
4. Click **Log Follow-Up**

> **Critical**: Always set a Next Follow-Up Date. This ensures the enrollment appears in overdue lists if the follow-up is missed.

### Follow-Up Cadence

Each payer has a configured follow-up cadence. When a follow-up date arrives:
- You receive an in-app and email notification
- A follow-up task is automatically created
- The enrollment appears in the "Urgent Attention" section of the dashboard

---

## Module 5: Expirables

Expirables track credentials that expire and need renewal. The system monitors 20+ credential types.

### Tracked Credential Types

| Credential | Typical Renewal |
|-----------|----------------|
| State Medical License | 1–3 years |
| DEA Certificate | 3 years |
| Board Certification | 7–10 years |
| Malpractice Insurance | Annual |
| BLS / ACLS / PALS | 2 years |
| CAQH Attestation | 120 days |
| Hospital Privileges | 2 years |
| Flu Shot Documentation | Annual |
| Infection Control Certificate | 1–2 years |
| Government-Issued ID | Per expiration |
| Medicaid Revalidation | 5 years |
| Medicare Revalidation | 5 years |

### Viewing Expirables

- **Dashboard** — urgent expirables (next 30 days) appear in "Urgent Attention"
- **Expirables page** (left sidebar) — all expirables across all providers, sorted by expiration date
- **Provider detail, Expirables tab** — all expirables for a single provider

### Reading the Color Codes

| Badge Color | Meaning | Action Required |
|------------|---------|----------------|
| **Red / "EXPIRED"** | Already expired | Immediate action — contact provider, may need to suspend |
| **Red / days left** | Expires within 14 days | Urgent — send renewal reminder immediately |
| **Orange** | Expires within 30 days | High priority — initiate renewal process |
| **Yellow** | Expires within 60 days | Monitor — send first renewal reminder |
| **Green** | More than 60 days remaining | No action needed yet |

### Responding to Expirable Alerts

1. Review the alert on the Dashboard or Expirables page
2. Check if a bot can confirm renewal (some credentials can be verified online)
3. If not, contact the provider to request updated documentation
4. When the renewed document is received, upload it and update the expiration date
5. Re-run the PSV bot if needed to verify the renewed credential

---

## Module 6: Committee

The committee workflow is the final gate before a provider is approved to practice.

### Committee Queue

Click **Committee** in the sidebar to see all providers in `COMMITTEE_READY` or `COMMITTEE_IN_REVIEW` status.

### Creating a Committee Session (Managers Only)

1. On the Committee page, click **+ New Session**
2. Enter:
   - **Session Date** (required)
   - **Session Type**: Regular, Special, or Credentials
   - **Notes** (optional)
3. Click **Create Session**
4. Add providers from the queue to the session

### Running a Committee Session

1. Click on a session from the Sessions list
2. The session detail page shows all providers on the agenda
3. For each provider, review their summary sheet, then use the action buttons:

| Decision | Effect | Requirements |
|----------|--------|-------------|
| **Approve** | Provider moves to APPROVED status; approval date stamped | None |
| **Deny** | Provider moves to DENIED status; application closed | Must enter denial reason |
| **Defer** | Provider returns to COMMITTEE_READY for the next session | Must enter deferral reason |

> All decisions are logged in the audit trail with the user's name, timestamp, and reason (if applicable).

### For Committee Members

Your access is read-only. You can:
- View committee session agendas assigned to you
- Read provider summary sheets
- Submit your vote (Approve / Deny / Defer) with comments
- You **cannot** create sessions, add/remove providers, or access other modules

---

## Module 7: NY Medicaid & ETIN

This module manages provider enrollment in New York Medicaid via the eMedNY system.

### Creating a Medicaid Enrollment

1. Navigate to the **Medicaid** section in the sidebar
2. Click **+ New Enrollment**
3. Select the provider and fill in the required fields
4. The system tracks the enrollment through: Pending → In Process → Enrolled → Revalidation Due

### ETIN Affiliation

When a provider is enrolled in NY Medicaid, their ETIN (Enrollment Tracking Identification Number) is recorded on their profile. The system tracks revalidation dates and sends alerts before expiration.

---

## Module 8: Hospital Privileges

Track hospital privilege applications, approvals, and renewals for all facilities.

### Creating a Privilege Record

1. Go to the provider's detail page
2. Under Hospital Privileges, click **+ Add Privilege**
3. Enter facility name, privilege type, application date, and status
4. Track through: Applied → Pending Review → Approved → Reappointment Due

### Privilege Renewals

Hospital privileges have expiration dates (typically 2 years). The system tracks these as expirables and alerts you before re-appointment is due.

---

## Module 9: Sanctions & NPDB

### Sanctions Checking

Sanctions checks verify that providers are not excluded from federal healthcare programs.

- **OIG (Office of Inspector General)**: Checks the List of Excluded Individuals/Entities
- **SAM.gov**: Checks federal debarment and suspension

Sanctions checks run:
- Automatically when a provider enters the pipeline
- Monthly for all active providers
- On-demand when triggered by staff

**If a sanction is found**: The provider's application is immediately blocked (hard stop). The Credentialing Manager is alerted. The finding must be reviewed and either confirmed (provider denied) or cleared (false positive).

### NPDB (National Practitioner Data Bank)

NPDB queries check for malpractice payments and adverse actions.

- **Access restricted**: Only Credentialing Managers and Admins can view NPDB results
- **Initial query**: Run during the PSV process
- **Continuous query**: Ongoing monitoring after enrollment

---

## Module 10: Admin

> **Admin role required** for all actions in this section.

### Managing Staff Users

1. Click **Admin** → **Users** in the left sidebar
2. To add a user: Click **+ Invite User**, enter their `@essenmed.com` email, display name, and role
3. To edit: Click **Edit** next to the user to change their name or role
4. To deactivate: Click **Deactivate** — the user immediately loses access

> You cannot deactivate your own account. Deactivated users can be reactivated.

### Configuring Provider Types

1. Click **Admin** → **Provider Types**
2. Add new types or modify document requirements for each type
3. For each document requirement, set it as: **Required**, **Conditional**, or **Not Applicable** for that provider type
4. Changes take effect immediately for new providers

### System Settings & Workflows

- **Admin → Settings**: Configure notification thresholds, email templates, and system parameters
- **Admin → Workflows**: View and manage workflow diagram configurations

---

## Module 11: Provider Portal

Providers (external users) have their own self-service portal for completing their credentialing application.

### What Providers Can Do

- Complete the multi-section application form (personal info, licenses, education, etc.)
- Upload credential documents via drag-and-drop
- View their document checklist and completion percentage
- Review and correct OCR-extracted data
- Complete the electronic attestation
- Track their application status

### What Providers Cannot Do

- View other providers' data
- Access any staff dashboard
- View internal notes or task assignments
- Trigger bot verifications

---

## Tips & Best Practices

### Daily Routine

1. **Check the Dashboard first thing** — review urgent expirables, overdue follow-ups, and pending tasks
2. **Process high-priority items** before routine work
3. **Update statuses promptly** — this keeps the pipeline view accurate for the whole team
4. **Log every communication** — if you called a provider, log it. This creates accountability and prevents duplicate outreach.

### Keeping Provider Records Current

- Advance status as soon as the criteria are met — don't let providers sit in the wrong stage
- Use **Internal Notes** for context that doesn't fit structured fields (e.g., "Provider traveling, will submit docs next week")
- Internal Notes are visible to all staff but never to the provider

### Follow-Up Discipline

- **Always set a Next Follow-Up Date** when logging a follow-up — this is the most important habit to build
- If a payer says "check back in 2 weeks," set the follow-up date for 2 weeks from today
- The system will remind you automatically

### Task Hygiene

- Close tasks promptly when done — open tasks that are actually finished create visual clutter and false urgency
- Create specific tasks, not vague ones: "Get updated BLS card from Dr. Smith" is better than "Follow up"
- Assign tasks to the right person — don't assign all tasks to yourself if someone else should handle them

### Bot Runs

- Run all applicable bots **before** marking a provider Committee Ready
- If a bot fails, check the error first — it might be a data issue (wrong license number) rather than a system issue
- If a bot is flagged, investigate the underlying credential issue before acknowledging the flag
- Bot PDFs are automatically saved — you don't need to download and re-upload them

### Committee Preparation

- Ensure all PSV verifications are complete before adding a provider to a session
- Review the auto-generated summary sheet for accuracy before distributing
- Add any context notes that the committee should be aware of

---

## Keyboard Shortcuts & Navigation

| Shortcut | Action |
|----------|--------|
| Click provider name | Opens provider detail page |
| Browser Back button | Returns to previous page |
| Ctrl+F (Cmd+F on Mac) | Browser search within current page |

### Navigation Structure

```
Sidebar Navigation
├── Dashboard (home)
├── Providers (list + search)
├── Enrollments (all enrollments)
├── Expirables (all expirables)
├── Committee (queue + sessions)
├── Medicaid (NY Medicaid / ETIN)
└── Admin (users, settings, workflows)
    ├── Users
    ├── Provider Types
    ├── Settings
    ├── Roles
    └── Workflows
```

---

## Troubleshooting

### I can't log in

- Verify you are using your `@essenmed.com` email
- Complete MFA if prompted
- If you see "Contact your administrator," your user account hasn't been created yet — ask an Admin
- Try clearing your browser cache and cookies, then try again
- Try a different browser (Chrome, Edge, Firefox)

### I can't see a provider / module

- Your role may not have access to that module — check the Role Guide above
- Ask your Admin to verify your role assignment

### A bot failed

- Check the error message on the bot card
- Common causes: incorrect license number, website temporarily down, data missing
- Fix the underlying data issue, then click **Run Bot** again
- If the issue persists, fall back to manual verification (upload the result yourself)

### I made a mistake (wrong status, wrong data)

- Most actions can be corrected by editing the record
- Status changes follow strict rules — you may need a Manager to override
- All changes are logged in the audit trail, so the original values are always preserved

### The page is loading slowly

- Check your internet connection
- Try refreshing the page (Ctrl+R or Cmd+R)
- If the issue persists, contact IT — the server may need attention

---

## Glossary

| Term | Definition |
|------|-----------|
| **CAQH** | Council for Affordable Quality Healthcare — industry provider data repository |
| **Committee** | Credentialing committee that reviews and approves providers |
| **DEA** | Drug Enforcement Administration — required for providers prescribing controlled substances |
| **ETIN** | Enrollment Tracking Identification Number — used for NY Medicaid affiliation |
| **Expirable** | Any credential or certification with an expiration date |
| **NPI** | National Provider Identifier — unique 10-digit identifier for US healthcare providers |
| **NPDB** | National Practitioner Data Bank — stores malpractice and adverse action reports |
| **OIG** | Office of Inspector General — maintains the exclusion list of sanctioned providers |
| **PCD Folder** | Provider Credentialing Document folder (legacy K: drive term) |
| **PSV** | Primary Source Verification — verifying a credential directly from the issuing authority |
| **SAM.gov** | System for Award Management — federal exclusions database |
| **SSO** | Single Sign-On — logging in once with your Azure AD credentials |
| **TOTP** | Time-based One-Time Password — used for automated DEA MFA |

---

## Getting Help

If you encounter an issue:

1. **Check this training guide** for the relevant workflow
2. **Ask a colleague** — they may have encountered the same issue
3. **Contact your Credentialing Manager** for workflow questions
4. **Contact IT/development** for technical issues (errors, system bugs) — provide:
   - What you were trying to do
   - What you expected to happen
   - What actually happened (and any error message text)
   - The provider name/NPI if applicable

### Support Contact

| Type | Contact |
|------|---------|
| Workflow questions | Your Credentialing Manager |
| Technical issues | IT Help Desk or development team |
| User account issues | System Admin |
| Training requests | Training Lead |

---

## Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-15 | 2.0 | Comprehensive rewrite — added all 10 modules, glossary, troubleshooting, daily workflow, provider portal, navigation guide |
| 2026-04-15 | 1.0 | Initial training guide — covers core implemented modules |
