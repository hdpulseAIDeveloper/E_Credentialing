# Recredentialing

Every approved provider is recredentialed every **36 months**. Recredentialing repeats the verification process to confirm the provider's credentials remain valid and there are no new sanctions, malpractice events, or adverse actions.

## When it starts

The platform automatically starts a recredentialing cycle:

- **180 days before** the current credentialing anniversary for each provider.
- The provider is moved to a recredentialing "in progress" status without changing their active clinical state.

## The cycle

Recredentialing runs through the same sequence as initial credentialing, with lighter-touch application requirements:

1. **Abbreviated application** — the provider reviews their existing data, confirms it is still accurate, and updates anything that has changed.
2. **Document refresh** — expired documents are refreshed (new license copy, new malpractice insurance, new board certificate if applicable).
3. **Full PSV** — every bot re-runs (license, DEA, boards, sanctions, NPDB).
4. **Committee review** — the committee reviews the refreshed file and approves a new 36-month cycle.
5. **New anniversary date** — set to the committee decision date.

## Bulk initiation

The **Recredentialing** page shows every provider with an upcoming cycle:

- **Due in 90 days**
- **Due in 180 days**
- **In progress**
- **Overdue** (past their anniversary — this is a compliance risk)

Click **Bulk start** to initiate multiple cycles at once. The platform sends the abbreviated application link to each selected provider and creates tracking tasks.

## Overdue handling

If a provider's recredentialing does not complete by their anniversary, the platform:

- Flags the provider as **Overdue** (red banner on their record).
- Alerts the Manager and CMO.
- Optionally pauses their enrollments (configurable in settings).

Overdue is a serious compliance flag — NCQA requires 100% of providers to be recredentialed on time.

## Differences from initial credentialing

- Work history: provider confirms existing rather than re-entering from scratch
- References: required only if the provider has changed employment since last cycle
- Education: not re-verified (one-time at initial)
- Sanctions: always re-run
- NPDB: continuously monitored, so recredentialing just records the latest query

## The recredentialing dashboard

Key metrics:

- **Percent on time** — targeting 100%, NCQA standard
- **Average time to complete** — from start to committee decision
- **Open cycles by specialist** — to balance workload
- **Upcoming spike** — providers with anniversaries in the next 6 months, to plan staffing

## FAQ

**Q: Can a provider's recredentialing date be changed?**
A: Only by an Admin with a documented reason (e.g., leave of absence). Check the audit log for any changes.

**Q: What happens if new adverse events show up during recredentialing?**
A: They surface on the committee summary sheet just like during initial credentialing, and the committee reviews them. A deferral or denial at recredentialing pauses the provider's clinical status.

**Q: A provider moved to another state — do we need to recredential immediately?**
A: No, the anniversary date doesn't change. You do need to add the new state license to their record so expirable tracking kicks in.

**Q: How long does a typical recredentialing take?**
A: 30–60 days, depending on provider responsiveness. Automated PSV happens in hours; the slow step is usually getting the provider to complete the abbreviated application.
