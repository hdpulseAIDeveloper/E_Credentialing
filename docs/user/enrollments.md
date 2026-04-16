# Enrollments

Once a provider is approved, they must be enrolled with payers before they can be billed for. The platform tracks three kinds of enrollment:

- **Delegated** — Essen submits the provider on a roster for payers that delegate credentialing to us.
- **Facility (BTC)** — per-facility enrollment for behavioral treatment centers.
- **Direct** — per-payer enrollment where each application is submitted individually.

The **Enrollments** page lists every active enrollment with its current state, submitted date, and effective date.

## The enrollment lifecycle

```
Not started → Pending docs → Submitted → In review → Active → (Terminated)
```

Each payer has its own variations (for example some payers return an approval but require us to confirm the effective date). The platform standardizes these into the five states above.

## Delegated enrollments

For delegated payers, Essen sends a monthly roster CSV. The platform handles this automatically:

1. When a provider is approved, a delegated enrollment record is created for each payer that has a delegated agreement.
2. On the first of the month, the platform generates roster CSVs for each payer, formatted to that payer's template.
3. Staff review and approve each roster; the platform locks it and records the submission.
4. Payer acknowledgements are recorded as they come in.

Delegated payers today:

- Anthem (submitted via Availity)
- Carelon (submitted via Availity)
- Aetna (email)
- Oscar (email)

See [Rosters](rosters.md) for the full roster generation workflow.

## Facility (BTC) enrollments

Behavioral treatment centers have a combined facility-and-practitioner enrollment process. The platform tracks:

- Facility application submission date
- Each practitioner's inclusion in the facility enrollment
- Payer-specific acknowledgement

Use **Enrollments → Facility view** to see facility-based enrollments side by side.

## Direct enrollments

For direct payers, each provider is submitted individually:

| Payer | Portal | Notes |
|-------|--------|-------|
| UnitedHealthcare | My Practice Profile | Automated via bot |
| UBH Optum | My Practice Profile | Automated via bot |
| Medicare | PECOS | Manual submission; platform tracks the PECOS ID |
| NY Medicaid / ETIN | eMedNY | Automated via ETIN bot |
| Archcare | Verity | Automated via bot |

Direct enrollment records are created automatically when a provider is approved. The platform kicks off the submission bot (for automated payers) or creates a task for the specialist (for manual payers).

## The Enrollments page

The page has four tabs:

- **All enrollments** — everything across every provider
- **Pending action** — enrollments waiting on staff or provider input
- **In review** — enrollments submitted and waiting for the payer
- **Terminated** — historical enrollments no longer active

Each row shows:

- Provider, payer, type (delegated/facility/direct)
- Current state
- Days in current state (flagged red if >30)
- Submitted date, effective date
- Notes

Click a row to open the enrollment detail and see the full submission history, attached documents (CAQH, W-9, voided check for EFT), and any payer correspondence.

## Creating an enrollment manually

Rarely needed, but if a payer adds a line of business that wasn't automatic:

1. Open the provider record.
2. Click **Enrollments → Add enrollment**.
3. Select the payer, product (if applicable), and enrollment type.
4. Click **Create**. The platform sets the state to *Not started* and kicks off the appropriate workflow.

## Terminating an enrollment

When a provider leaves Essen or a payer contract is terminated:

1. Open the enrollment detail.
2. Click **Actions → Terminate** → enter an effective date and reason.
3. The platform sends a termination notice to the payer (email or roster) and updates the state.

Terminated enrollments stay in the database for historical reporting and audit.

## EFT and ERA tracking

Each direct enrollment has subfields for EFT (electronic funds transfer) and ERA (electronic remittance advice) setup. These affect how fast Essen gets paid and are tracked on every direct enrollment:

- **EFT status** — Not started, Submitted, Active
- **ERA status** — Not started, Submitted, Active
- **First payment received** — date, flagged if >60 days after effective date

The **Performance** page rolls these up across all providers to flag payers with slow EFT / ERA setup.

## Common scenarios

### Provider was approved but no enrollments appeared
The delegated enrollment configuration may not include them. Check the provider's specialty and provider type; some payer agreements exclude certain types. Contact your Manager if you believe this is a configuration gap.

### Payer rejected an enrollment for missing document
Open the enrollment → **Request document**. The provider receives an email with a direct upload link. When they upload, the enrollment auto-resubmits (for automated payers) or generates a task for you (for manual payers).

### Effective date on the payer side is different from submission date
That is normal. Enter the payer's effective date in the enrollment detail. The platform will show both submission and effective dates going forward.

### Need to see which payers a provider is active with
Open the provider record → **Enrollments** tab. All current and historical enrollments are listed with current state. Use **Export** to pull a CSV for an operations or billing team.
