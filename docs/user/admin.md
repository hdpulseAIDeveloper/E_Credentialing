# Administration

The **Administration** area is available to users with the Admin role. It controls platform-wide configuration.

## Users and roles

**Administration → Users** lists every user who can sign into the platform.

Available roles:

- **Admin** — full access including configuration
- **Manager** — supervisory access to records, can approve/override
- **Committee Chair** — runs committee meetings
- **Committee Member** — reviews agendas, votes on files
- **Specialist** — day-to-day credentialing work on assigned provider panel
- **Roster Manager** — manages roster generation and submission
- **Compliance Officer** — read-only access to all records, full access to compliance reporting
- **Billing** — read-only on enrollments and EFT/ERA data
- **Read-only** — reporting and dashboards only

A user can hold multiple roles. Roles are granted through Azure AD groups for staff — managing who is in which group is done in the Microsoft admin portal, which then syncs into the platform within 15 minutes.

## Provider types

**Administration → Provider Types** defines the provider types Essen credentials. Each type specifies:

- Abbreviation (MD, DO, PA, NP, LCSW, LMHC)
- Full name
- Default application sections (some types skip board certification, etc.)
- Default PSV bots
- Default recredentialing cadence

You can add new provider types as Essen expands into new disciplines.

## PSV configuration

**Administration → PSV Configuration** controls how bots run:

- Retry counts and backoff
- Timeout per bot
- Auto-flag rules (e.g., flag a DEA that expires in less than 60 days)
- Bot schedule overrides (weekly, monthly, on-demand)

Changes take effect on the next run.

## Committee settings

**Administration → Committee Settings**:

- Committee member roster (pulled from users)
- Default meeting cadence
- Quorum rules (e.g., minimum 3 members for an ad-hoc meeting)
- Agenda lockout time before meeting (default: 1 hour)
- Deferral reasons (customizable list)

## Payer configuration

**Administration → Payers**:

- Each payer: name, category (delegated / direct), portal, required fields, submission method
- Enrollment templates and roster CSV templates
- Integration credentials (stored in Azure Key Vault, never visible in the UI)

## Audit log

**Administration → Audit Log** — a live feed of every action across the platform. Searchable by user, entity, action type, date range.

The audit log is append-only and tamper-evident (HMAC chained). Database UPDATE and DELETE on audit rows are revoked at the database level — even an Admin cannot edit or remove an audit entry.

## Integrations

**Administration → Integrations**:

- iCIMS connection status and last sync time
- CAQH credentials (stored in Key Vault)
- Azure AD tenant and group mapping
- Outbound webhooks for downstream systems
- Public REST API key management
- FHIR endpoint configuration
- Analytics API toggle (for Tableau / Power BI)

## Feature flags

**Administration → Features** toggles modules on or off. Useful during rollout. All features are on by default.

## Data retention

**Administration → Retention**:

- Default retention (7 years after termination) per NCQA CVO standard
- Per-entity overrides (e.g., keep audit logs indefinitely)
- Hold markers (for legal holds that prevent purge)

Changes to retention are logged and require a reason.

## Branding

**Administration → Branding** — upload logo, set colors, email templates. Changes apply to the provider-facing UI and outgoing emails.
