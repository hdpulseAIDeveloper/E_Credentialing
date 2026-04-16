# Compliance Officer Training Plan

*2 hours self-paced.*

## Module 1 — Your read-only scope (15 min)

Understand:
- Compliance users have read access to every provider record.
- You can run every report, including custom reports.
- You cannot modify provider data — that keeps your review independent.
- You do approve/deny roster re-submissions when they touch compliance gates (sanctions hits, denied providers).

## Module 2 — The Compliance dashboard (30 min)

**Read**
- [Reporting → Compliance](../user/reporting.md)

**Practice**
1. Open the Compliance dashboard. For each NCQA standard, identify the source data.
2. Drill into the Sanctions tile and review the most recent weekly sweep.
3. Check the Expirables tile and identify any on-time-renewal shortfalls.

## Module 3 — Sanctions monitoring (30 min)

**Read**
- [Sanctions](../user/sanctions.md)

**Practice**
1. Review a flagged sanction. Walk through the review dialog.
2. Practice the acknowledgement with reason text that would satisfy an auditor ("DOB and state differ…").
3. Look at a historical confirmed match (sandbox has one). Trace the full workflow: flag, CMO escalation, enrollment termination.

## Module 4 — The auditor package (30 min)

**Practice**
1. Generate the auditor package from Reports → Compliance → Auditor package.
2. Inspect every section: sample files, minutes, policies, sanction sweep logs, training records.
3. Understand the NCQA sample sizes — the platform generates samples correctly but you should spot check.

## Module 5 — Continuous controls (15 min)

**Topics**
- HMAC-chained audit logs and how to detect tampering
- Retention policies and legal holds
- Data subject requests (rare; but documented procedure)

**Practice**
1. Open the audit log. Filter by "access to a specific provider" and confirm the chain.
2. Open Administration → Retention and read the current policy.

## Competency check

Pass rate: 90% on a 15-question assessment. Focus: dashboard interpretation, sanction review, auditor package generation, audit log inspection, retention policy.
