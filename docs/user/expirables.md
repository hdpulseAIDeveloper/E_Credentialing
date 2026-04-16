# Tracking Expirables

Every dated credential — license, DEA, board certification, malpractice insurance, BLS, infection control — must be re-verified before it expires. The **Expirables** page is the single place to see every upcoming expiration and manage renewals.

## The dashboard

The top of the page shows three bands:

- **Expiring in 30 days or less** — red. Action required now.
- **Expiring in 31 to 90 days** — yellow. Outreach in flight.
- **Expiring in 91 to 180 days** — green. Being monitored.

Under each band, a table of credentials with:

- Provider, type, credential (e.g., "NY DEA"), expiration date
- Current outreach state (Not started, Reminder sent, Awaiting provider, Received, Verified)
- Last contact date
- Owner (the specialist responsible)

## Automated outreach

The platform runs a scheduled outreach cadence for every expirable:

- **120 days** before expiration — first email to the provider with a request to renew
- **90 days** — reminder email
- **60 days** — second reminder, specialist alerted
- **30 days** — urgent reminder, Manager alerted
- **7 days** — final reminder, escalated
- **1 day** — if not received, provider status moves to "At risk" on the compliance dashboard

You do not need to do anything to start this — it happens automatically for every dated credential on every provider.

## Receiving and verifying a renewal

When the provider uploads a renewed document, the platform:

1. Adds the document to the provider's file
2. Creates a task for you to verify
3. Queues the appropriate PSV bot to re-verify (e.g., license bot for a license renewal)

To verify:

1. Open the expirable row → click the linked task.
2. Review the uploaded document.
3. Review the PSV bot run result.
4. Click **Mark verified**. The expirable clears and the new expiration date is recorded.

If the PSV bot flags an issue with the renewal (license shows inactive, for example), the expirable stays open and you follow the flag handling flow.

## Manual entry

If a provider gives you a renewed credential outside the email flow:

1. Open the provider record → **Licenses** (or the appropriate tab).
2. Click **Edit** on the expiring credential → update the expiration date and any other fields.
3. Upload the new document under the provider's **Documents** tab.
4. Click **Verify** on the expirable row.

## Bulk renewals

For mass renewals (everyone's BLS every 2 years, for example):

1. Open **Expirables → Bulk actions**.
2. Filter to the credential type.
3. Click **Send bulk reminder**. All affected providers get a customized email.

## The Expirables report

Under **Reports → Expirables**:

- Renewals completed on time vs. after expiration
- Average days from first reminder to receipt
- Providers with a history of late renewals
- Credentials most frequently expiring late

These feed the NCQA CVO compliance dashboard.

## FAQ

**Q: A provider says they have already renewed but we have not received the document.**
A: Ask them to forward the renewal confirmation or new license card to their Essen specialist. Upload it yourself via the provider record.

**Q: A credential expired while the provider was out — now what?**
A: Open the expirable → **Actions → Pause clinical privileges**. The provider is flagged in the directory and their hospital privileges are reviewed. Once renewed, click **Resume privileges**.

**Q: The expirable date in our system is wrong.**
A: Edit the credential directly on the provider's **Licenses** tab with the correct date. The platform recalculates outreach cadence automatically.

**Q: We need a custom reminder schedule for a specific provider.**
A: Open the expirable → **Actions → Customize cadence**. You can override each reminder date. This is logged.
