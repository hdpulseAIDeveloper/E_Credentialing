# Primary Source Verification (PSV) Bots

PSV bots are small automated browser scripts that check a provider's credentials against the official source (state medical boards, DEA, boards, sanctions lists, NPDB). They replace manual verification and produce a PDF snapshot of the source-of-truth as evidence.

## The bot list

| Bot | What it verifies | Source |
|-----|------------------|--------|
| License Verification | A state medical / PA / NP / LCSW license is active | State medical board websites |
| DEA Verification | A DEA number is active and not sanctioned | DEA Diversion Control |
| Board NCCPA | PA certification | nccpa.net |
| Board ABIM | Internal medicine board certification | ABIM |
| Board ABFM | Family medicine board certification | ABFM |
| OIG Sanctions | Federal exclusion list check | OIG LEIE |
| SAM Sanctions | Federal award management exclusion check | SAM.gov |
| NPDB Query | Malpractice and adverse action query | NPDB |
| eMedNY / ETIN | New York Medicaid enrollment and ETIN affiliation | eMedNY portal |
| Education AMA | AMA medical school verification | AMA |
| Education ECFMG | International medical graduate verification | ECFMG |

## Running bots

Bots run automatically when a provider's application is submitted. You rarely need to trigger them manually, but you can.

### Automatic runs

- On application submission, the platform queues every bot that applies to the provider type.
- Sanctions (OIG + SAM) re-run **weekly** for every approved provider.
- License bots re-run for providers whose license is expiring in 60 days.

### Manual runs

From the **Verifications** tab:

1. Find the bot you want to re-run in the table.
2. Click **Run now**.
3. The run enters the queue and typically starts within 30 seconds.

You can trigger any of the user-runnable bots manually. System-internal bots (enrollments, expirable renewals) are triggered only by their dedicated workflows — that is by design.

## Understanding a bot run

Each run has four possible statuses:

| Status | What it means | What to do |
|--------|---------------|------------|
| Queued | Waiting for a worker to pick it up | Nothing — usually <30s |
| Running | A browser is executing the script | Nothing — most finish in 2–5 min |
| Completed | The bot finished and stored results | Review the result |
| Requires manual | Cannot finish automatically (e.g., DEA MFA timeout) | Finish manually and click **Mark as verified manually** |
| Failed | The bot hit an error and exhausted retries | Click **Retry** or do a manual check |
| Retrying | An intermediate attempt; the bot will try again | Nothing — it will retry up to 3 times |

The **Result** panel on each run shows:

- The generated PDF (click to download)
- Parsed fields (license number, issue date, expiration, status)
- A flag indicator (green = clean, yellow = flagged)
- An audit footer with the exact URL queried and timestamp

## Flagged results

A bot flags when:

- The license is listed as expired, suspended, or revoked
- DEA is sanctioned
- A board certification is inactive or expired
- OIG or SAM shows a potential match
- NPDB returns any record

A flagged result **does not** mean the provider is disqualified. It means a human must review. Open the run, look at the flag reason, and:

- **Click Acknowledge** if the flag is a false positive (e.g., another provider with the same name on OIG). You must include a reason; the acknowledgement is logged.
- **Click Escalate** to send to a Manager if you are not sure.
- **Click Pause file** if the flag is a real issue; this stops PSV and notifies the Medical Director.

## Re-running a failed bot

Common causes of failure:

- State board website is slow or down — retry in 30 minutes.
- Bot cannot parse an unusual page — open a ticket with the IT team.
- Credentials for the external site have rotated — vault update is needed (contact IT).

If retry does not work, do the verification manually (paste the URL from the failed run into a browser) and then click **Mark as verified manually**. Upload a PDF of the screen capture; this becomes the evidence for the audit trail.

## Viewing evidence PDFs

Every successful verification produces a PDF saved to the provider's file. To review:

1. Open the provider's record.
2. Click **Documents** → filter by *Verification*.
3. Click any PDF to preview in-browser or download.

PDFs are named with a consistent convention (e.g., `NY License Verification, Exp. 06.30.2028`) so they are easy to identify in the file list.

## Sanctions monitoring

Sanctions (OIG + SAM) are special: they run **weekly** for every approved provider, in addition to the initial credentialing check. This matches NCQA CVO requirements.

Any new match surfaces as an alert in your dashboard and on the provider's record. Manager sign-off is required on every flagged sanctions hit.

## FAQ

**Q: How long does a bot take to run?**
A: 30 seconds to 5 minutes. Board and license bots are slower. Sanctions and NPDB are fastest.

**Q: What if a bot keeps failing for a specific provider?**
A: After three retries the run is marked Failed. Use **Mark as verified manually** with a PDF you captured yourself. If the same bot fails for many providers, open a ticket — the external site probably changed.

**Q: Can I schedule a bot to run overnight?**
A: No — bots run in the queue in near real-time. The weekly sanctions recheck runs automatically on a schedule; you do not need to configure it.

**Q: A bot produced a flagged result but the provider is clearly clear. What do I do?**
A: Click **Acknowledge** on the verification record, add a reason in the note (e.g., "Same name, different NPI — confirmed"), and save. The flag clears for committee purposes.
