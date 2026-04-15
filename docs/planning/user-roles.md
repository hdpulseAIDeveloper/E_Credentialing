# ESSEN Credentialing Platform — User Roles & Permissions

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Draft — Pending stakeholder review

---

## Overview

The platform has two user categories:

1. **Internal users** (Essen staff) — authenticated via Microsoft Azure AD SSO
2. **External users** (providers) — authenticated via a separate mechanism (TBD)

All role assignments are managed by System Admins. A user can hold only one internal role at a time (roles are mutually exclusive for internal staff).

---

## Role Definitions

### Role 1: Provider (External)

**Description**: A healthcare professional completing their own credentialing application. Providers are external to Essen and have the most restricted access — limited entirely to their own profile.

**Authentication**: External auth (method TBD — Azure AD B2B, email/password, or magic link)

**Primary actions**:
- View and complete their own application
- Upload credential documents
- Review and correct pre-populated fields (from CAQH, iCIMS, photo ID OCR)
- Receive and respond to follow-up communications from Essen staff
- Complete attestation / electronic signature

**Cannot**:
- View any other provider's data
- Access any staff-facing dashboard
- View internal notes or task assignments
- Trigger bot verifications

---

### Role 2: Credentialing Specialist

**Description**: A front-line credentialing team member responsible for managing the day-to-day onboarding pipeline, running verifications, and tracking enrollments and expirables.

**Authentication**: Azure AD SSO

**Primary actions**:
- View and manage assigned provider records (or all records, depending on admin config)
- Manage document checklists and flag items
- Trigger PSV bot runs manually
- Monitor bot run status and review results
- Send follow-up communications (email, SMS, phone log) to providers
- Create and manage tasks (assign to self or other specialists)
- Track and update enrollment records
- Manage expirables and initiate outreach
- Run on-demand sanctions checks
- View audit trail for assigned providers

**Cannot**:
- Approve providers for committee
- Move providers into committee queue manually (can only trigger auto-advancement)
- Manage user accounts or roles
- Configure system settings or document requirement rules

---

### Role 3: Credentialing Manager

**Description**: A senior credentialing team member with full access to the onboarding and committee pipelines. Responsible for committee management, approvals, and team oversight.

**Authentication**: Azure AD SSO

**Primary actions**:
- All Credentialing Specialist actions
- Manually add providers to the committee queue (with justification)
- Create and manage committee review sessions
- Generate and send committee agendas
- Approve or deny providers following committee review
- Stamp approval dates on provider profiles
- Assign tasks to any team member and set priority
- Send bulk follow-up reminders to multiple providers
- View all providers (not filtered by assignment)
- Access system-wide audit trail
- Generate reports and export data
- Review and acknowledge flagged bot results
- Override checklist items with justification

**Cannot**:
- Manage user accounts or roles (Admin only)
- Configure system-level settings

---

### Role 4: Medical Director / Committee Member

**Description**: A physician or committee member who participates in the credentialing committee review. Has read-only access to committee materials and can record approval votes.

**Authentication**: Azure AD SSO

**Primary actions**:
- View committee session agendas
- View provider summary sheets for providers on assigned sessions
- Record approval/denial vote for providers in a session
- Add comments to a provider's committee record
- View aggregate committee session status

**Cannot**:
- View provider application data beyond summary sheets and verification records
- Manage committee sessions (add/remove providers, create sessions)
- Send communications to providers
- Access onboarding dashboard or enrollment modules
- View audit trail

---

### Role 5: System Admin

**Description**: IT or platform administrator responsible for user management, system configuration, and platform-level settings. Not a day-to-day credentialing role.

**Authentication**: Azure AD SSO (with elevated Azure AD group membership)

**Primary actions**:
- Create, edit, deactivate user accounts
- Assign and modify user roles
- Configure provider types and document requirement rules per type
- Configure payer enrollment settings (portal credentials, FTP settings, follow-up cadences)
- Configure notification thresholds and templates
- Manage Azure Key Vault secret references (TOTP secrets, API keys)
- Access system-wide audit logs (all modules, all users)
- Configure bot schedules and retry settings
- View system health dashboard (bot queue status, integration health, error rates)
- Manage Azure Blob Storage container permissions

**Cannot**:
- Approve providers for committee (not a credentialing function)
- View PHI beyond what is necessary for system administration

---

## Permissions Matrix

The following table maps each module and key action to the roles that can perform it.

**Legend**: ✅ Full access | 👁 Read-only | 🔒 No access | ⚡ Own record only

### Module 1: Provider Onboarding

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View own application | ⚡ | ✅ | ✅ | 🔒 | 👁 |
| Edit own application | ⚡ | ✅ | ✅ | 🔒 | 🔒 |
| Upload documents | ⚡ | ✅ | ✅ | 🔒 | 🔒 |
| View checklist | ⚡ | ✅ | ✅ | 🔒 | 👁 |
| Manually flag checklist item | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Override checklist item | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Complete attestation | ⚡ | 🔒 | 🔒 | 🔒 | 🔒 |
| Send outreach email | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Resend account invite | 🔒 | ✅ | ✅ | 🔒 | 🔒 |

### Module 2: Onboarding Dashboard

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View pipeline (all providers) | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| View assigned providers only | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Create task | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Assign task to others | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Complete task | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Delete task | 🔒 | 🔒 | ✅ | 🔒 | ✅ |
| Send follow-up (email/SMS) | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Bulk send reminders | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Log phone call | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Add internal note | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| View communication history | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| View audit trail (per provider) | 🔒 | ✅ | ✅ | 🔒 | ✅ |
| View system-wide audit trail | 🔒 | 🔒 | ✅ | 🔒 | ✅ |
| Trigger PSV bot (manual) | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Acknowledge flagged bot result | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Move provider to committee queue (auto) | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Move provider to committee queue (manual override) | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |

### Module 3: Committee Dashboard

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View committee queue | 🔒 | 👁 | ✅ | 🔒 | 👁 |
| Create committee session | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Add/remove providers from session | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| View provider summary sheet | 🔒 | 👁 | ✅ | 👁 | 👁 |
| Send committee agenda | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| View committee agenda | 🔒 | 👁 | ✅ | 👁 | 👁 |
| Approve provider | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Deny/defer provider | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Add committee vote/comment | 🔒 | 🔒 | ✅ | ✅ | 🔒 |

### Module 4: Enrollments

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View enrollment records | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Create enrollment record | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Update enrollment status | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Log follow-up | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Generate roster file | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Trigger FTP submission (bot) | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Configure payer settings | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |
| View gap analysis | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Export enrollment report | 🔒 | ✅ | ✅ | 🔒 | ✅ |

### Module 5: Expirables Tracking

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View expirables list | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Update expiration date | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Trigger renewal bot | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Send provider outreach | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Configure alert thresholds | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |

### Module 6: Credentialing Bots (PSV)

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View bot run history | 🔒 | ✅ | ✅ | 🔒 | ✅ |
| Trigger bot run (manual) | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| View bot run output/PDF | 🔒 | ✅ | ✅ | 👁 | ✅ |
| Acknowledge flagged result | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Upload manual verification | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Configure bot schedules | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |

### Module 7: Sanctions Checking

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View sanctions check results | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Trigger on-demand sanctions check | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Acknowledge sanctions flag | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Configure check schedule | 🔒 | 🔒 | 🔒 | 🔒 | ✅ |

### Module 8: NY Medicaid / ETIN

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View Medicaid enrollment records | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Create/update Medicaid enrollment | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Trigger eMedNY bot submission | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Log provider signature received | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| View ETIN affiliation status | 🔒 | ✅ | ✅ | 🔒 | 👁 |

### Module 9: Hospital Privileges

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View privilege records | 🔒 | ✅ | ✅ | 🔒 | 👁 |
| Create privilege application | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Update privilege status | 🔒 | ✅ | ✅ | 🔒 | 🔒 |
| Upload appointment letter | 🔒 | ✅ | ✅ | 🔒 | 🔒 |

### Module 10: NPDB

| Action | Provider | Specialist | Manager | Committee Member | Admin |
|--------|----------|------------|---------|-----------------|-------|
| View NPDB query results | 🔒 | 🔒 | ✅ | 🔒 | 👁 |
| Trigger NPDB query | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Acknowledge adverse NPDB report | 🔒 | 🔒 | ✅ | 🔒 | 🔒 |
| Enroll in continuous query | 🔒 | 🔒 | ✅ | 🔒 | ✅ |

---

## Data Visibility Rules

### PHI (Protected Health Information) Handling

| Data Element | Provider | Specialist | Manager | Committee Member | Admin |
|-------------|----------|------------|---------|-----------------|-------|
| Full SSN | Own only | Masked (last 4) | Masked (last 4) | 🔒 | Masked (last 4) |
| Date of Birth | Own only | ✅ | ✅ | 🔒 | ✅ |
| Home Address | Own only | ✅ | ✅ | 🔒 | ✅ |
| Personal phone | Own only | ✅ | ✅ | 🔒 | ✅ |
| Attestation answers | Own only | ✅ | ✅ | 👁 (summary only) | 👁 |
| Malpractice history | Own only | ✅ | ✅ | 👁 (summary only) | 👁 |
| NPDB results | 🔒 | 🔒 | ✅ | 🔒 | 👁 |

**Notes**:
- SSN is stored encrypted at rest. Decryption only occurs in the application layer when required for bot operations (DEA, ABFM).
- NPDB results are highly sensitive — restricted to Credentialing Manager and Admin per NPDB data use agreement.
- Providers can only see their own record at all times. No cross-provider data is ever accessible to a Provider role.

### Record Scoping for Specialists

By default, Credentialing Specialists see all providers in the system. Admins can configure queue-based scoping so a Specialist only sees providers assigned to their queue or team. This is a system configuration option per the admin settings.

---

## User Management (Admin Functions)

### Creating a User Account

1. Admin creates the user record with name, email, and role.
2. For staff: the email must match an account in Essen's Azure AD tenant. The platform sends an Azure AD SSO invitation if the user does not yet have access.
3. For providers: an onboarding invitation is sent by a Specialist via the outreach workflow (not directly by Admin).

### Deactivating a User

- Deactivated users cannot log in.
- All records attributed to the user are retained.
- Open tasks assigned to a deactivated user are flagged for reassignment.
- Admin must reassign the deactivated user's active providers to another Specialist.

### Role Changes

- Role changes take effect immediately upon admin save.
- Role change is recorded in the audit trail.
- Downgrading a Manager to Specialist removes their access to committee approval actions immediately.

---

## Provider Type Configuration (Admin)

Provider types define which document checklist items are required, conditional, or not applicable. Admins manage this via a configuration table.

**Default provider types**:
- MD (Doctor of Medicine)
- DO (Doctor of Osteopathic Medicine)
- PA (Physician Assistant / Physician Associate)
- NP (Nurse Practitioner)
- LCSW (Licensed Clinical Social Worker)
- LMHC (Licensed Mental Health Counselor)

**Adding a new provider type**:
1. Admin creates the provider type (name, abbreviation).
2. Admin configures each document requirement as `required`, `conditional`, or `not_applicable` for the new type.
3. New type immediately available in provider records and application forms.

This design ensures the platform can be extended without code changes when new provider types are credentialed.
