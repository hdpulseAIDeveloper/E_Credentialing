# Frequently Asked Questions

## Getting started

**Who can use the platform?**
Essen staff with a credentialing role (specialists, managers, committee members, compliance, billing) and providers being credentialed. Everyone signs in through Essen's Microsoft 365 identity; providers receive a one-time magic link.

**Which browsers are supported?**
Chromium-based browsers (Chrome, Edge) and Firefox are fully supported. Safari works for most workflows but some advanced features (bulk actions) are best on Chromium.

**Why can I see some screens but not others?**
Menu visibility is driven by your role. If you need access to a section you cannot see, contact your Manager.

## Providers and applications

**How long is an invitation link valid?**
72 hours. After that, resend from the provider's record.

**A provider cannot find the invitation email.**
Ask them to check spam. Resend from their record. If still not received, consider whether the email address on file is correct.

**The provider submitted their application, but we still see gaps.**
Missing fields are flagged on the record. Request follow-up via the Checklist.

## Bots and verification

**A bot has been running for 20 minutes — is that normal?**
No. Most bots finish in under 5 minutes. Open the run — it probably needs manual intervention. Click **Cancel** and then **Retry**, or verify manually.

**Why did my bot say "Requires manual"?**
Some external sites require human input (DEA has MFA, some state boards require captchas). Complete the verification manually and click **Mark verified manually**.

## Committee

**Can we add a provider to a committee that is starting in 30 minutes?**
Yes, up to 1 hour before the meeting. After that the agenda locks.

**What if a committee member cannot attend?**
As long as quorum is met, the meeting can proceed. Absent members see the finalized minutes and attest when they return.

## Enrollments

**A provider is approved but their Medicare enrollment has not started.**
Check the enrollment record — if it is *Pending docs*, there is a document missing. Click through to see what is needed.

**A payer rejected the roster entry for a provider.**
Open the acknowledgement, click the row, and a follow-up task is created. Fix the underlying provider data and include on next month's roster.

## Expirables

**A license expires tomorrow and we haven't heard from the provider.**
Call them. Renewed credentials sometimes sit in a provider's inbox because the email went to spam. If the provider cannot renew in time, follow the **Expired credential** policy (pause clinical privileges).

**Do we track BLS expiration?**
Yes — any dated credential in the provider's file is tracked. If BLS isn't being tracked, ensure it is entered in the provider's **Licenses / Certifications** section with an expiration date.

## Reporting

**Can I get a report of providers by specialty?**
Yes — Reports → Pipeline → filter by specialty.

**Can I export a CSV?**
Yes, any report has an **Export** button. SSN and DOB are masked unless you have a Manager role and include a reason.

## Security

**My teammate is out and I need to see their assigned providers.**
Managers can view any provider. Specialists cannot normally see providers outside their panel; temporary access is requested through the Manager.

**I accidentally clicked "Reveal SSN." Is that a problem?**
No — but the action is logged. If you did not mean to, you do not need to do anything else.

**Where do I report a bug?**
Use the **Help** menu → **Report a bug** or email support@credentialing.hdpulseai.com. Include screenshots if possible.

## General

**Is there a mobile app?**
Not yet. The web UI works on tablets. A mobile app is on the roadmap.

**Can providers update their own information after approval?**
Yes — providers can sign in via a magic link at any time to update their CAQH-equivalent data. Some changes (name, SSN) require staff review and approval.

**Where is the platform hosted?**
In Azure (U.S. datacenters). See [Security and Privacy](security.md) for details.
