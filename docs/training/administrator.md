# Administrator Training Plan

*3 hours self-paced. Required for every user with the Admin role.*

## Module 1 — Admin responsibilities (15 min)

**Read**
- [Administration](../user/admin.md)
- [Security](../user/security.md)

Understand the split between:
- **Identity / access** (done primarily in Azure AD groups, reflected here)
- **Platform configuration** (done in the Administration area)
- **Operational visibility** (done through the Audit Log and Compliance reports)

## Module 2 — Users and roles (30 min)

**Practice**
1. Open Administration → Users. See who has which roles.
2. Look at Azure AD group mapping. Note the sync timestamp.
3. Simulate a role change by altering sandbox AD group membership; wait for sync; observe the user's new menu visibility.

## Module 3 — Provider types and PSV config (45 min)

**Practice**
1. Open Provider Types. Add a new synthetic type (e.g., "Surgical Technologist"). Configure applicable bots.
2. Open PSV Configuration. Change a retry count. Understand the implication.
3. Roll back the change via the Audit Log.

## Module 4 — Payer configuration (30 min)

**Practice**
1. Open Payers. Review Anthem's configuration: roster template, Availity integration, required fields.
2. Simulate a new payer: "Example Plan." Configure it as direct, specify portal method, add required fields.
3. Observe how the new payer appears in the enrollment workflow.

## Module 5 — Integrations (30 min)

**Topics**
- iCIMS sync schedule and failure alerts
- CAQH credential rotation via Key Vault
- Azure AD tenant and group mapping
- Public API key issuance

**Practice**
1. Open Administration → Integrations. Observe iCIMS last sync time and health.
2. Issue a new public API key for a synthetic consumer. Rotate and revoke it.
3. Open the FHIR endpoint configuration and review rate-limit settings.

## Module 6 — Audit, retention, compliance (30 min)

**Practice**
1. Open Administration → Audit Log. Search for specific user activity.
2. Observe that you cannot edit or delete an entry.
3. Open Retention. Apply a legal hold to one synthetic provider. Observe that purge workflow is blocked.
4. Remove the hold.

## Module 7 — Break / fix (10 min)

Review the runbook for common admin issues:
- iCIMS sync failure
- Bot-wide outage
- Azure Blob degradation
- Key Vault rotation

Know the on-call escalation path.

## Competency check

Pass rate: 90% on a 20-question assessment. Focus: role management, PSV config, payer config, integrations, audit log, retention holds, incident response.
