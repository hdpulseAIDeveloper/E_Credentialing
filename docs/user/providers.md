# Working With Providers

The **Providers** screen is the center of day-to-day credentialing work. This page covers how to find, create, and manage provider records.

## Finding a provider

The providers list supports:

- **Text search** (name, email, NPI, SSN last-4) — use the search box above the list or press `/` from any page.
- **Filters** — by status, provider type, primary specialist, state license, expiring credentials.
- **Saved views** — any combination of filters can be saved as a named view. Pinned views appear in the left sidebar.

Click any row to open the **Provider detail** page.

## Creating a provider

Most providers are created automatically when HR completes hiring in iCIMS. You only need to create one manually if the iCIMS sync missed them.

1. Click **Providers** in the left nav.
2. Click **New provider** in the top right.
3. Fill in:
   - Legal first, middle, last name
   - Email (this is the address the invitation link goes to)
   - Mobile phone
   - Provider type (MD, DO, PA, NP, LCSW, LMHC, …)
   - Primary specialist (the staff member who will own this file)
4. Click **Create and send invitation**.

The provider receives the onboarding email immediately. You can verify by opening the provider record and checking the **Activity** tab.

## The Provider detail page

Once you open a provider, the page is organized into tabs:

| Tab | What it shows |
|-----|---------------|
| Overview | Name, status, key identifiers, summary of progress |
| Application | Everything the provider filled in during onboarding, section by section |
| Documents | Every file uploaded, both by staff and by the provider |
| Checklist | Required documents with received / pending state |
| Verifications | PSV bot runs and their results (see [Bots](bots.md)) |
| Licenses | All licenses with state, number, status, expiration |
| Hospital privileges | Appointments by facility |
| Enrollments | Payer enrollments (delegated, facility, direct) |
| Expirables | Upcoming expirations with follow-up cadence |
| NPDB | NPDB query results and continuous monitoring |
| Committee | Committee history and decisions |
| Recredentialing | 36-month cycle status |
| Audit | Every action taken on this record |

Use the **Actions** menu in the top right to:

- Re-send the onboarding invitation (generates a fresh 72-hour link; the old one stops working)
- Trigger a specific PSV bot
- Request missing documents (opens a templated email)
- Assign or change the primary specialist
- Mark inactive (with a required reason)

## Editing provider data

You can edit any field you can see, with two restrictions:

- Fields that hold PHI (SSN, DOB, home address, home phone) can only be edited by a Manager or Admin, and the change is logged.
- After a provider is **Approved**, edits require a reason captured in the audit log.

To edit, click the pencil icon next to a field or section. Changes save on blur.

## Bulk actions

The provider list supports bulk actions when you select rows with the checkbox column:

- Bulk send invitation reminders (to providers stuck in *Invited* or *Onboarding in progress*)
- Bulk trigger expirables outreach
- Bulk export to CSV
- Bulk assign specialist

Bulk actions preview the affected rows before you confirm.

## Owner and handoff

Every provider has a **primary specialist**. That specialist:

- Receives all task assignments and alerts for this provider
- Owns the schedule of outreach and follow-ups
- Is the default recipient of committee-deferred follow-up items

To transfer ownership, open **Actions → Change primary specialist**. The previous specialist keeps read access for 30 days.

## Common scenarios

### Provider hasn't started their application after 7 days
Open their record → **Actions → Re-send invitation**. The new link replaces the old one. Consider a phone follow-up if the email is not opening.

### Document was rejected at committee
Open the document in the **Documents** tab → **Request replacement**. The provider receives an email with the reason and a fresh upload link.

### Provider changed name (marriage, other)
Open **Overview → Edit** → update legal name. Upload supporting documentation (marriage certificate, court order) in **Documents**. The audit log will show the change.

### Specialist leaving — need to reassign their panel
Admins: go to **Administration → Users → [specialist name] → Bulk reassign panel**. Choose a new primary specialist for all their providers.
