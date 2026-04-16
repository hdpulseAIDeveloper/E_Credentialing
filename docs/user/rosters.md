# Rosters

Rosters are monthly CSV submissions Essen sends to delegated payers to add, update, or remove providers. The platform generates them automatically, but staff must review and submit.

## Roster schedule

Rosters run on the **first business day of each month**. The platform automatically:

1. Identifies every delegated payer with an active agreement.
2. Compiles adds (newly approved providers), changes (updated info), and terms (recently terminated providers) since last month.
3. Generates a CSV for each payer using that payer's specific template.
4. Notifies the Roster Manager that draft rosters are ready.

## Reviewing a roster

Open **Rosters** in the left nav. The page shows every roster by payer, each with:

- Month and year
- Number of adds, changes, terms
- Status (Draft, Under review, Approved, Submitted, Acknowledged)
- The Roster Manager owner

Click a row to open the roster detail:

- Preview table showing every row that will be submitted
- Validation column flagging rows with issues (missing NPI, inactive license, mismatched data with CAQH)
- Download CSV button
- Submit button (disabled until validation passes)

### Validation

Before submission, the platform runs validations appropriate to the payer:

- Every row has a valid NPI
- Every row has an active license in the payer's state
- Every row has a valid CAQH ID
- No OIG/SAM sanction is active
- Effective dates are within the payer's expected range

Failed validations show a red icon; click to see the reason. You can fix underlying data on the provider record and **Refresh validation**.

## Submitting a roster

Different payers have different submission methods:

- **Availity (Anthem, Carelon)** — the platform uploads directly through the Availity API. Click **Submit**, and the status moves to *Submitted*.
- **Email (Aetna, Oscar)** — the platform attaches the CSV and the signed cover sheet to a pre-composed email to the payer contact. You review and click **Send**.
- **Portal upload (other payers)** — the platform generates the CSV; you download it and upload manually to the payer portal. After uploading, click **Mark submitted** with the confirmation number.

Once submitted, the platform records:

- Exact CSV that was sent (archived for 7 years)
- Submission method
- Confirmation number (if any)
- Submitter (you)
- Submitted date/time

## Acknowledgements

Payers return acknowledgements typically 5–15 business days after submission. The platform records these:

- Full acknowledgement (all rows accepted)
- Partial acknowledgement (some rows rejected; reasons captured and linked to the provider record)
- No response after 30 days (the platform alerts you to follow up)

For Availity payers, acknowledgements are automated. For email and portal payers, you manually upload the acknowledgement or paste the response text.

## Provider-specific roster issues

Sometimes a payer rejects a specific provider row. Open the acknowledgement → click the rejected row → **Create follow-up**. The platform creates a task assigned to the provider's specialist with the rejection reason.

Common rejection reasons:

- Missing or invalid CAQH ID
- License number mismatch with state board
- Specialty code not in the payer's accepted list
- Duplicate submission (the provider is already on file)

Each has a documented resolution path in the help text on the task.

## Historical rosters

Every submitted roster is archived and is accessible under **Rosters → History**. You can:

- View or download any historical CSV
- See which providers were on which roster
- See all acknowledgements
- Export a report of roster churn (adds/changes/terms over time)

Archived rosters are retained for 7 years per NCQA CVO standards and are included in the auditor package.

## FAQ

**Q: A provider was approved after the roster was generated but before we submitted. Can I add them?**
A: Yes — click **Refresh** on the draft roster. The platform regenerates it with current data. You can do this any time before clicking **Submit**.

**Q: The roster failed validation for a row I can't fix right now.**
A: Click **Exclude row** with a reason. The row is held back and will appear on next month's roster. The audit log captures the exclusion.

**Q: A payer sent us a rejection for a roster we submitted 6 weeks ago.**
A: Open the roster in History → **Record acknowledgement** → paste or upload the rejection. The platform creates tasks for each rejected row.

**Q: Do I need to manually track roster confirmation numbers?**
A: No — the platform records them on submission. You only need to copy-paste the number for email and portal payers after submission.
