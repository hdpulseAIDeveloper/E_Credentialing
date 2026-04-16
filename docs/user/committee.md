# Committee Workflow

The credentialing committee reviews and approves providers after all verification is complete. This page describes how to prepare, run, and document a committee meeting.

## Who's on the committee

- **Committee Chair** (usually the Chief Medical Officer)
- **Committee Members** (credentialing-trained clinicians)
- **Credentialing Manager** (presents files)
- **Committee Secretary** (records decisions)

Meetings are held every other Tuesday at 3:00 PM, but committees can be convened ad hoc for urgent files.

## Preparing the agenda

1. Open the **Committee** page in the left nav.
2. Click **New meeting** → choose a date. The platform fills the agenda with every provider currently in *Committee ready* status.
3. Review the list. Remove or reschedule files that are not actually ready (a deferred or flagged file, for example).
4. Click **Generate agenda PDF**. The platform produces a single PDF with:
   - A cover page listing all providers, types, and specialties
   - A one-page summary sheet per provider
   - PDF bookmarks that jump to each provider's section
5. Click **Publish agenda**. Every committee member gets an email with the PDF attached and a link to the meeting in the platform.

The agenda can be regenerated up to 1 hour before the meeting. After that it locks so nobody is reviewing different versions.

## The summary sheet

Each summary sheet shows, on one page:

- Provider name, type, specialty, NPI
- Education, residency, current license states
- PSV status — every verification with date and result
- Flag count and severity
- Any committee history (prior deferrals or conditions)
- The specialist's narrative recommendation

If anything is missing or flagged, the flag is visible at the top in red.

## Running the meeting

Open the meeting in the platform. The screen shows:

- A read-only panel with the current provider's summary
- Quick navigation (prev / next) to cycle through files
- A **Decision** panel with three buttons: *Approve*, *Deny*, *Defer*
- A free-text field for the Chair's notes
- A section for recording individual member votes if a vote is non-unanimous

For each provider, the Chair reads the summary, members discuss, and the Chair clicks the decision. The Secretary adds any notes. The platform auto-advances to the next provider.

### Decisions

**Approve**
- The provider moves to *Approved* status.
- Enrollment workflows start automatically for delegated payers.
- The provider receives a welcome email.
- A 36-month recredentialing date is set.

**Deny**
- The provider moves to *Denied* status.
- A denial letter drafts automatically; the Manager reviews and sends.
- The reason is recorded and locked.

**Defer**
- The provider stays in *Committee in review*.
- The committee specifies what is needed (e.g., "Additional reference from last employer").
- A task is assigned to the provider's specialist with a due date.
- The file returns to the next available committee once resolved.

**Approve with conditions**
- A variant of Approve where the committee requires something before full effect (e.g., "Approved — must obtain NJ license within 90 days").
- The platform tracks the condition and surfaces a reminder every 30 days until met.

## After the meeting

1. Click **Finalize meeting**. The platform:
   - Writes a decision record for each provider
   - Emails the official minutes PDF to every member for attestation
   - Updates every provider's status
   - Kicks off post-approval workflows (enrollments, welcome emails, scorecards)
2. Each member clicks the link in the minutes email to attest. This satisfies NCQA requirements for committee minute sign-off.
3. Any deferred files have tasks assigned and the specialist is notified.

## Ad hoc / off-cycle committees

For urgent decisions (an urgent hire, a committee-deferral that needs quick follow-up):

1. Open **Committee → New meeting** → pick a date inside the week.
2. Flag the meeting as **Ad hoc**. The agenda can contain a single provider.
3. Invite only the Chair and 1–2 members; quorum rules are configurable.

The decision flow is otherwise identical.

## Committee reports

Under the **Reports** submenu on the Committee page:

- **Meeting history** — every meeting with decisions per provider
- **Turnaround** — time from *Committee ready* to decision
- **Member participation** — attendance and decision counts per member
- **Deferral reasons** — aggregated deferral causes to identify systemic gaps

These reports feed the NCQA CVO audit package automatically.

## Tips

- Always pre-read the agenda PDF before the meeting — this cuts the meeting time in half.
- Keep the Chair's notes free of PHI beyond what is needed. Our audit logs show who read each file.
- If the committee needs a deep dive on a single provider, open their full record in a second tab; the current meeting screen stays in sync.
- After a string of deferrals, check the **Deferral reasons** report. Common reasons often point to a checklist gap.
