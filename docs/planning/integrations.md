# ESSEN Credentialing Platform — External Integrations

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Draft — Pending stakeholder review

---

## Overview

The platform integrates with a range of external systems — some for data ingestion, some for enrollment submissions, and many for automated primary source verification (PSV). All credentials (API keys, TOTP secrets, FTP passwords, portal credentials) are stored in **Azure Key Vault** and never hardcoded or stored in the application database.

---

## Integration Inventory

| System | Category | Direction | Method | Auth |
|--------|----------|-----------|--------|------|
| iCIMS | HRIS | Inbound | REST API | OAuth 2.0 |
| CAQH | Provider Data | Inbound + Outbound | CAQH API (REST) | API Key |
| Azure AD | Auth | Inbound | OAuth 2.0 / OIDC | Azure tenant |
| Azure Blob Storage | File Storage | Outbound | Azure SDK / HTTPS | Azure RBAC + SAS |
| Azure Key Vault | Secret Management | Inbound | Azure SDK | Managed Identity |
| Azure Communication Services / Twilio | SMS | Outbound | REST API | API Key |
| SendGrid / SMTP | Email | Outbound | SMTP or REST API | API Key |
| healthguideusa.org | PSV — License | Outbound | Browser Bot (Playwright) | None required |
| DEA Diversion Control | PSV — DEA | Outbound | Browser Bot + TOTP | Username/Password + TOTP |
| NCCPA (portal.nccpa.net) | PSV — Boards (PA) | Outbound | Browser Bot | None required |
| ABIM (abim.org) | PSV — Boards (MD/IM) | Outbound | Browser Bot | None required |
| ABFM (portfolio.theabfm.org) | PSV — Boards (MD/FM) | Outbound | Browser Bot | None required |
| OIG LEIE | Sanctions | Outbound | API or Bot | None (public) |
| SAM.gov | Sanctions | Outbound | REST API | API Key |
| NPDB HIQA | NPDB | Outbound | REST API (HIQA) | Username/Password + entity credentials |
| eMedNY | NY Medicaid | Outbound | Browser Bot | Username/Password |
| My Practice Profile (UHC/UBH) | Enrollment | Outbound | Browser Bot | Username/Password |
| Availity | Enrollment | Outbound | Browser Bot | Username/Password |
| Verity | Enrollment | Outbound | Browser Bot | Username/Password |
| EyeMed portal | Enrollment | Outbound | Browser Bot | Username/Password |
| VNS online form | Enrollment | Outbound | Browser Bot | None required |
| FTP sites (payers) | Enrollment | Outbound | SFTP client | Username/Password + key |
| Email (payer submissions) | Enrollment | Outbound | SMTP | Same as outbound email |

---

## Integration Details

---

### 1. iCIMS (HRIS)

**Purpose**: Ingest provider demographic data at the start of onboarding. When a provider is hired in Essen's iCIMS system, their data pre-populates the credentialing application.

**Direction**: Inbound (iCIMS → Platform)

**Trigger**:
- Event-driven: iCIMS webhook fires when a candidate/employee status changes to a credentialing-eligible state (e.g., "Offer Accepted," "Hire").
- Fallback: Manual iCIMS ID entry by staff, triggering a one-time data pull via REST API.

**Data fetched from iCIMS**:
| iCIMS Field | Platform Field |
|-------------|----------------|
| `firstName` | `Provider.legal_first_name` |
| `lastName` | `Provider.legal_last_name` |
| `emailAddress` | `ProviderProfile.personal_email` |
| `phone` | `ProviderProfile.mobile_phone` |
| `dateOfBirth` | `Provider.date_of_birth` |
| `ssn` | `Provider.ssn` (encrypted) |
| `address.*` | `ProviderProfile.home_address_*` |
| `jobTitle` | `ProviderProfile.job_title` |
| `department` | `ProviderProfile.department` |
| `startDate` | `ProviderProfile.start_date` |
| `hireDate` | `ProviderProfile.hire_date` |
| `location` | `ProviderProfile.facility_assignment` |
| `requisitionId` | mapped to `Provider.icims_id` |

**Authentication**: OAuth 2.0 client credentials flow. Client ID and secret stored in Azure Key Vault.

**API endpoint**: `https://api.icims.com/customers/{customerid}/applicantworkflows` (REST)

**Error handling**:
- If iCIMS API returns 4xx/5xx, the ingestion is skipped and the provider is flagged for manual data entry.
- iCIMS API errors are logged to the application error log.
- If the iCIMS ID is not found, staff is notified via dashboard alert.

**Data conflicts**: iCIMS data is treated as a starting point. Provider can override any field during application completion.

---

### 2. CAQH (Council for Affordable Quality Healthcare)

**Purpose**:
- **Ingest** (onboarding): Pull provider demographics and credential data when a provider provides their CAQH ID.
- **Update** (enrollment): Push updated practice information (days/hours, locations, schedule) back to CAQH as part of Direct Enrollment.

**Direction**: Inbound (CAQH → Platform) for ingestion; Outbound (Platform → CAQH) for updates.

**Authentication**: CAQH Universal Provider DataSource (UPDS) API — requires API key and organization credentials. Stored in Azure Key Vault.

**Ingest flow**:
1. Provider provides CAQH ID during onboarding.
2. Platform calls CAQH API: `GET /provider/{caqhId}`
3. Response mapped to `ProviderProfile`, `License`, and `Document` records.
4. Raw response snapshot stored in `ProviderProfile.caqh_data_snapshot` (JSON).

**Data ingested from CAQH**:
- Demographics: name, DOB, NPI, DEA, license(s)
- Board certifications
- Work history
- Malpractice insurance
- Practice locations and hours
- Education/training

**Update flow** (Direct Enrollment — CAQH):
1. Staff initiates CAQH update from the Enrollments module.
2. Platform calls CAQH API: `PUT /provider/{caqhId}` with updated fields (hours, locations, schedule).
3. CAQH API confirms update.
4. Enrollment record updated with submission date and confirmation.

**Error handling**:
- If CAQH API is unavailable during ingestion, system retries once after 5 minutes, then skips and flags for manual completion.
- CAQH API update failures are logged and flagged on the enrollment record.
- Invalid CAQH ID (provider not found) triggers a clear user-facing message to the provider.

---

### 3. Azure Active Directory (Azure AD)

**Purpose**: Single Sign-On (SSO) authentication for all internal Essen staff users.

**Direction**: Inbound (Azure AD → Platform validates tokens)

**Protocol**: OAuth 2.0 Authorization Code Flow with PKCE + OpenID Connect (OIDC)

**Flow**:
1. Staff user navigates to platform.
2. Platform redirects to Azure AD login.
3. User authenticates with Essen credentials (MFA enforced by Azure AD policy).
4. Azure AD issues ID token and access token.
5. Platform validates token signature against Azure AD JWKS endpoint.
6. Platform creates or updates the `User` record (matched on `azure_ad_oid`).
7. Role is looked up from the platform's own `User` table (not from Azure AD groups — role management is internal).

**Configuration**:
- Azure AD Tenant ID: Essen's Azure AD tenant
- Application (client) ID: Registered app in Azure AD
- Redirect URI: Platform's callback URL
- Scopes: `openid`, `profile`, `email`

**Error handling**:
- If Azure AD is unavailable, no staff logins are possible (no fallback — SSO is the only auth method for staff).
- Token validation failures redirect to login page with a generic error.
- Users not found in the platform's `User` table (not yet provisioned) see a "Contact your administrator" message.

---

### 4. Azure Blob Storage

**Purpose**: Store all documents, PSV verification PDFs, committee agendas, summary sheets, and bot output files. Replaces the legacy K: drive PCD folder system.

**Direction**: Outbound (Platform reads and writes to Azure Blob)

**Container Structure**:
```
essen-credentialing/
  providers/
    {provider-uuid}/
      documents/          # Provider-uploaded credential documents
        {document-id}.pdf
      verifications/      # Bot-generated PSV PDFs
        {verification-id}_{filename}.pdf
      summaries/          # Committee summary sheets (per version)
        summary_v{n}.pdf
      committee/          # Committee agenda PDFs
        (linked at session level)
      enrollment/         # Roster files and enrollment submissions
        {enrollment-id}_{filename}.csv
  committee/
    sessions/
      {session-id}/
        agenda_v{n}.pdf
  system/
    bot-logs/             # Bot execution logs for debugging
```

**Authentication**: Platform service uses Azure Managed Identity for authentication. No storage account keys are used. SAS tokens (short-lived, read-only) are generated on-demand for staff to download files via the UI.

**Access control**:
- Application Managed Identity: read + write to `essen-credentialing` container.
- Staff download links: pre-signed SAS URLs (1-hour expiry).
- No public access to any blob container.

**File naming conventions** (preserved from K: drive legacy):
- License: `{State} License Verification, Exp. MM.DD.YYYY.pdf`
- DEA: `DEA Verification, Exp. MM.DD.YYYY.pdf`
- Boards (PA): `Boards Verification NCCPA exp MM.DD.YYYY.pdf`
- Boards (IM): `Boards Verification ABIM exp MM.DD.YYYY.pdf`
- Boards (FM): `Boards Verification ABFM exp MM.DD.YYYY.pdf`
- Sanctions OIG: `OIG Sanctions Check MM.DD.YYYY.pdf`
- Sanctions SAM: `SAM Sanctions Check MM.DD.YYYY.pdf`
- NPDB: `NPDB Query MM.DD.YYYY.pdf`

---

### 5. Azure Key Vault

**Purpose**: Securely store all secrets, API keys, passwords, and TOTP secrets used by the platform and bots.

**Direction**: Inbound (Platform reads secrets from Key Vault at runtime)

**Secrets stored**:
| Secret Name | Contents |
|-------------|----------|
| `icims-client-id` | iCIMS API OAuth client ID |
| `icims-client-secret` | iCIMS API OAuth client secret |
| `caqh-api-key` | CAQH API key |
| `caqh-org-credentials` | CAQH organization username/password |
| `dea-username` | DEA Diversion Control portal username |
| `dea-password` | DEA Diversion Control portal password |
| `dea-totp-secret` | TOTP shared secret for DEA MFA automation |
| `npdb-username` | NPDB HIQA portal username |
| `npdb-password` | NPDB HIQA portal password |
| `npdb-entity-id` | Essen's NPDB entity ID |
| `sam-api-key` | SAM.gov API key |
| `emedral-username` | eMedNY portal username |
| `emedral-password` | eMedNY portal password |
| `mpp-username` | My Practice Profile (UHC) username |
| `mpp-password` | My Practice Profile (UHC) password |
| `availity-username` | Availity portal username |
| `availity-password` | Availity portal password |
| `verity-username` | Verity (Archcare) portal username |
| `verity-password` | Verity (Archcare) portal password |
| `eyemed-username` | EyeMed portal username |
| `eyemed-password` | EyeMed portal password |
| `ftp-{payer}-host` | FTP host per payer |
| `ftp-{payer}-username` | FTP username per payer |
| `ftp-{payer}-password` | FTP password per payer |
| `sendgrid-api-key` | Email delivery API key |
| `sms-api-key` | SMS service API key |
| `db-connection-string` | Application database connection string |
| `blob-connection-string` | Azure Blob Storage connection (fallback only) |

**Access**: Platform service authenticates to Key Vault using Azure Managed Identity (no secret needed to access Key Vault). No secrets are stored in application config files or environment variables.

---

### 6. Email (SendGrid / SMTP)

**Purpose**: Send all outbound emails — provider outreach, follow-up reminders, committee agendas, staff notifications.

**Direction**: Outbound

**From addresses**:
- `cred_onboarding@essenmed.com` — provider outreach and follow-up
- `cred_committee@essenmed.com` — committee agenda distribution
- `cred_noreply@essenmed.com` — system notifications

**Email types sent**:
| Type | Trigger | Template |
|------|---------|----------|
| Outreach invitation | Staff sends invite | `provider_invite` |
| Follow-up reminder | Staff clicks Send Reminder or automated | `follow_up_{type}` |
| Committee agenda | Manager sends agenda | `committee_agenda` |
| Task notification | Task assigned to user | `task_assigned` |
| Bot failure alert | Bot fails after 3 retries | `bot_failure` |
| Expirable alert | Expirable approaching expiry | `expirable_alert_{threshold}` |
| Enrollment follow-up | Follow-up cadence due | `enrollment_followup` |
| Sanctions flag | Sanctions check returns flagged | `sanctions_flagged` |
| NPDB adverse report | NPDB continuous query alert | `npdb_adverse` |

**Template system**: Email templates are stored in the platform (configurable by Admin). They support variable substitution (e.g., `{{provider_name}}`, `{{document_list}}`).

**Delivery tracking**: Webhook-based delivery events from SendGrid (delivered, bounced, opened) are recorded in the `Communication` table.

---

### 7. SMS (Azure Communication Services or Twilio)

**Purpose**: Send short follow-up reminders and alerts to providers' mobile phones.

**Direction**: Outbound

**Use cases**:
- Follow-up reminder: "Hi {name}, your Essen credentialing application has missing documents. Please log in at {url}."
- Expirable alert: "Hi {name}, your {credential} expires on {date}. Please contact {email} to renew."

**Business rules**:
- SMS only sent if provider has a mobile phone on file and has not opted out.
- SMS messages capped at 160 characters for SMS; longer messages sent as MMS.
- Opt-out: if provider replies STOP, the system marks `sms_opt_out = true` and no further SMS are sent.
- SMS delivery status is tracked and recorded in `Communication`.

---

### 8. healthguideusa.org — License Verification Bot

**Purpose**: Verify state medical licenses from primary source.

**Method**: Playwright browser bot (no API available — web scraping)

**Target URL**: `https://www.healthguideusa.org/medical_license_lookup.htm`

**No login required**.

**Input data required**: State, license number, profession/provider type

**Bot actions**:
1. Navigate to site
2. Select state (click state link)
3. Set dropdown "Search By" = License Number
4. Set dropdown "Profession" = based on provider type mapping
5. Enter license number
6. Click GO
7. Click on the license number in results
8. Take screenshot of pop-up window
9. Download PDF with timestamp
10. Extract: license state, status, expiration date ("Registered through Date")
11. Save PDF to Azure Blob Storage
12. Create `VerificationRecord`
13. Update `ChecklistItem` status

**Output file**: `{State} License Verification, Exp. MM.DD.YYYY.pdf`

See [credentialing-bots.md](credentialing-bots.md) for full step-by-step specification.

---

### 9. DEA Diversion Control Division — DEA Verification Bot

**Purpose**: Verify DEA registrations from primary source.

**Method**: Playwright browser bot with TOTP-based MFA automation

**Authentication**: Username + password + TOTP (stored in Azure Key Vault)

**TOTP implementation**:
- DEA uses TOTP-based MFA (compatible with Google Authenticator / Microsoft Authenticator)
- The TOTP shared secret (obtained when registering the MFA device) is stored in Azure Key Vault as `dea-totp-secret`
- Bot retrieves the secret from Key Vault and uses an RFC 6238-compliant TOTP library to generate the current 6-digit code
- Bot inputs the TOTP code when prompted during login

**Session management**:
- Bot maintains a persistent authenticated session where possible to minimize MFA triggers.
- If session expires, bot re-authenticates using stored credentials + TOTP.

**Input data**: DEA number, provider name

**Output file**: `DEA Verification, Exp. MM.DD.YYYY.pdf`

See [credentialing-bots.md](credentialing-bots.md) for full specification.

---

### 10. NCCPA — PA Board Verification Bot

**Purpose**: Verify Physician Assistant board certification via NCCPA.

**Target URL**: `https://portal.nccpa.net/verifypa`

**No login required** for verification. Email delivery used for PDF.

**Input**: First name, last name, state, country

**Bot actions**:
1. Navigate to site
2. Enter first name, last name, state, country
3. Click "Verify Board Certification"
4. Click "Email Document"
5. Enter: Organization = "Essen Health Care", Full Name, Email = `cred_onboarding@essenmed.com`
6. Wait for email delivery (poll inbox or webhook)
7. Download PDF from email
8. Save to Azure Blob Storage
9. Create `VerificationRecord`

**Output file**: `Boards Verification NCCPA exp MM.DD.YYYY.pdf`

---

### 11. ABIM — Internal Medicine Board Verification Bot

**Purpose**: Verify board certification for internal medicine physicians and subspecialists.

**Target URL**: `https://www.abim.org/verify-physician/`

**No login required**.

**Input**: NPI number

**Bot actions**:
1. Navigate to site
2. Select "Search by NPI"
3. Enter NPI number
4. Click Search
5. Take full-page screenshot (must include website URL and date/timestamp visible)
6. Save as PDF
7. Save to Azure Blob Storage

**Output file**: `Boards Verification ABIM exp MM.DD.YYYY.pdf`

---

### 12. ABFM — Family Medicine Board Verification Bot

**Purpose**: Verify board certification for family medicine physicians.

**Target URL**: `https://portfolio.theabfm.org/diplomate/verify.aspx`

**No login required** for public verification.

**Input**: First name, last name, SSN last 4 digits, date of birth

**Security note**: SSN last 4 is decrypted from the application database only in memory for this operation. It is never logged or stored in plaintext outside the encrypted database field.

**Bot actions**:
1. Navigate to site
2. Enter first name, last name, SSN last 4, DOB
3. Click Verify
4. Take full-page screenshot
5. Click "View/Print Verification Letter Online"
6. Download verification letter PDF
7. Save to Azure Blob Storage

**Output file**: `Boards Verification ABFM exp MM.DD.YYYY.pdf`

---

### 13. OIG LEIE — Sanctions Check

**Purpose**: Check whether a provider is excluded from participation in federal healthcare programs.

**Source**: HHS Office of Inspector General — List of Excluded Individuals/Entities (LEIE)

**Method**: OIG provides a downloadable exclusions database (updated monthly) and a real-time online search. Platform approach:
- Download and cache the monthly LEIE database update locally/in storage.
- Run queries against the local cache for performance.
- For on-demand checks, also query the OIG online portal directly.

**OIG online search URL**: `https://exclusions.oig.hhs.gov/`

**Match criteria**: NPI (primary), then full name + DOB, then full name + address

**Output**: JSON result with match status and exclusion details. Screenshot/PDF of OIG search results page.

---

### 14. SAM.gov — Sanctions Check

**Purpose**: Check federal debarment/suspension status.

**Method**: SAM.gov REST API (public, requires API key)

**API**: `GET https://api.sam.gov/entity-information/v3/entities?api_key={key}&ueiDUNS={npi}&...`

**Authentication**: API key stored in Azure Key Vault as `sam-api-key`

**Match criteria**: NPI, legal name, or SSN

**Output**: JSON response with exclusion status and details. Stored in `SanctionsCheck` record.

---

### 15. NPDB HIQA — NPDB Queries

**Purpose**: Query the National Practitioner Data Bank for malpractice and adverse action reports.

**Method**: NPDB Healthcare Integrity and Protection Data Bank (HIQA) web service

**Authentication**: Essen's NPDB entity account (username, password, entity ID). All stored in Azure Key Vault.

**Data submitted per query**:
- Provider name (first, last)
- DOB
- SSN (last 4 or full, per NPDB requirements)
- NPI
- License number(s) and state(s)

**Query types**:
- Initial one-time query: submitted during credentialing workflow
- Continuous query enrollment: ongoing monitoring subscription

**Output**: NPDB-formatted report PDF. Structured response stored in `NPDBRecord`.

**Legal/compliance note**: NPDB results are confidential under 45 CFR Part 60. Access restricted to Credentialing Managers and Admins within the platform.

---

### 16. eMedNY — NY Medicaid Enrollment Bot

**Purpose**: Submit NY Medicaid enrollment applications and manage ETIN affiliations via the eMedNY portal.

**Target**: eMedNY Service Portal and ETIN Affiliation Portal

**Authentication**: Essen eMedNY account (username/password stored in Azure Key Vault)

**Bot actions vary** based on enrollment scenario (new affiliation vs. maintenance). See [credentialing-bots.md](credentialing-bots.md) and [scope.md — Module 8](scope.md) for full workflow.

---

### 17–20. Enrollment Portal Bots (My Practice Profile, Availity, Verity, EyeMed)

These bots automate provider enrollment submissions to payer portals.

**Common pattern for all portal bots**:
1. Retrieve portal credentials from Azure Key Vault
2. Log into the portal via Playwright
3. Navigate to the enrollment/submission section
4. Fill in provider details from the platform's data
5. Upload required documents (if applicable)
6. Submit the form
7. Capture confirmation number or screenshot
8. Log out
9. Update `Enrollment` record with status, confirmation, and submitted date

| Portal | Payers | Key Vault Secret |
|--------|--------|-----------------|
| My Practice Profile | UHC, UHC/UBH Optum | `mpp-username`, `mpp-password` |
| Availity | Anthem, Carelon | `availity-username`, `availity-password` |
| Verity | Archcare | `verity-username`, `verity-password` |
| EyeMed | EyeMed | `eyemed-username`, `eyemed-password` |
| VNS online form | VNS | No login required |

---

### 21. FTP Sites — Payer Enrollment Submissions

**Purpose**: Upload roster/enrollment files to payer FTP servers for payers that don't have portal submission.

**Method**: SFTP client (platform-side)

**Payers using FTP**: MetroPlus (via email roster), other delegated payers, Humana, Centerlight

**Flow**:
1. Platform generates roster file (CSV or payer-specific format)
2. SFTP client connects to payer FTP using credentials from Azure Key Vault
3. Roster file uploaded to designated directory on payer FTP
4. Confirmation logged in `Enrollment` record
5. Platform sends follow-up email to payer (from `cred_onboarding@essenmed.com`) with FTP username/password confirmation

**FTP credentials**: Per-payer credentials stored in Azure Key Vault as `ftp-{payername}-host`, `ftp-{payername}-username`, `ftp-{payername}-password`.

---

## Integration Health Monitoring

The Admin dashboard includes an integration health panel showing:
- Last successful call per integration
- Error rate (last 24 hours, 7 days)
- Bot queue depth and average wait time
- Azure Blob Storage usage
- Credential expiry alerts (Key Vault secrets approaching rotation date)

Alerts are sent to System Admins when:
- Any external API returns consecutive errors for 30+ minutes
- Bot queue depth exceeds configurable threshold
- A Key Vault secret is within 30 days of its expiry (recommendation to rotate)
