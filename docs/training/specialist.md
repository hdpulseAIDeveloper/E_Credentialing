# Specialist Training Plan

*4 hours self-paced. Complete in the sandbox tenant.*

## Prerequisites

- Microsoft 365 account with access to the ESSEN Credentialing Platform
- Azure AD group `credentialing-specialist` assigned
- Laptop with Chromium browser (Chrome or Edge)

## Module 1 — Orientation (30 min)

**Watch / read**
- [Getting started](../user/getting-started.md)
- [Working with providers](../user/providers.md)

**Try**
1. Sign in to the sandbox at https://sandbox.credentialing.hdpulseai.com.
2. Open the Providers list. Apply filters. Save a view named "My panel."
3. Open a synthetic provider and walk through every tab.

**Check**
- Can you describe each lifecycle status?
- Can you find a provider by SSN last 4?

## Module 2 — The credentialing workflow (60 min)

**Read**
- [Credentialing workflow](../user/credentialing.md)
- [Primary Source Verification](../user/bots.md)

**Try**
1. Create a new synthetic provider via `New provider`.
2. Click `Actions → Re-send invitation` and observe the email template.
3. Open an existing provider in *Verification in progress* and review the checklist.
4. Trigger a License bot manually. Watch the run complete, then review the PDF and parsed fields.
5. For a provider with a flagged OIG result, practice the "Not a match" acknowledgement with a written reason.

**Check**
- What do you do when a bot returns "Requires manual"?
- What triggers an OIG flag to be a real concern vs. a false positive?

## Module 3 — Documents and uploads (45 min)

**Read**
- [Working with providers](../user/providers.md) (Documents tab)
- [Security](../user/security.md)

**Try**
1. Open a synthetic provider's Documents tab.
2. Approve one document; reject one with a reason.
3. Click the View link on a document — observe that the URL is a short-lived signed link.
4. Request a document replacement and watch the provider-facing email preview.

**Check**
- Why don't we send direct Azure Blob URLs to staff or providers?
- What happens when a document is rejected?

## Module 4 — Expirables (30 min)

**Read**
- [Expirables](../user/expirables.md)

**Try**
1. On the Expirables dashboard, apply the filter "Expiring in 30 days or less."
2. Open one record and walk through the outreach cadence panel.
3. Simulate receiving a renewed document by uploading a PDF and clicking `Mark verified`.

**Check**
- When do automatic reminders start?
- What happens if a credential truly expires?

## Module 5 — Rosters and enrollments (45 min)

**Read**
- [Rosters](../user/rosters.md)
- [Enrollments](../user/enrollments.md)

**Try**
1. Open the Rosters page. Review a draft roster. Look at the validation column.
2. Open an enrollment record for a delegated payer. Identify `Submitted` and `Effective` dates.
3. On an enrollment in `Pending docs`, click `Request document` and walk through the outreach flow.

**Check**
- Which payers are delegated and which are direct?
- Where do you see EFT and ERA status?

## Module 6 — Reporting and compliance (30 min)

**Read**
- [Reporting](../user/reporting.md)

**Try**
1. Open the Pipeline report. Filter to your saved view "My panel."
2. Open the Expirables report. Export a CSV with SSN masked.
3. Open the Compliance dashboard and identify any red or yellow tiles.

**Check**
- How do you schedule a saved report to email you weekly?
- What's in the auditor package and who generates it?

## Competency check

Pass rate: 80% correct on a 20-question short-answer assessment. The Manager schedules the check at the end of day 2.

Topics covered: provider lifecycle, PSV bots, document workflow, expirables cadence, roster submission, reporting, security.
