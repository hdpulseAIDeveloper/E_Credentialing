# The Credentialing Workflow

This page walks a typical file from invitation to approval and explains each staff-side decision point.

## The end-to-end flow

```
Invite  →  Application filled  →  Documents received  →  PSV run  →  Committee  →  Approved
```

## Step 1 — Invite

Most providers are created automatically from iCIMS. For manually-created providers, click **New provider** and fill in the basics (see [Working with providers](providers.md)). The platform sends the invitation email immediately.

**What good looks like:** the provider opens the email within 24 hours and starts the application within 3 days. If neither happens, the system queues a follow-up at day 3, day 7, and day 14. You are notified after each failed contact.

## Step 2 — Application

While the provider is filling out the application:

- You see progress on their detail page under **Application** (by section).
- You do not need to interact until they **Submit**. The provider can save and come back.

When the provider submits, the platform:

1. Locks the submitted sections (they cannot edit without your reopen).
2. Creates a **Checklist** of required documents they have not yet uploaded.
3. Moves the provider status to **Documents pending** if uploads are still missing, or **Verification in progress** if everything is in.

## Step 3 — Documents

Open the **Checklist** tab. Green ✓ means received. Gray ○ means still pending. Red ! means rejected or needs attention.

To request a missing document, click the item → **Request upload**. The provider gets an email with a direct upload link.

To review uploaded documents, open the **Documents** tab. Each document shows:

- File name, size, type, uploaded date and uploader
- A preview pane (PDFs, images)
- The verification status (None, Approved, Rejected)
- The checklist item it is satisfying

Click **Approve** or **Reject**. Rejection requires a reason; the provider is notified and prompted to re-upload.

## Step 4 — Primary Source Verification (PSV)

The platform automatically queues the bot runs appropriate for the provider type:

| Provider type | Bots |
|---------------|------|
| MD | License, DEA, ABIM/ABFM, OIG, SAM, NPDB |
| DO | License, DEA, OIG, SAM, NPDB |
| PA | License, NCCPA, OIG, SAM, NPDB |
| NP | License, OIG, SAM, NPDB |
| LCSW | License, OIG, SAM |
| LMHC | License, OIG, SAM |

Each bot produces a verification PDF that is stored on the provider's file. See [Primary Source Verification](bots.md) for details on how bots work, how to re-run them, and how to handle failures.

Bot runs show on the **Verifications** tab. A green check means complete and unflagged. A yellow triangle means *flagged for review* — a staff member must click **Acknowledge** after reviewing.

## Step 5 — Reference and employment verification

In parallel with PSV, the platform emails:

- Every employer in the provider's last 5 years with a one-page form.
- Each of the three professional references.

Responses come back to the **Verifications** tab. You do not need to chase them manually — the platform sends reminders at day 3, 7, and 14. After 21 days you receive an escalation alert.

## Step 6 — Committee readiness

When every item is complete, the platform moves the provider to **Committee ready**. You'll see them in the *Awaiting committee* view.

Before placing on the agenda:

1. Open the **Committee** tab → **Generate summary sheet**. The system produces a PDF summarizing the file.
2. Spot-check the sheet. Everything should be green or acknowledged.
3. Click **Add to next committee** or **Add to specific date**.

## Step 7 — Committee review

See [Committee workflow](committee.md) for the full procedure. After the committee votes:

- **Approve** — the provider moves to *Approved*. Enrollments kick off automatically for the delegated payers.
- **Deny** — the provider moves to *Denied*. A templated email is queued for your review before sending.
- **Defer** — the provider stays *Committee in review* with specific follow-up tasks assigned to you.

## Step 8 — After approval

Approved providers:

- Are queued for payer enrollment (Medicare, Medicaid, commercial — see [Enrollments](enrollments.md)).
- Are added to the expirables watch list for every dated credential.
- Appear in the FHIR Practitioner endpoint for downstream consumers.
- Are scheduled for recredentialing 36 months out.

You will receive alerts on any provider:

- With a flagged PSV result (any bot)
- Missing documents past 14 days
- With a reference or employer response overdue
- Whose status is stuck in one state for more than 30 days
- With any credential expiring in 90 days

## Common edge cases

### Application came in, but the provider does not have an NPI
Pause the file. The provider must obtain an NPI before PSV can run (we cannot verify a provider without one). Send them the NPI Enumerator link from **Actions → Request NPI**.

### License verification failed (state board website is down)
The bot will retry up to 3 times with exponential backoff. If it still fails, the run shows as *Failed* with a red icon. Click **Retry** or manually verify via the state board and click **Mark as verified manually** with a note.

### Provider lives out of state and has licenses in 4 states
The platform runs one bot per license and merges the results. All must come back green before the file becomes committee-ready.

### Sanction hit on OIG
The bot returns a flagged result. Click **Review** → read the matched record. If it is a name collision (different person), click **Not a match** and add a reason. If it is a real hit, the file is paused and escalated to the Medical Director.

### Committee deferred, provider cannot provide the requested information
Open the deferral task, click **Escalate**, and the committee chair is notified to decide on the path forward (deny, deferred indefinitely, or approve with stipulations).
