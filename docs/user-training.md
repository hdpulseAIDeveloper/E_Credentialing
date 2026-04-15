# ESSEN Credentialing Platform — User Training Guide

**Version**: 1.0  
**Last Updated**: 2026-04-15  
**Audience**: Credentialing Specialists, Managers, Committee Members, Administrators  

---

## Getting Started

### Signing In

1. Open your browser and navigate to `credentialing.essenmed.com` (or `http://localhost:6015` during development)
2. Click **Sign in with Microsoft**
3. Enter your Essen Medical email address and password (the same credentials you use for Outlook)
4. If prompted for Multi-Factor Authentication, complete it as usual
5. You are now on the Dashboard

> **Note**: You must use your Essen Medical work account (`@essenmed.com`). Personal Microsoft accounts will not work.

### Signing Out

Click your name in the top-right corner, then click **Sign Out**.

---

## Role Guide

Your role determines what you can see and do:

| Role | What you can do |
|------|----------------|
| **Specialist** | Manage provider records, run bots, log follow-ups, manage tasks |
| **Manager** | Everything a Specialist can do, plus view reports and manage team settings |
| **Committee Member** | View committee queue and vote on provider approvals |
| **Admin** | Everything above, plus manage staff users and system configuration |

---

## Module 1: Working with Providers

### Finding a Provider

1. Click **Providers** in the left sidebar
2. Use the search box to find by name or NPI number
3. Use the **Status** dropdown to filter by a specific stage
4. Click **Filter** to apply your search
5. Click **Clear** to remove filters and see all providers

### Adding a New Provider

1. On the Providers list page, click **+ New Provider** (top right)
2. Fill in the required fields:
   - **First Name** and **Last Name** (required)
   - **Provider Type** (required) — select from the dropdown (MD, DO, PA, NP, etc.)
3. Optionally fill in:
   - Middle Name
   - NPI (10 digits only)
   - Personal Email and Mobile Phone
   - Assign to a Specialist
4. Click **Create Provider**
5. You are taken directly to the new provider's detail page

### Viewing a Provider's Record

Click the provider's name anywhere in the system to open their detail page. This page has 8 tabs:

| Tab | What's there |
|-----|-------------|
| **Overview** | Identifiers (NPI, DEA, CAQH), timeline milestones |
| **Documents & Checklist** | Required documents with upload status |
| **Verifications** | PSV bot results and verification records |
| **Tasks** | Open tasks assigned to this provider |
| **Communications** | Call logs, emails, and SMS records |
| **Enrollments** | Payer enrollment records |
| **Expirables** | Credentials with expiration dates |
| **Audit Trail** | Full change history |

### Editing a Provider's Information

1. On the provider detail page, click **Edit Info** (top right)
2. Update any of the following fields:
   - NPI, DEA Number, CAQH ID, iCIMS ID
   - Assigned Specialist
   - Internal Notes (only visible to staff, never to the provider)
3. Click **Save Changes**

> Your changes are saved immediately and the page refreshes to show the updated data.

### Advancing a Provider's Status

As providers move through the credentialing process, you advance their status using the buttons in the top-right header. Only valid next steps appear — you cannot skip stages.

| When the provider is... | Click this to move forward |
|------------------------|--------------------------|
| Invited | **Start Onboarding** |
| Onboarding In Progress | **Mark Docs Pending** |
| Documents Pending | **Start Verification** |
| Verification In Progress | **Mark Committee Ready** |
| Committee Ready | **Begin Review** |

For Committee decisions (Approve / Deny / Defer), see the Committee section below.

> **Deny** and **Defer** require you to enter a reason. This is saved to the audit trail.

---

## Module 2: Tasks

Tasks help you track action items for each provider. Tasks are assigned to specific team members.

### Creating a Task

1. Go to the provider's detail page → **Tasks** tab
2. Click **+ Add Task**
3. Fill in:
   - **Title** (required) — short description of what needs to be done
   - **Description** (optional) — additional context
   - **Assign To** (required) — select the team member responsible
   - **Priority** — High, Medium, or Low
   - **Due Date** (optional)
4. Click **Create Task**

### Completing a Task

On the Tasks tab, find the task and click the **Complete** button on the right. The task disappears from the open list and is marked complete in the system.

> Completed tasks are still in the database for audit purposes — they just don't show in the active task list.

---

## Module 3: Running Verification Bots

Credentialing bots automatically verify credentials from primary sources (state boards, DEA, OIG, etc.).

### Triggering a Bot

1. From the provider list, click **Bots** in the Actions column
   — OR —
   From the provider detail page, navigate to `/providers/[id]/bots`
2. You see a panel with all available bot types for this provider
3. Click **Run Bot** next to the verification type you want to run
4. The bot status changes to **Running…** in real time
5. When complete, the result (Verified / Failed / Flagged) appears on the card

### Viewing Verification Results

After a bot run completes:
- The result appears immediately on the bot panel
- The full record (with credential type, verified date, expiration, status) appears on the provider's **Verifications** tab
- If a verification is flagged, a red **FLAGGED** badge appears

---

## Module 4: Enrollments

Enrollments track the status of a provider's payer applications (Medicaid, Medicare, commercial payers).

### Viewing All Enrollments

Click **Enrollments** in the left sidebar for the full list across all providers.

### Viewing a Provider's Enrollments

Go to the provider detail page → **Enrollments** tab → click any enrollment to open its detail page.

### Updating an Enrollment's Status

1. On the enrollment detail page, click **Update Status**
2. Select the new status from the dropdown:
   - **Draft** — not yet submitted
   - **Submitted** — sent to the payer
   - **Pending Payer** — waiting on payer response
   - **Enrolled** — active enrollment confirmed
   - **Denied** — payer rejected the application
   - **Error** — submission or technical error
   - **Withdrawn** — enrollment pulled back
3. If changing to **Enrolled**, enter the Confirmation Number and Effective Date
4. If changing to **Denied**, enter the Denial Reason
5. Optionally add Payer Response Notes and a Next Follow-Up Due date
6. Click **Save Status**

### Logging a Follow-Up

1. On the enrollment detail page, click **Log Follow-Up**
2. Enter what happened in **Outcome / Notes** (required)
3. Optionally enter a **Next Follow-Up Date** — this updates the enrollment's follow-up due date
4. Click **Log Follow-Up**

The follow-up appears in the **Follow-Up History** section on the enrollment page.

---

## Module 5: Expirables

Expirables help you track credentials that expire and need renewal — licenses, malpractice coverage, DEA registrations, etc.

### Viewing Expirables

- **Dashboard** — urgent expirables (next 30 days) appear in the "Urgent Attention" section
- **Expirables page** (left sidebar) — all expirables across all providers, sorted by expiration date
- **Provider detail → Expirables tab** — all expirables for a single provider

### Reading the Color Codes

| Badge Color | Meaning |
|------------|---------|
| Red / "EXPIRED" | Already expired — requires immediate action |
| Red / days left | Expires within 14 days |
| Orange | Expires within 30 days |
| Yellow | Expires within 60 days |
| Green | More than 60 days remaining |

---

## Module 6: Committee

The committee workflow moves providers from verification to formal approval.

### Committee Queue

Click **Committee** in the sidebar to see all providers ready for review. This shows everyone in `COMMITTEE_READY` or `COMMITTEE_IN_REVIEW` status.

### Scheduling a Session

1. On the Committee page, click **+ New Session**
2. Enter:
   - **Session Date** (required)
   - **Session Type**: Regular, Special, or Credentials
   - **Notes** (optional)
3. Click **Create Session**

### Running a Committee Session

1. Click on a session from the Sessions list
2. The session detail page shows all providers on the agenda
3. For each provider, use the action buttons:
   - **Approve** — provider moves to APPROVED status
   - **Deny** — enter denial reason, provider moves to DENIED
   - **Defer** — enter deferral reason, provider returns to COMMITTEE_READY for the next session

> All votes are logged in the audit trail with the committee member's name and timestamp.

---

## Module 7: Admin — Managing Staff Users

> **Admin role required** for all user management actions.

### Viewing Staff Users

Click **Admin** → **Users** in the left sidebar.

### Inviting a New Staff Member

1. Click **+ Invite User**
2. Enter:
   - **Email** — must be their Essen Medical email (`@essenmed.com`)
   - **Display Name** — their full name as it should appear in the system
   - **Role** — Specialist, Manager, Committee Member, or Admin
3. Click **Create User**

The user record is created. The staff member will be matched to this record the first time they sign in with Azure AD.

### Editing a User

Click **Edit** next to any user to change their Display Name or Role. Changes take effect on their next page load.

### Deactivating a User

1. Click **Deactivate** next to the user
2. Confirm the deactivation in the popup
3. The user immediately loses access to the platform

> You cannot deactivate your own account. Deactivated users can be reactivated by clicking **Reactivate**.

---

## Tips & Best Practices

### Keeping Provider Records Current

- Update the provider's status promptly as they move through each stage — this keeps the dashboard accurate and ensures follow-up alerts fire at the right time
- Use **Internal Notes** (in Edit Info) to record anything that doesn't fit the structured fields — these are visible only to staff

### Follow-Up Discipline

- Always set a **Next Follow-Up Date** when logging a follow-up. This ensures the enrollment shows up in the overdue list if you miss it.
- Check the **Dashboard** each morning for urgent expirables and overdue follow-ups

### Task Hygiene

- Close tasks promptly when done — they disappear from the open task list but remain in the audit trail
- Use Priority levels consistently: **High** = blocks credentialing progress, **Medium** = routine, **Low** = informational

### Bot Runs

- Run bots before marking a provider **Committee Ready** — verifications should be complete before committee review
- If a bot fails or is flagged, investigate the underlying credential issue before re-running
- Bot PDFs are automatically saved to the provider's document folder

---

## Getting Help

If you encounter an issue:

1. Check this training guide for the relevant workflow
2. Contact your Credentialing Manager
3. For technical issues (errors, system bugs), contact the IT/development team and provide:
   - What you were trying to do
   - What you expected to happen
   - What actually happened (and any error message text)

---

## Change Log

| Date | Version | Change |
|------|---------|--------|
| 2026-04-15 | 1.0 | Initial training guide — covers all implemented modules |
