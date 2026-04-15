# ESSEN Credentialing Platform — Credentialing Bots (PSV Automation)

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Draft — Pending stakeholder review and additional workflows from Essen team

---

## Overview

Credentialing bots are automated browser scripts (Playwright) that perform Primary Source Verifications (PSVs) — the process of verifying a provider's credentials directly from the issuing authority without manual staff intervention.

**Technology**: Playwright (headless Chromium). Runs in a background job queue (technology TBD — Azure Service Bus, BullMQ, or Celery).

**Shared behavior for all bots**:
- All bots log into target systems using credentials retrieved from **Azure Key Vault** at runtime.
- All bots produce: a PDF or screenshot saved to **Azure Blob Storage**, a `VerificationRecord` database entry, and a `BotRun` log.
- All bots retry up to **3 times** with exponential backoff on failure.
- After 3 failures, the bot is marked `failed`, the error log is saved to Azure Blob, and the assigned Specialist is alerted.
- All bot run actions are recorded in the **AuditLog**.
- Bots run **headless** in production; headed mode available for debugging.

**Output file naming convention** (all dates in MM.DD.YYYY format):
```
{State} License Verification, Exp. MM.DD.YYYY.pdf
DEA Verification, Exp. MM.DD.YYYY.pdf
Boards Verification NCCPA exp MM.DD.YYYY.pdf
Boards Verification ABIM exp MM.DD.YYYY.pdf
Boards Verification ABFM exp MM.DD.YYYY.pdf
Boards Verification {Board Name} exp MM.DD.YYYY.pdf
OIG Sanctions Check MM.DD.YYYY.pdf
SAM Sanctions Check MM.DD.YYYY.pdf
NPDB Query MM.DD.YYYY.pdf
Hospital Privilege Verification {Facility} MM.DD.YYYY.pdf
CAQH Attestation Verification MM.DD.YYYY.pdf
```

---

## Bot 1: State License Verification

**Credential verified**: State medical license (valid for all 50 states + DC)

**Trigger**:
- Automatic: When license number and state are entered in the provider's application
- Manual: Specialist triggers from the provider's verification dashboard

**Required input data**:
- Provider's first and last name
- License number
- License state (2-letter abbreviation)
- Provider type / profession (for dropdown selection)

**Source**: `https://www.healthguideusa.org/medical_license_lookup.htm`

**Authentication**: None required

**Step-by-step bot actions**:

1. Navigate to `https://www.healthguideusa.org/medical_license_lookup.htm`
2. Locate and click the link for the provider's license state (e.g., "New York")
3. On the state-specific page, locate the search dropdowns:
   - Set "Search By" dropdown to: `License Number`
   - Set "Profession" dropdown to: mapped value based on `ProviderType` (see profession mapping table below)
4. Enter the license number in the text field
5. Click the "GO" or "Search" button
6. Wait for results to load
7. Locate the license number in the results table and click on it
8. Wait for the details pop-up or details page to load
9. Take a full-page screenshot (include the URL bar and system date/time visible in screenshot)
10. If the page supports PDF download: click "Download PDF" or "Print" → save as PDF
11. If no PDF download: convert the screenshot to PDF
12. Add a timestamp overlay to the PDF (date + time of verification)
13. Save PDF to Azure Blob Storage at:
    `/providers/{provider-id}/verifications/{State} License Verification, Exp. MM.DD.YYYY.pdf`
14. Extract the following data from the page:
    - License state
    - License status (e.g., Active, Expired, Suspended, Revoked)
    - Expiration date / "Registered through" date
    - License number (confirm matches input)
15. Create `VerificationRecord`:
    - `credential_type` = `license`
    - `status` = mapped from license status (active → `verified`, expired → `flagged`, suspended/revoked → `flagged`)
    - `expiration_date` = extracted expiration date
    - `result_details` = `{ state, license_number, license_status, registered_through_date }`
16. Update `ChecklistItem` for `original_license` → `received` (if verified) or `needs_attention` (if flagged)
17. Update `License` record: confirm status and expiration date
18. If status is anything other than `Active`: mark `VerificationRecord.is_flagged = true`

**Profession mapping table** (healthguideusa.org dropdown values):

| ProviderType | healthguideusa.org "Profession" Value |
|-------------|---------------------------------------|
| MD | Physician |
| DO | Osteopathic Physician |
| PA | Physician Assistant |
| NP | Nurse Practitioner |
| LCSW | Licensed Clinical Social Worker |
| LMHC | Licensed Mental Health Counselor |
| [New type] | To be added when provider type is configured |

**Edge cases**:
- If the state board site is unavailable or returns no results: mark BotRun as failed, retry.
- If the license is found but shows as expired: mark VerificationRecord as `flagged`, alert Specialist.
- If multiple licenses exist for the provider (different states): a separate BotRun is created per license.
- If the state board has changed its URL structure: bot is flagged as failed; Admin must update the bot configuration.

**Checklist fields updated**:
- License state
- Status
- Date verified
- Expiration date (Registered Through Date)

---

## Bot 2: DEA Registration Verification

**Credential verified**: DEA (Drug Enforcement Administration) registration

**Trigger**:
- Automatic: When DEA number is available in the provider's profile and contract is signed
- Manual: Specialist triggers from provider's verification dashboard

**Required input data**:
- DEA number
- Provider's full legal name
- DEA portal username and password (from Azure Key Vault: `dea-username`, `dea-password`)
- TOTP shared secret (from Azure Key Vault: `dea-totp-secret`)

**Source**: DEA Diversion Control Division registrant portal (URL TBD — specific portal URL to be confirmed)

**Authentication**: Username + password + TOTP (Time-based One-Time Password)

**TOTP implementation**:
- Retrieve `dea-totp-secret` from Azure Key Vault at bot startup
- Use an RFC 6238-compliant TOTP library (e.g., `otplib` for Node.js, `pyotp` for Python) to generate the current 6-digit code
- The TOTP code is valid for 30 seconds; bot must submit within the validity window
- If the code is rejected (timing issue), regenerate and retry once before escalating

**Session management**:
- Bot stores the authenticated browser session (cookies) after first login
- On subsequent runs, the bot attempts to reuse the session
- If session is expired, re-authenticate from scratch with credentials + TOTP

**Step-by-step bot actions**:

1. Navigate to DEA Diversion Control registrant portal
2. Enter username (from Key Vault)
3. Enter password (from Key Vault)
4. Click Login / Submit
5. When MFA prompt appears, generate TOTP code using stored secret
6. Enter TOTP code in MFA field
7. Click Verify / Submit
8. Navigate to DEA registration lookup / verification section
9. Enter DEA number
10. Submit search
11. Locate the provider's registration in results
12. Take full-page screenshot (include URL bar, date, and timestamp)
13. Download or print registration details as PDF
14. Add timestamp overlay to PDF
15. Save PDF to Azure Blob Storage:
    `/providers/{provider-id}/verifications/DEA Verification, Exp. MM.DD.YYYY.pdf`
16. Extract:
    - DEA number (confirm)
    - Registration status (Active, Expired, Revoked, etc.)
    - Schedules authorized
    - Expiration date
17. Create `VerificationRecord`:
    - `credential_type` = `dea`
    - `status` = `verified` if Active, `flagged` otherwise
    - `expiration_date` = extracted expiration
    - `result_details` = `{ dea_number, registration_status, schedules, expiration_date }`
18. Update `ChecklistItem` for `dea_certificate` and provider's `dea_number` field
19. If status is not Active: set `is_flagged = true`, alert Specialist

**Edge cases**:
- MFA code rejected: retry TOTP generation once. If fails again, mark BotRun as failed.
- DEA number not found in results: mark `VerificationRecord.status = not_found`, flag for Specialist.
- DEA is revoked or surrendered: hard flag — alert Credentialing Manager immediately.
- Session cookie expiry during bot run: re-authenticate and resume.

**Note**: Full DEA portal URL and page structure to be confirmed once Essen's DEA portal access is verified. Bot implementation may need adjustment based on actual portal structure.

---

## Bot 3: Board Certification Verification — PA (NCCPA)

**Credential verified**: Physician Assistant board certification

**Applicable provider types**: PA

**Trigger**:
- Automatic: When provider type = PA and application is submitted
- Manual: Specialist triggers from dashboard

**Required input data**:
- Provider first name, last name
- State (of practice or board registration)
- Country (default: United States)
- Essen email for delivery: `cred_onboarding@essenmed.com`

**Source**: `https://portal.nccpa.net/verifypa`

**Authentication**: None required for verification; uses email delivery

**Step-by-step bot actions**:

1. Navigate to `https://portal.nccpa.net/verifypa`
2. Enter: First Name, Last Name, State, Country
3. Click "Verify Board Certification"
4. On the results page, click "Email Document"
5. In the email form, enter:
   - Name of Organization: `Essen Health Care`
   - Full Name: (Essen credentialing staff name — configurable)
   - Email: `cred_onboarding@essenmed.com`
6. Click Submit / Send
7. Monitor inbox at `cred_onboarding@essenmed.com` for incoming email from NCCPA (poll every 30 seconds, timeout 10 minutes)
8. When email arrives, download the attached PDF
9. Add timestamp metadata to the file name
10. Save PDF to Azure Blob Storage:
    `/providers/{provider-id}/verifications/Boards Verification NCCPA exp MM.DD.YYYY.pdf`
11. Extract from PDF:
    - NCCPA ID number
    - Certification status (Certified, Not Certified, Expired)
    - Expiration date ("valid until")
12. Create `VerificationRecord`:
    - `credential_type` = `board_nccpa`
    - `status` = `verified` if Certified, `flagged` otherwise
    - `expiration_date` = extracted date
    - `result_details` = `{ nccpa_id, status, valid_until }`
13. Update `ChecklistItem` for `board_certification`
14. Flag if not Certified or expired

**Checklist fields updated**:
- NCCPA ID #
- Certification status
- Date verified
- Expiration date ("valid until")

**Edge cases**:
- Provider not found by name: bot retries with name variations (e.g., middle name included/excluded). If still not found, flag for Specialist to verify name accuracy.
- Email not received within 10 minutes: mark BotRun as failed, retry. If 3rd failure, Specialist manually requests verification.
- Duplicate names: bot selects the match with correct state. If ambiguous, flag for Specialist.

---

## Bot 4: Board Certification Verification — MD Internal Medicine (ABIM)

**Credential verified**: Board certification in Internal Medicine and subspecialties

**Applicable provider types**: MD, DO with specialty = Internal Medicine, Cardiology, Endocrinology, Gastroenterology, Nephrology, Rheumatology, Hematology/Oncology, Infectious Disease, Pulmonology/Critical Care, Geriatrics, or other ABIM-certified subspecialties

**Trigger**:
- Automatic: When provider type = MD/DO and specialty matches ABIM-covered list
- Manual: Specialist triggers from dashboard

**Required input data**:
- NPI number

**Source**: `https://www.abim.org/verify-physician/`

**Authentication**: None required

**Step-by-step bot actions**:

1. Navigate to `https://www.abim.org/verify-physician/`
2. Select search method: "Search by NPI"
3. Enter NPI number
4. Click "Search"
5. Wait for results page to load
6. Verify the result matches the provider's name (cross-check against provider record)
7. Take a **full-page screenshot** — must capture:
   - The full ABIM.org URL visible in the browser address bar
   - The current date and time (system clock or page date)
   - All certification details visible on the page
8. Convert screenshot to PDF format
9. Add timestamp overlay
10. Save PDF to Azure Blob Storage:
    `/providers/{provider-id}/verifications/Boards Verification ABIM exp MM.DD.YYYY.pdf`
11. Extract:
    - ABIM ID number
    - Certification(s) and subspecialties
    - Status (Board Certified, Not Certified, Certified with Expired MOC)
    - Expiration date (if applicable)
12. Create `VerificationRecord`:
    - `credential_type` = `board_abim`
    - `status` = `verified` if Board Certified, `flagged` otherwise
    - `expiration_date` = extracted date
    - `result_details` = `{ abim_id, certifications, status, expiration_date }`
13. Update `ChecklistItem` for `board_certification`
14. Flag if not currently certified

**Checklist fields updated**:
- ABIM ID #
- Certification status
- Date verified
- Expiration/MOC date

**Edge cases**:
- NPI not found: flag for Specialist. Possible data entry error in NPI field.
- Multiple certifications listed: capture all. Store as array in `result_details`.
- MOC (Maintenance of Certification) expired but certification listed as active: note in result_details, do not flag unless policy dictates.

---

## Bot 5: Board Certification Verification — MD Family Medicine (ABFM)

**Credential verified**: Board certification in Family Medicine

**Applicable provider types**: MD, DO with specialty = Family Medicine

**Trigger**:
- Automatic: When provider type = MD/DO and specialty = Family Medicine
- Manual: Specialist triggers from dashboard

**Required input data**:
- Provider first name, last name
- SSN last 4 digits (decrypted in-memory from encrypted database field)
- Date of birth (MM/DD/YYYY)

**Source**: `https://portfolio.theabfm.org/diplomate/verify.aspx`

**Authentication**: None required — uses SSN last 4 + DOB for lookup (not a login)

**Security handling for SSN**:
- The bot retrieves the encrypted SSN from the database and decrypts it in application memory.
- Only the last 4 digits are extracted and passed to the bot.
- The last 4 digits are held in memory only for the duration of the bot run.
- They are **never logged** (bot log redacts SSN fields), **never stored** in plaintext in any file or database field other than the encrypted `Provider.ssn` column.

**Step-by-step bot actions**:

1. Navigate to `https://portfolio.theabfm.org/diplomate/verify.aspx`
2. Enter: First Name
3. Enter: Last Name
4. Enter: Social Security Number last 4 digits (from memory — not logged)
5. Enter: Date of Birth (MM/DD/YYYY format)
6. Click "Verify"
7. Wait for verification results to load
8. Take a full-page screenshot:
   - Must capture URL bar, date/time, and full results
9. Click "View/Print Verification Letter Online"
10. Wait for the verification letter to load as a separate PDF/printable page
11. Download/save the verification letter as PDF
12. Save both: screenshot and verification letter PDF to Azure Blob Storage:
    `/providers/{provider-id}/verifications/Boards Verification ABFM exp MM.DD.YYYY.pdf`
13. Extract:
    - ABFM Certification number
    - Certification status (Active, Inactive, Not Certified)
    - Valid/expiration date
14. Create `VerificationRecord`:
    - `credential_type` = `board_abfm`
    - `status` = `verified` if Active, `flagged` otherwise
    - `expiration_date` = extracted date
    - `result_details` = `{ abfm_cert_number, status, valid_date }` (no SSN in result_details)
15. Update `ChecklistItem` for `board_certification`
16. Clear SSN from memory after bot run completes

**Checklist fields updated**:
- ABFM Certification #
- Status
- Date verified

**Edge cases**:
- Provider not found (name/SSN/DOB mismatch): bot returns `not_found`. Flag for Specialist to verify data accuracy.
- ABFM site down: retry 3 times, then flag as failed.
- SSN decryption failure: abort bot run immediately, log error (without SSN), alert Admin.

---

## Bot 6: Sanctions Check — OIG Exclusion List

**Credential verified**: OIG LEIE (List of Excluded Individuals/Entities) status

**Applicable**: All providers — run at initial credentialing and monthly thereafter

**Source**: `https://exclusions.oig.hhs.gov/` (online search) + monthly LEIE database download

**Authentication**: None required (public data)

**Primary approach — Database query**:
1. System downloads the current OIG LEIE exclusions list (updated monthly, available at exclusions.oig.hhs.gov as CSV/Excel)
2. Downloaded list is stored locally/in Azure Blob as a reference dataset
3. For each provider check: query the local dataset by NPI (primary), then by name + DOB
4. Record result

**Secondary approach — Online verification (on-demand)**:
1. Navigate to `https://exclusions.oig.hhs.gov/`
2. Enter: First Name, Last Name, NPI (and optionally SSN)
3. Click Search
4. Capture full-page screenshot of results
5. Save to Azure Blob as: `OIG Sanctions Check MM.DD.YYYY.pdf`

**Match logic**:
- Primary match: NPI exact match
- Secondary match: Last name + First name + DOB (watch for false positives with common names)
- If name-only match (no NPI in OIG record): flag for Specialist review (may be false positive)

**Result handling**:
- `Clear` (no match): Create `SanctionsCheck` record, result = `clear`. Save PDF. Proceed.
- `Flagged` (match found): Create `SanctionsCheck` record, result = `flagged`. HARD STOP on application. Alert Credentialing Manager immediately.

**Edge cases**:
- Common name with multiple OIG matches: flag all as potential matches for Manager review.
- Provider name changed (maiden name vs. current name): check both names.
- OIG website down: use cached database for initial check; queue online check for retry.

---

## Bot 7: Sanctions Check — SAM.gov

**Credential verified**: SAM.gov federal debarment/exclusion status

**Applicable**: All providers — run at initial credentialing and monthly thereafter

**Source**: SAM.gov REST API

**Authentication**: SAM.gov API key (stored in Azure Key Vault as `sam-api-key`)

**API call**:
```
GET https://api.sam.gov/entity-information/v3/entities
  ?api_key={key}
  &legalBusinessName={provider_last_name}%20{provider_first_name}
  &isActive=Yes
  &exclusionStatusFlag=D
```

Also query by NPI if available:
```
GET https://api.sam.gov/entity-information/v3/entities
  ?api_key={key}
  &ueiDUNS={npi}
```

**Result handling**:
- No exclusion records returned: `clear`
- Exclusion records found: extract type, effective date, basis. Mark `flagged`.
- Save API response as JSON + generate PDF report. Save to Azure Blob: `SAM Sanctions Check MM.DD.YYYY.pdf`

**Edge cases**:
- API rate limiting: implement retry with backoff
- Name ambiguity: flag for Specialist review with all matching records listed

---

## Bot 8: NPDB Query

**Credential verified**: National Practitioner Data Bank — malpractice and adverse actions

**Applicable**: All providers — initial query required before committee approval; continuous query enrollment for approved providers

**Source**: NPDB HIQA Web Service

**Authentication**: Essen's NPDB entity account (username, password, entity ID from Azure Key Vault)

**Query data submitted**:
- Full legal name (first, last, middle if available)
- Date of birth
- SSN (last 4 or full, per NPDB requirements — handled same as ABFM: in-memory only, never logged)
- NPI
- State license number(s) and state(s)

**Step-by-step actions**:

1. Retrieve NPDB credentials from Azure Key Vault
2. Authenticate to NPDB HIQA web service
3. Submit query with provider data
4. Receive NPDB response (may be synchronous API or async with report delivery via email/download)
5. Parse response: `no_reports` or `reports` (with details)
6. Download NPDB-formatted report PDF
7. Save to Azure Blob: `/providers/{provider-id}/verifications/NPDB Query MM.DD.YYYY.pdf`
8. Create `NPDBRecord`:
   - `query_type` = `initial`
   - `result` = `no_reports` or `reports_found`
   - `report_count` = count of reports
   - `reports` = structured report data (type, date, reporting entity, dollar amounts if malpractice)
9. If reports found: flag, block committee advancement, alert Manager
10. After clear initial query: enroll in NPDB Continuous Query service

**Continuous query alerts**:
- When NPDB files a new report against an enrolled provider, NPDB sends a notification to Essen's registered email
- Platform monitors this email inbox (or NPDB webhook if available)
- New report triggers a new `NPDBRecord` with `query_type = continuous_alert`
- Alerts Credentialing Manager immediately

**Legal note**: NPDB results are strictly confidential per 45 CFR Part 60. Access restricted to Credentialing Manager and Admin within the platform. Bot logs redact all SSN data.

---

## Bot 9: eMedNY — NY Medicaid ETIN Enrollment

**Credential verified / Action performed**: NY Medicaid ETIN affiliation submission and status tracking

**Applicable**: Providers requiring NY Medicaid enrollment

**Source**: eMedNY Service Portal + ETIN Affiliation Portal

**Authentication**: Essen eMedNY account (username/password from Azure Key Vault: `emedral-username`, `emedral-password`)

**Step-by-step actions** (new ETIN affiliation scenario):

1. Retrieve eMedNY credentials from Azure Key Vault
2. Log into eMedNY Service Portal
3. Navigate to Provider Enrollment section
4. Search for provider by NPI to confirm not already enrolled
5. If not found: initiate new enrollment
6. Populate enrollment form with provider data from platform profile
7. Upload signed coversheet/application (document already stored in Azure Blob)
8. Submit enrollment form
9. Capture confirmation number and screenshot
10. Save screenshot to Azure Blob: `/providers/{id}/verifications/eMedNY Enrollment MM.DD.YYYY.pdf`
11. Update `MedicaidEnrollment` record: `submission_date`, `status = in_process`
12. Set follow-up monitoring schedule

**Follow-up bot** (separate bot run, scheduled):
1. Log into eMedNY portal
2. Check status of submitted enrollment by provider NPI or confirmation number
3. If enrolled: extract ETIN number, effective date. Update `MedicaidEnrollment` record.
4. If still pending: log status check, set next follow-up date
5. Save status screenshot to Azure Blob

---

## Bot 10: Enrollment Portal Submissions

**Action performed**: Submit provider enrollment to payer portals (My Practice Profile, Availity, Verity, EyeMed)

**Applicable**: Any provider with an active payer enrollment record requiring portal submission

**Common bot pattern** (varies per portal — full per-portal specs to be added during implementation):

1. Retrieve portal credentials from Azure Key Vault
2. Launch Playwright browser session
3. Navigate to portal login page
4. Enter username and password
5. Handle any MFA if required (TOTP or session cookie reuse)
6. Navigate to enrollment submission section
7. Select "Add New Provider" or equivalent
8. Fill in provider details from platform profile:
   - NPI, DEA, name, address, specialty, license(s)
   - Practice locations, hours, effective dates
9. Upload any required documents (e.g., license copy, W-9)
10. Review and submit form
11. Capture confirmation screen screenshot and confirmation number
12. Log out of portal
13. Save screenshot to Azure Blob
14. Update `Enrollment` record: `status = submitted`, `submitted_at`, `payer_confirmation_number`

**Per-portal notes**:

| Portal | Login URL | MFA | Key Vault Secrets |
|--------|-----------|-----|------------------|
| My Practice Profile (UHC/UBH) | TBD | TBD | `mpp-username`, `mpp-password` |
| Availity | `https://apps.availity.com/` | TBD | `availity-username`, `availity-password` |
| Verity (Archcare) | TBD | TBD | `verity-username`, `verity-password` |
| EyeMed | TBD | TBD | `eyemed-username`, `eyemed-password` |
| VNS online form | TBD | None | None required |

**Note**: Exact portal URLs and form structures to be documented during implementation sprint for each portal.

---

## Bot 11: Expirables Renewal Confirmation

**Action performed**: Confirm whether a provider's expiring credential has been renewed, by checking the authoritative source

**Applicable**: Any expirable credential that can be verified via a website (licenses, CAQH attestation, board certifications)

**Trigger**: Expirable is within alert threshold (90/60/30/14/7 days to expiry) and a renewal confirmation bot is configured for that credential type

**Credential-to-bot mapping**:

| Expirable Type | Renewal Confirmation Source |
|----------------|----------------------------|
| State License | Same as Bot 1 (healthguideusa.org) — check new expiration date |
| Board Certification | Same as Bot 3/4/5 (NCCPA/ABIM/ABFM) — check new expiration |
| DEA Certificate | Same as Bot 2 (DEA portal) — check new expiration |
| CAQH Attestation | CAQH API: check last attestation date |
| Hospital Privileges | Check privilege status from facility (manual or bot, per facility) |
| Medicaid Revalidation | Check eMedNY portal (Bot 9 variant) |
| Medicare Revalidation | Check PECOS (Provider Enrollment, Chain, and Ownership System) — bot TBD |
| BLS/ACLS/PALS | No automated source — provider must submit renewed card document |
| Infection Control | No automated source — provider must submit certificate |
| Flu Shot / Physical Exam | No automated source — provider must submit documentation |

**Bot actions** (for license/board renewals — same as PSV bots but specifically checking for new expiration):

1. Run the corresponding PSV bot for the credential type
2. Compare extracted expiration date against current record
3. If new date is later than current: mark `Expirable.status = renewed`, update `Expirable.new_expiration_date`
4. If same or earlier: no change, continue monitoring
5. Save renewal confirmation PDF to Azure Blob with timestamp
6. Update `Expirable` record: `renewal_confirmed_date`, `screenshot_blob_url`

---

## Bot Observability & Monitoring

### Logging
- Each bot run produces a structured log stored in Azure Blob at:
  `/system/bot-logs/{bot-type}/{bot-run-id}.log`
- Log entries include: timestamp, step name, status (pass/fail), screenshot on failure
- Sensitive data (SSN, passwords) is **never** included in logs

### Metrics tracked per bot type
- Total runs (last 24h, 7d, 30d)
- Success rate
- Average duration
- Failure reasons (categorized)
- Queue depth and average wait time

### Admin dashboard
- System Admin sees bot health metrics in real-time
- Alert thresholds configurable per bot type
- Failed bot runs are listed with provider name, bot type, error summary, and link to full log

---

## Adding New Bot Workflows

When a new PSV source or enrollment portal is added:

1. Document the bot specification in this file (following the format above)
2. Implement the Playwright script
3. Register the bot type in the `BotRun.bot_type` enum
4. Add any new required secrets to Azure Key Vault
5. Configure the bot trigger condition in the platform (automatic vs. manual)
6. Test in headed mode against staging/sandbox version of target site
7. Add the bot to the Admin health monitoring dashboard

---

## Remaining Workflows To Document

The following PSV bots and workflows need detailed specification before implementation:

| Bot / Workflow | Status |
|----------------|--------|
| Specialty boards beyond NCCPA/ABIM/ABFM (e.g., APA, ABPN, AAFP) | To be documented |
| Medicare PECOS revalidation check | To be documented |
| Hospital privileges verification (per facility) | To be documented — varies by facility |
| CAQH attestation status check | To be documented |
| ACLS/BLS/PALS renewal (manual process — no bot possible) | Workflow to be documented |
| Infection Control / Pain Management certificate renewal | To be documented |
| Annual Physical Exam / Flu Shot renewal | To be documented |
| MetroPlus roster submission via email | To be documented |
| FTP submission bots for Humana, Centerlight | To be documented |

*Essen credentialing team to provide workflow documentation for remaining items, following the format used above.*
