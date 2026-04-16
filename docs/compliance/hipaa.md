# HIPAA

This doc summarizes how the ESSEN Credentialing Platform satisfies HIPAA Privacy and Security Rule requirements.

## PHI handled

| Field | Encrypted at rest | Notes |
|-------|-------------------|-------|
| SSN | Yes (AES-256-GCM) | Masked in UI; reveal triggers audit |
| Date of birth | Yes | |
| Home address (lines, city, state, zip) | Yes | |
| Home phone | Yes | |
| Legal name | No | Name alone is not PHI in the credentialing context |
| NPI | No | Public identifier |
| Work contact info | No | |
| Licenses and credential numbers | No | |
| Uploaded documents | Container private, SAS-only access | Contents may contain PHI |

## Safeguards

### Administrative

- Role-based access via Entra AD groups.
- Quarterly access audit by the Compliance Officer.
- Annual HIPAA training for every user; completion recorded in the user profile.
- Business Associate Agreements with all vendors who process PHI (Azure, Sentry, etc.).
- Formal incident response plan ([runbook](../dev/runbooks/incident-response.md)).

### Technical

- TLS 1.2+ on every hop.
- AES-256-GCM at the application layer for identified PHI fields.
- Azure Storage Service Encryption on Blob Storage and DB backups.
- Entra ID enforces MFA on every staff sign-in.
- Session inactivity timeout (30 min staff, 15 min provider).
- Append-only audit log with HMAC chain.
- Short-lived SAS URLs (5 min) for document downloads.
- No PHI in logs (pino redaction, enforced in code).
- Anti-virus scanning on uploads.

### Physical

- Azure data centers with SOC 2 and HITRUST certifications.
- No physical media in Essen offices hold production PHI.

## Access and authorization

- Minimum necessary: staff see only what their role requires.
- Specialists see only their assigned panel.
- Providers see only their own record via single-use magic-link tokens.
- Admins can see everything but every access is logged.

## Audit and accounting of disclosures

- `AuditLog` captures every meaningful action:
  - Record views
  - Field reveals (SSN, DOB)
  - Mutations (with before/after)
  - Downloads (with SAS URL issued)
  - API key usage
- Retention: 7 years.
- Append-only DB grants + HMAC chain for tamper detection.

## Breach response

If PHI is suspected exposed:

1. Follow the [incident response runbook](../dev/runbooks/incident-response.md).
2. Preserve logs (do not purge).
3. Notify Compliance and Legal.
4. Determine scope and whether HIPAA breach notification requirements apply.
5. Follow notification timelines (individuals within 60 days; HHS, media depending on scale).

## Business Associate obligations

The platform is operated by Essen; any subprocessor we use must have a signed Business Associate Agreement before they touch PHI. Current subprocessors:

- Microsoft Azure (hosting, storage, identity)
- Sentry (planned — error tracking with PHI scrubbing)
- SendGrid (email, no PHI in message bodies)
- Azure Communication Services (SMS, no PHI)

## Provider rights

Providers can:

- Request access to their own credentialing file (through Essen's process).
- Request correction of inaccurate information.
- Receive an accounting of disclosures (upon request).

The platform supports retrieving per-provider audit history to satisfy these requests.

## Retention

- Active provider records: retained for the life of the provider's relationship with Essen.
- Terminated provider records: retained for 7 years after termination date.
- Audit log: 7 years.
- Committee minutes: indefinitely.

Retention is enforced by scheduled purge jobs. Legal holds supersede routine retention.
