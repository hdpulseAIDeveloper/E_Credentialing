# Sanctions Monitoring

Sanctions monitoring checks every provider against federal exclusion lists to ensure Essen does not bill federal programs for an excluded provider. This is both a legal requirement and an NCQA CVO standard.

## The lists

- **OIG LEIE** — Office of Inspector General List of Excluded Individuals and Entities
- **SAM.gov** — System for Award Management exclusions

## Cadence

- **At credentialing** — both lists are queried before the committee reviews a file.
- **Weekly** — every Monday the platform queries both lists for every currently-approved provider. This exceeds the NCQA monthly minimum.
- **At recredentialing** — full re-query as part of the cycle.
- **On-demand** — staff can trigger a query from a provider's record any time.

## The weekly sweep

Every Monday at 2 AM Eastern, the worker kicks off a sanctions recheck for every approved provider. The sweep is idempotent — if a provider was checked in the last 24 hours, they are skipped.

Results land on each provider's record under **Verifications**. New flags surface in your dashboard immediately.

## A flagged result

A sanctions flag means the provider's name appeared on one of the lists. This is almost always a **false positive** — name collisions are very common, especially for common names. The process:

1. Click the flagged run on the provider's record.
2. Review the matched record: name, date of birth, NPI, state.
3. Compare to the provider you are credentialing.
4. If they are different people, click **Not a match** and enter a reason (e.g., "Match DOB and state differ; OIG record is for a different individual"). The flag clears.
5. If they are the same person — this is serious. Click **Confirm match**. The platform:
   - Immediately pauses the provider's clinical privileges (if configured)
   - Alerts the CMO and Compliance Officer
   - Blocks new billing for the provider
   - Queues a review task

## Confirmed sanction workflow

If a sanction match is confirmed:

1. The CMO reviews the situation (maybe a clerical error; maybe a real exclusion).
2. If confirmed real, the provider is **terminated** from Essen per compliance policy.
3. Every active enrollment is terminated with the effective date set to the sanction date.
4. Claims submitted during the sanction period are reviewed with billing.
5. The committee records the decision; a full audit trail is preserved.

## The Sanctions dashboard

Under **Reports → Sanctions**:

- Total providers monitored this week
- New flags this week
- Flags acknowledged vs. pending review
- Historical timeline of any confirmed sanctions

## FAQ

**Q: We have a provider with a very common name and every week he shows up as a potential OIG match. Can we suppress the flag?**
A: Acknowledging "Not a match" once does not suppress future flags — each new sweep checks again. The platform remembers prior acknowledgements and shows them in the review panel so you can click through quickly.

**Q: What counts as "approved" for the weekly sweep?**
A: Any provider whose status is *Approved* — the platform skips providers who are in initial credentialing (they'll be checked when the committee reviews), denied, or terminated.

**Q: Can I run a one-off sanctions query?**
A: Yes — open the provider's record → **Verifications → Run → Sanctions**. The sweep runs on the queue and returns in under a minute.

**Q: Do we also check state Medicaid exclusion lists?**
A: State Medicaid exclusion list checks are run as part of Medicaid enrollment and at recredentialing. They are not on the weekly sweep because state lists update less frequently and programmatic access varies.
