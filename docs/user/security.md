# Security and Privacy

This page summarizes how the platform protects data and what you, as a user, need to know.

## Authentication

- **Staff** sign in using their Essen Microsoft 365 account. No separate password exists.
- **Multi-factor authentication (MFA)** is required for every staff user, enforced at the Microsoft / Azure AD layer.
- **Providers** use a one-time magic link sent to their email. Links are valid for 72 hours and single-use.
- Sessions time out after 30 minutes of inactivity for staff, 15 minutes for providers.

## Authorization

- Every action is checked against your role. If you do not have access, the action is refused and the attempt is logged.
- Provider-level permissions are respected — you only see providers assigned to your panel (for specialists), your facility (for hospital-privilege users), or your oversight scope (for Managers/Compliance).

## Audit logging

Every meaningful action is recorded:

- Who did it (user or system)
- When (to the millisecond)
- What (action type)
- Which record (entity and ID)
- From where (IP and user-agent)
- What changed (before and after values for edits)

Audit logs are append-only, tamper-evident, and retained per your retention policy (7 years default).

## Protected Health Information (PHI)

- SSN, date of birth, home address, and home phone are encrypted at rest with AES-256.
- Whenever possible the UI shows a masked value (e.g., `XXX-XX-1234` for SSN) with a click-to-reveal that triggers an audit event.
- CSV exports strip full SSN and DOB by default; a Manager role can override with a reason that is logged.

## Documents and files

- Uploaded files are stored in a private Azure Blob container.
- Staff and providers only access files through authenticated download links that expire in 5 minutes.
- Every download is logged with the user, file, and timestamp.
- Anti-virus scanning runs on every upload; infected files are quarantined immediately.

## Transport

- All traffic uses HTTPS with TLS 1.2 or newer.
- Certificates are managed automatically.

## Data location

- Primary database and file storage are in Azure US East.
- Backup and disaster recovery sites are in Azure US Central.
- No data is stored outside the continental U.S.

## Reporting a security concern

- If you see something wrong — an account you do not recognize, an email that looks phished, a document where it should not be — report immediately to **security@essenhealthcare.com**.
- Do not attempt to investigate or clean up on your own. Reporting is the right action.

## Security responsibilities as a user

- Do not share your account. Ever.
- Lock your screen when you step away (Windows key + L).
- Do not email PHI. Use the platform's messaging or secure file sharing.
- Do not screenshot and share provider records.
- If you suspect your account is compromised (unusual email, strange login alert), contact IT immediately.
- Complete your quarterly security training on time.
