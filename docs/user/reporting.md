# Reporting & Compliance

The **Reports** section provides the operational metrics, compliance dashboards, and exports Essen needs to run credentialing efficiently and meet NCQA CVO standards.

## Standard reports

| Report | What it shows | Who uses it |
|--------|---------------|-------------|
| Pipeline | Every provider in flight, by stage | Managers |
| Turnaround | Time from invite to approval, broken down by stage | Managers, CMO |
| Bot health | Bot success/failure rates by bot type | IT, Ops |
| Expirables | Upcoming expirations, outreach effectiveness | Specialists |
| Sanctions | Sanction sweep results and follow-ups | Compliance |
| Rosters | Roster submissions, acknowledgements, rejections | Roster Manager |
| Recredentialing | On-time rate, overdue count | CMO |
| Committee | Meeting history, decisions, deferral reasons | Chair, Manager |
| Performance | Provider scorecards, EFT/ERA | Billing, CMO |

Open **Reports** in the left nav and click any report. Reports are live — they update every time you load them.

## The Compliance dashboard

Under **Reports → Compliance**, a single page that rolls up NCQA CVO readiness:

- **File completeness** — percent of files with every required element
- **Turnaround** — median days, with the NCQA benchmark annotated
- **Sanctions** — sweep completeness and resolution of flags
- **Expirables** — on-time renewal rate
- **Recredentialing** — on-time rate (target: 100%)
- **Committee** — percent of files with proper documentation and minute attestation

Each tile is green, yellow, or red based on the NCQA standard. Click any tile to drill into the underlying records.

## Saved reports

You can save any filtered view of a report as a **Saved report**. Saved reports:

- Appear on your dashboard
- Can be emailed on a schedule (daily, weekly, monthly)
- Can be shared with specific users or roles

Click **Save view** in any report page to create one.

## The report builder

Under **Reports → Custom**, a drag-and-drop builder to create ad-hoc reports. You can:

- Pick any entity (Provider, Credential, Enrollment, Committee decision, Bot run)
- Add filters
- Group and aggregate
- Export to CSV or schedule email delivery

Custom reports honor role-based access — you cannot build a report that shows data you cannot normally see.

## CSV exports

Every report can be exported to CSV via the **Export** button. Exports are:

- Streamed (even for large datasets)
- Stripped of SSN and full DOB by default (only last 4 of SSN, year only for DOB) — override requires a Manager role
- Logged in the audit trail (who exported what, when)

## The auditor package

Under **Reports → Compliance → Auditor package**, one-click generation of the full NCQA CVO audit package:

- Provider files (sampled per NCQA sample-size rules)
- Policies and procedures PDF
- Delegation agreements
- Committee minutes
- Sanction sweep logs
- Training records

The package is produced as a single ZIP and is retained for 7 years. Generation is audited.

## FAQ

**Q: I need a report that doesn't exist — how do I get one?**
A: Use the custom report builder. If your data need is complex, open a ticket with IT.

**Q: Can I pull a CSV of every provider's licenses with expiration dates?**
A: Yes — Reports → Expirables → Export, or use the custom report builder.

**Q: Do reports show data in real-time?**
A: Standard reports are near real-time (under 1 minute lag). Compliance dashboards aggregate daily at 6 AM. Custom reports query live.

**Q: Does the platform export to Tableau / Power BI?**
A: Yes — under Administration → Integrations, enable the analytics API. It produces a read-only views layer that Tableau and Power BI can connect to.
