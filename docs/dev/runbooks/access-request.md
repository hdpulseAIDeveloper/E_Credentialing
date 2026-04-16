# Runbook: Staff access request

Provision a new staff member with the right role and access.

## Prerequisites

- Their Microsoft 365 account exists.
- Their hiring manager has signed off.
- For Admin role: an additional approval from the existing Admin + CMO.

## Procedure

### 1. Add them to the correct Entra AD group

In the Microsoft 365 admin portal (Azure AD → Groups):

| Role | Group |
|------|-------|
| Specialist | `credentialing-specialist` |
| Manager | `credentialing-manager` |
| Committee Chair | `credentialing-committee-chair` |
| Committee Member | `credentialing-committee-member` |
| Roster Manager | `credentialing-roster-manager` |
| Compliance Officer | `credentialing-compliance` |
| Billing | `credentialing-billing` |
| Admin | `credentialing-admin` |
| Read-only | `credentialing-readonly` |

Multiple groups = multiple roles.

### 2. Wait for sync

The nightly Entra→app sync job runs at 02:00 ET. To force a sync sooner:

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-web-prod npm run job:sync-entra"
```

### 3. Notify the user

Tell them:

- URL: https://credentialing.hdpulseai.com
- Sign in with their Microsoft 365 account.
- Which role(s) they'll have.
- Link to their training plan: https://credentialing.hdpulseai.com/docs/training/<role>

### 4. Verify

Ask them to sign in while you watch. Confirm:

- They see the expected menus.
- They cannot see menus they shouldn't.
- The audit log captures their login.

## Removing access

When staff leave or change roles:

1. Remove them from the Entra group(s).
2. The nightly sync deactivates them in the app within 24 hours (or run the force-sync command).
3. Confirm they can no longer sign in.
4. Reassign any providers they owned (see [Working with providers](../../user/providers.md) → Owner and handoff).

## Emergency revocation

If credentials are compromised:

1. Disable the user in Entra AD (not just remove from group).
2. Run the force-sync.
3. Verify they cannot sign in.
4. Rotate any admin-shared secrets they had access to (if any — we minimize these).
