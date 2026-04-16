# Audit Logging and Tamper Evidence

The platform maintains an append-only, tamper-evident audit log of every meaningful action.

## What is audited

- Provider record creation, edit, status change
- Document upload and download
- PHI field reveal (e.g., SSN unmask)
- Bot run start / end / manual intervention
- Committee decisions
- Roster generation and submission
- Enrollment state changes
- Sanction flag review (acknowledge, escalate, confirm)
- API key issuance, rotation, revocation
- API key usage (every request)
- Policy attestation
- User sign-in and sign-out
- Admin configuration changes
- Export of any data set
- Impersonation events (non-prod only)

## Data recorded per entry

| Field | Description |
|-------|-------------|
| `id` | Unique identifier |
| `timestamp` | UTC to millisecond |
| `actorType` | STAFF, PROVIDER, BOT, SYSTEM, APIKEY |
| `actorId` | User / provider / bot / api key id |
| `entity` | E.g., Provider, Document, BotRun |
| `entityId` | ID of the affected entity |
| `action` | E.g., CREATE, UPDATE, DELETE, ACCESS, EXPORT, REVEAL_SSN |
| `before` | JSON snapshot prior to change (redacted) |
| `after` | JSON snapshot after change (redacted) |
| `ipAddress` | Caller IP |
| `userAgent` | Client UA |
| `requestId` | Correlation ID |
| `hmac` | HMAC tying this entry to the previous one |

## Tamper evidence

### Append-only

Database grants revoke UPDATE and DELETE on the `audit_logs` table for the application role. A trigger refuses any UPDATE/DELETE attempt and itself writes an audit entry recording the attempt.

### HMAC chain

Each audit entry stores `hmac = HMAC-SHA256(key, prev_hmac || canonical_json(entry_without_hmac))`.

- The HMAC key lives in Azure Key Vault and is distinct from `ENCRYPTION_KEY`.
- A background verifier walks the chain nightly and alerts if any segment breaks.
- Auditor packages include a chain-signature file auditors can independently verify.

### Retention

7 years default. Legal hold can extend indefinitely.

## Access to audit logs

- Admins see the full log via **Administration → Audit Log**.
- Compliance Officers see the full log and can export.
- Other roles have no direct access.
- Providers can request their own audit history through Essen's privacy process.

## Redaction

Snapshot fields (`before`, `after`) are redacted using the same rules as `pino` logs:

- SSN, DOB: replaced with `[REDACTED]`.
- Addresses: replaced with `[REDACTED]`.
- Passwords, tokens, headers: replaced with `[REDACTED]`.

Redaction happens before the entry is written to the DB — plaintext PHI never lands in the audit log.

## Correlation

- HTTP requests: `x-request-id` header + audit `requestId` column.
- Background jobs: `jobId` + audit `requestId` (set to the job id).
- Multi-step workflows: a parent request id is carried through all child actions.

## Monitoring

Alerts fire on:

- Chain verification failure
- Unusual spike in REVEAL_SSN or EXPORT actions
- Unusual login patterns
- API key signal (see [api/audit.md](../api/audit.md))
