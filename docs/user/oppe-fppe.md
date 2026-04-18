# OPPE / FPPE

Ongoing (OPPE) and Focused (FPPE) Professional Practice Evaluations assess a credentialed provider's clinical performance on a schedule. The platform tracks both.

## OPPE — Ongoing Professional Practice Evaluation

OPPE is a routine check of a provider's clinical competency — typically every 6 months. It reviews:

- Patient outcomes (readmissions, mortality, adverse events in scope)
- Peer review activity
- Complaints or incidents
- Procedure volume (for specialists doing procedures)
- Documentation quality

Each OPPE record has:

- The reviewed period (start / end dates)
- Data points from linked sources
- The reviewer and their decision (Acceptable, Needs monitoring, Triggers FPPE)
- Action items (if any)

The platform surfaces the next OPPE due date on each provider's record. Specialists complete OPPE by clicking **New OPPE** on the provider's record, pulling data from connected sources (EHR, incident system), and recording the review.

## FPPE — Focused Professional Practice Evaluation

FPPE is triggered by specific events:

- A new provider's first 6 months (initial FPPE)
- Granting of new privileges
- A concerning finding in OPPE
- An incident or patient safety event

Each FPPE includes a defined evaluation plan: what will be reviewed, by whom, for how long, with what threshold of cases.

When FPPE is triggered:

1. Open the provider's record → **OPPE/FPPE → New FPPE**.
2. Select the trigger (new provider, new privilege, OPPE finding, incident).
3. Choose an evaluator.
4. Define the evaluation plan (number of cases, time window, scoring criteria).
5. Save. The plan shows as *Active*.

As the evaluator reviews cases, they record findings. When the plan is complete:

- *Satisfactory* — FPPE closes, provider returns to OPPE only.
- *Needs more time* — extend the plan.
- *Not satisfactory* — refers to committee for further action.

## The OPPE/FPPE dashboard

Under **Evaluations** (sidebar → `Practice evaluations`):

- Scheduled, In Progress, Overdue, and Completed-this-month counts as
  summary cards across the top
- A filterable list of every evaluation (by provider name, type, status)
- One-click navigation to the provider record for context

The platform also auto-schedules the JC-required cadence so staff never
have to remember to create the next OPPE:

- Every approved provider with active hospital privileges gets an
  initial OPPE seeded as soon as they become eligible.
- The next-cycle OPPE is pre-created automatically once the current
  cycle is within 30 days of ending.
- A new FPPE is auto-created as soon as a hospital privilege is
  approved (Joint Commission MS.08.01.01) — staff just have to record
  the findings.

See [`docs/compliance/jc-npg-12.md`](../compliance/jc-npg-12.md) for
the full mapping to TJC standards.

## FAQ

**Q: Can we customize the OPPE cadence per specialty?**
A: Yes — Admin → Settings → Practice Evaluation. Common cadences are 6 months for high-acuity specialties and 12 months for low-acuity.

**Q: Where does the OPPE data come from?**
A: Some fields pull from connected systems (EHR incident reports). Others are manually entered by the specialist or chief. The platform records the source of every data point.

**Q: An FPPE is closing as "Not satisfactory." What happens?**
A: The platform creates a committee task. The committee reviews and may suspend privileges, require remediation, or in severe cases terminate.
