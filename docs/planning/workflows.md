# ESSEN Credentialing Platform — Business Workflows

**Version**: 0.2
**Last Updated**: 2026-04-16
**Status**: Implementation-aligned (modules 1–20)

---

## Overview

This document defines the key end-to-end business workflows using Mermaid flowcharts. Each workflow describes the sequence of events, decision points, actors, and system automations involved.

Actors:
- **Provider** — external healthcare professional
- **Specialist** — Credentialing Specialist (Essen staff)
- **Manager** — Credentialing Manager (Essen staff)
- **Committee** — Medical Director or Committee Member
- **Employer / Reference** — external third party (work history employer, professional reference)
- **System** — automated platform action (no human)
- **Bot** — Playwright browser automation
- **API Client** — machine caller hitting the public REST API or FHIR endpoint

## Module → Workflow Map

The platform ships 20 functional modules. Each module either owns a dedicated workflow below or plugs into an existing one. The table below is the canonical cross-reference — if a new module is added, this table and the matching diagram must be updated together.

| # | Module | Workflow |
|---|--------|----------|
| 1 | Provider Onboarding | [Workflow 1](#workflow-1-provider-onboarding-end-to-end) |
| 2 | Onboarding Dashboard | cross-cutting — surfaces state from Workflows 1, 2, 5, 6, 8, 10 |
| 3 | Committee Dashboard | [Workflow 3](#workflow-3-committee-review) |
| 4 | Enrollments | [Workflow 4](#workflow-4-enrollment-submission) |
| 5 | Expirables Tracking | [Workflow 5](#workflow-5-expirables-tracking--renewal) |
| 6 | Credentialing Bots (PSV) | [Workflow 2](#workflow-2-psv-bot-execution) |
| 7 | Sanctions Checking | [Workflow 6](#workflow-6-sanctions-checking) |
| 8 | NY Medicaid / ETIN | [Workflow 7](#workflow-7-ny-medicaid-etin-enrollment) |
| 9 | Hospital Privileges | covered in Workflow 1 (documents) + [Workflow 14](#workflow-14-oppefppe-evaluation-lifecycle) (FPPE trigger) |
| 10 | NPDB | [Workflow 8](#workflow-8-npdb-query) |
| 11 | Recredentialing | **[Workflow 11](#workflow-11-recredentialing-cycle)** *(new)* |
| 12 | Compliance & Reporting | read-only reporting — no workflow diagram; snapshots feed Workflow 10 escalations |
| 13 | Verifications (employer + reference) | **[Workflow 12](#workflow-12-reference--work-history-verification)** *(new)* |
| 14 | Roster Management | **[Workflow 13](#workflow-13-roster-generation--submission)** *(new)* |
| 15 | OPPE/FPPE | **[Workflow 14](#workflow-14-oppefppe-evaluation-lifecycle)** *(new)* |
| 16 | Privileging Library | catalog — integrates into [Workflow 3](#workflow-3-committee-review) and [Workflow 14](#workflow-14-oppefppe-evaluation-lifecycle) |
| 17 | CME & CV | **[Workflow 15](#workflow-15-cme-tracking--attestation)** *(new)* |
| 18 | Public REST API & FHIR | **[Workflow 16](#workflow-16-public-rest-api--fhir-access)** *(new)* |
| 19 | Telehealth Credentialing | plugs into Workflow 1 (training gate) and Workflow 5 (multi-state license expirables) |
| 20 | Performance & Analytics | read-only reporting — no workflow diagram; scorecards derive from Workflows 1–15 |

---

## Workflow 1: Provider Onboarding (End-to-End)

This workflow covers the full onboarding journey from initial outreach through committee readiness.

```mermaid
flowchart TD
    A([Provider Hired / Contract Signed]) --> B{Provider in iCIMS?}
    B -- Yes --> C[System: Pull demographics from iCIMS API]
    B -- No --> D[Specialist: Manually create provider record]
    C --> E[System: Create Provider record with iCIMS data]
    D --> E

    E --> F[Specialist: Send Outreach Email\ncred_onboarding@essenmed.com\nwith BEGIN APPLICATION link]
    F --> G{Provider clicks link\nwithin 72 hours?}
    G -- No / Expired --> H[System: Flag for resend\nSpecialist: Resend invite]
    H --> G
    G -- Yes --> I[Provider: Creates account / SSO login]

    I --> J{CAQH ID available?}
    J -- Yes --> K[System: Ingest from CAQH API\nPre-populate application fields]
    J -- No --> L[Provider: Upload Photo ID\nSystem: OCR extracts name/DOB/ID#]
    K --> M[Provider: Review & complete application]
    L --> M

    M --> N[Provider: Upload credential documents\nto drop-box]
    N --> O[System: OCR each document\nAuto-populate fields\nUpdate checklist status]
    O --> P{All required fields\ncomplete?}
    P -- No --> Q[System: Highlight missing fields in RED\nProvider: Fill remaining fields]
    Q --> P
    P -- Yes --> R{All required documents\nuploaded?}
    R -- No --> S[Provider: Upload remaining docs\nSpecialist: Send follow-up reminders]
    S --> R
    R -- Yes --> T[Provider: Complete Attestation\nElectronic signature + timestamp]

    T --> U[System: Trigger PSV Bot Queue\nRun all applicable bots in parallel]
    U --> V{All bots completed\nwithout flags?}
    V -- Flagged --> W[System: Alert Specialist\nSpecialist: Review & acknowledge flags]
    W --> X{Flag resolved?}
    X -- No --> Y[Specialist/Manager: Determine action]
    X -- Yes --> V
    V -- All clear --> Z[System: Auto-move provider\nto Committee Queue\nGenerate Summary Sheet]
    Z --> ZA{Provider requested\ntelehealth privileges?}
    ZA -- Yes --> ZB[System: Mark telehealth_platform on profile\nFlag training_required until\ntelehealth_certified = true]
    ZA -- No --> AA
    ZB --> AA([Provider is Committee Ready])
```

**Companion workflows triggered from Onboarding:**
- Work-history / professional-reference verification requests fan out in parallel with the PSV bots — see [Workflow 12](#workflow-12-reference--work-history-verification).
- Committee review picks up from `Committee Ready` — see [Workflow 3](#workflow-3-committee-review).
- Telehealth training completion is tracked as an Expirable (module #19) — see [Workflow 5](#workflow-5-expirables-tracking--renewal).

---

## Workflow 2: PSV Bot Execution

This workflow describes the lifecycle of a single Primary Source Verification (PSV) bot run.

```mermaid
flowchart TD
    A([Bot triggered\nautomatically or manually]) --> B[System: Create BotRun record\nStatus = queued]
    B --> C[System: Retrieve required input data\ne.g., license number, NPI, DEA number]
    C --> D{Required data\navailable?}
    D -- No --> E[System: Mark BotRun = failed\nAlert Specialist: Missing input data]
    D -- Yes --> F[System: Retrieve credentials\nfrom Azure Key Vault\nif bot requires login]

    F --> G[Bot: Execute Playwright script]
    G --> H{Bot succeeds?}

    H -- Yes --> I[Bot: Take screenshot / download PDF\nTimestamp the document]
    I --> J[Bot: Save PDF to Azure Blob Storage\nusing naming convention]
    J --> K[System: Create VerificationRecord\nExtract: status, expiration date, cert IDs]
    K --> L[System: Update ChecklistItem status]
    L --> M{Result flagged?\ne.g., expired, not found,\nsanction found}
    M -- Yes --> N[System: Mark VerificationRecord.is_flagged = true\nAlert Specialist via in-app + email]
    N --> O[Specialist: Review & acknowledge flag]
    M -- No --> P[System: Update BotRun = completed\nLog in AuditLog]
    O --> P

    H -- Error --> Q{Attempt count < 3?}
    Q -- Yes --> R[System: Wait exponential backoff\nRetry bot execution]
    R --> G
    Q -- No --> S[System: Mark BotRun = failed\nSave error log to Azure Blob\nAlert Specialist: Bot failed after 3 attempts]
    S --> T[Specialist: Manual verification fallback\nUpload PSV result manually]
    T --> K
```

---

## Workflow 3: Committee Review

This workflow describes the committee preparation, review, and approval process.

```mermaid
flowchart TD
    A([Provider moves to Committee Queue\n— initial or recredentialing]) --> B[System: Auto-generate\nProvider Summary Sheet PDF\nSave to Azure Blob]
    B --> B1{Privileges requested?}
    B1 -- Yes --> B2[System: Pull core + requested privileges\nfrom Privileging Library — module #16\nAttach CPT/ICD-10 codes + FPPE flags to summary]
    B1 -- No --> C
    B2 --> C[Provider appears in\nCommittee Dashboard queue]

    C --> D[Manager: Create Committee Session\nSet date, time, location, committee members]
    D --> E[Manager: Add provider to session\nSet agenda order]

    E --> F[Manager: Generate Agenda\nSystem: Compile all provider summaries\nCreate Agenda PDF]
    F --> G[Manager: Send Agenda\nSystem: Email to all committee members\nand Medical Directors]
    G --> H[Committee Members:\nReview agenda and summary sheets]

    H --> I([Committee Session Occurs])
    I --> J[Manager: Record decisions\nfor each provider]

    J --> K{Decision?}
    K -- Approved --> L[Manager: Click Approve\nSystem: Stamp approval date\nProvider.status = APPROVED\nLog in AuditLog]
    L --> L1{Any FPPE-required\nprivilege granted?}
    L1 -- Yes --> L2[System: Auto-schedule FPPE evaluation\nPracticeEvaluation.type = FPPE\nSee Workflow 14]
    L1 -- No --> P
    L2 --> P
    K -- Denied --> M[Manager: Select Denied + enter reason\nProvider.status = DENIED\nProvider removed from pipeline]
    K -- Deferred --> N[Manager: Select Deferred + enter reason\nProvider.status = DEFERRED\nProvider returned to onboarding queue]
    K -- Conditional --> O[Manager: Select Conditional\nList outstanding items\nStatus = APPROVED w/ open tasks]

    P --> PA{Cycle type?}
    PA -- Initial --> PB[System: Set initialApprovalDate\nTrigger Workflow 4 — Enrollments\nTrigger Workflow 7 — NY Medicaid if applicable]
    PA -- Recredentialing --> PC[System: Close RecredentialingCycle\nstatus = COMPLETED\nSchedule next cycle dueDate + 36 months\nSee Workflow 11]
    M --> Q([End — Provider denied])
    N --> R([Provider returns to onboarding])
    O --> S[Specialist: Track and resolve conditional items]
    S --> L
    PB --> PZ([Committee decision recorded])
    PC --> PZ
```

**Integration notes:**
- The same committee dashboard serves both **initial credentialing** and **recredentialing** (module #11). The workflow differs only at the very end: initial approvals trigger enrollments; recredentialing approvals close the cycle and schedule the next one.
- When a granted privilege carries `requires_fppe = true` in the Privileging Library (module #16), the approval automatically schedules a Focused Professional Practice Evaluation — see [Workflow 14](#workflow-14-oppefppe-evaluation-lifecycle).

---

## Workflow 4: Enrollment Submission

This workflow covers the process of enrolling a provider with a payer after credentialing approval.

```mermaid
flowchart TD
    A([Provider Approved]) --> B[Specialist: Create Enrollment Record\nSelect: payer, type, submission method]
    B --> C{Submission method?}

    C -- Portal Bot\ne.g., My Practice Profile,\nAvaility, Verity --> D[System: Queue enrollment bot\nBot: Log into portal using Key Vault credentials]
    D --> E[Bot: Fill provider details\nUpload documents if required\nSubmit form]
    E --> F{Submission successful?}
    F -- Yes --> G[Bot: Capture confirmation number/screenshot\nUpdate Enrollment: status=submitted, date]
    F -- No --> H[System: Flag enrollment as error\nAlert Specialist\nSpecialist: Manual submission]

    C -- FTP --> I[System: Generate roster file\nSFTP: Upload to payer FTP server]
    I --> J{FTP upload successful?}
    J -- Yes --> K[System: Update Enrollment status=submitted\nSend confirmation email to payer\nwith FTP credentials]
    J -- No --> L[System: Flag error\nAlert Specialist]

    C -- Email --> M[Specialist: Generate roster or application\nSend email to payer]
    M --> N[Specialist: Mark status=submitted\nRecord sent date]

    G --> O[System: Set follow-up due date\nbased on payer cadence]
    K --> O
    N --> O

    O --> P{Follow-up date reached?}
    P -- Yes --> Q[System: Alert Specialist\nCreate follow-up task]
    Q --> R[Specialist: Contact payer\nRecord follow-up outcome]
    R --> S{Provider enrolled?}
    S -- No --> T[Specialist: Set next follow-up date]
    T --> P
    S -- Yes --> U[Specialist: Update Enrollment: status=enrolled\nRecord effective date]
    U --> V([Enrollment complete])
```

---

## Workflow 5: Expirables Tracking & Renewal

This workflow describes how expiring credentials are detected, confirmed, and renewed.

**Expirable classes covered:** state licenses, DEA, board certifications, malpractice insurance, CAQH attestation, BLS/ACLS/PALS, flu shot, PPD, hospital privileges, CME reporting cycles *(module #17)*, multi-state telehealth licenses *(module #19)*, and recredentialing due dates *(module #11, tracked separately — see Workflow 11 for the full lifecycle)*.

```mermaid
flowchart TD
    A([Nightly Scheduled Job]) --> B[System: Scan all Expirable records\nincluding CME cycles + telehealth licenses\nFind credentials with upcoming expiry]
    B --> C{Days until expiry?}

    C -- 90 days --> D[System: Create alert\nNotify assigned Specialist\nStatus = expiring_soon]
    C -- 60 days --> D
    C -- 30 days --> E[System: Create urgent alert\nNotify Specialist + Manager]
    C -- 14 days --> E
    C -- 7 days --> F[System: Create critical alert\nNotify Specialist + Manager\nEscalate to Manager if no action]
    C -- Expired --> G[System: Mark status = expired\nCreate critical alert\nNotify Manager\nFlag provider record with ❗]

    D --> H{Can renewal be\nconfirmed via bot?}
    E --> H
    H -- Yes --> I[System: Queue renewal confirmation bot\ne.g., state license renewal via state board site]
    I --> J{Renewal confirmed?}
    J -- Yes --> K[Bot: Screenshot/PDF with timestamp\nSave to Azure Blob\nUpdate Expirable: new expiration date\nStatus = renewed]
    J -- No / Not yet --> L[System: Keep status = expiring_soon]

    H -- No --> M[Specialist: Send outreach to provider\nRequest updated document]
    L --> M

    M --> N[Provider: Submits updated credential document]
    N --> O[Specialist/System: Upload document\nUpdate Expirable: new expiration date\nStatus = renewed]
    O --> P{PSV re-verification\nrequired?}
    P -- Yes --> Q[System: Queue PSV bot for renewed credential]
    Q --> R[Bot: Verify renewed credential\nCreate new VerificationRecord]
    R --> S([Expirable resolved])
    P -- No --> S
```

**Special-case expirables:**
- **CME reporting cycle** — when `days_until_cycle_end < 60` and `current_credits < required_credits`, system triggers a CME shortfall alert and opens a task on the provider for self-report (see [Workflow 15](#workflow-15-cme-tracking--attestation)).
- **Multi-state telehealth license** — each state listed in `ProviderProfile.teleHealthStates` is tracked as a separate expirable. Expiration of any one state removes only that state from the provider's telehealth coverage (the rest stay active).
- **Recredentialing dueDate** — not stored as an Expirable row; driven by the dedicated `RecredentialingCycle` scheduler in [Workflow 11](#workflow-11-recredentialing-cycle).

---

## Workflow 6: Sanctions Checking

```mermaid
flowchart TD
    A([Provider enters credentialing pipeline]) --> B[System: Queue initial sanctions check\nOIG + SAM.gov]

    B --> C[Bot/API: Query OIG LEIE database\nMatch by NPI + name + DOB]
    C --> D[API: Query SAM.gov exclusions\nMatch by NPI / name]

    D --> E{Any exclusion found?}
    E -- No --> F[System: Create SanctionsCheck record\nresult = clear\nSave confirmation PDF\nUpdate provider checklist]
    F --> G([Sanctions clear — proceed])

    E -- Yes --> H[System: Create SanctionsCheck record\nresult = flagged\nSave evidence PDF]
    H --> I[System: HARD STOP on application\nAlert Credentialing Manager immediately\nvia in-app + email]
    I --> J[Manager: Review exclusion details]
    J --> K{Exclusion confirmed\nfor this provider?}
    K -- False positive / Match error --> L[Manager: Document finding\nAcknowledge and clear flag\nProceed with credentialing]
    K -- Confirmed exclusion --> M[Manager: Deny provider\nRecord reason\nClose application]
    L --> G
    M --> N([End — Provider denied])

    G --> O[System: Schedule monthly automated\nrechecks for all active providers]
    O --> P{New exclusion found\nin monthly check?}
    P -- No --> O
    P -- Yes --> H
```

---

## Workflow 7: NY Medicaid ETIN Enrollment

Based on the Medallion reference flow adapted for the Essen internal platform.

```mermaid
flowchart TD
    A([NY Medicaid enrollment initiated\nfor provider]) --> B{Provider already\nin eMedNY portal?}

    B -- Yes --> C{Provider in\nMaintenance File?}
    C -- Yes --> D[System: Update ETIN affiliation\nvia ETIN Affiliation Portal bot]
    D --> E([ETIN Affiliation updated])
    C -- No --> F[Begin new ETIN affiliation process]

    B -- No --> F

    F --> G[System: Populate revalidation /\nregistration application\nfrom provider profile data]
    G --> H{Provider signature\nrequired?}

    H -- Yes --> I[System: Generate application + coversheet\nSpecialist: Mail to provider for signature]
    I --> J[Specialist: Track signature return\nLog in MedicaidEnrollment record]
    J --> K{Signature received?}
    K -- No --> L[System: Send reminder to provider\nSpecialist: Follow up]
    L --> K
    K -- Yes --> M[Specialist: Upload signed document]

    H -- No --> M

    M --> N[Bot: Log into eMedNY Service Portal\nSubmit application]
    N --> O{Submission successful?}
    O -- Error --> P[System: Alert Specialist\nSpecialist: Manual submission]
    P --> Q[Specialist: Update submission status manually]
    O -- Yes --> Q

    Q --> R[System: Set follow-up cadence\nMonitor eMedNY portal for status]
    R --> S{eMedNY processes application}
    S -- Still pending --> T[Bot/Specialist: Follow up with eMedNY]
    T --> S
    S -- Enrolled --> U[System: Update MedicaidEnrollment\nETIN assigned, affiliation_status = enrolled\nSet revalidation_due_date]
    U --> V[System: Add to Expirables tracking\nAlert before revalidation due]
    V --> W([NY Medicaid Enrollment Complete])
```

---

## Workflow 8: NPDB Query

```mermaid
flowchart TD
    A([Provider enters PSV workflow]) --> B[System: Queue NPDB initial query\nBot/API: Submit query to NPDB HIQA]
    B --> C[System: Submit provider data\nname, DOB, SSN last 4, NPI, license info]
    C --> D[NPDB: Processes query\nReturns report]
    D --> E{Reports found?}

    E -- No reports --> F[System: Create NPDBRecord\nresult = no_reports\nSave confirmation PDF\nUpdate provider checklist]
    F --> G[System: Enroll in Continuous Query\nfor ongoing monitoring]
    G --> H([NPDB clear — proceed])

    E -- Reports found --> I[System: Create NPDBRecord\nresult = reports_found\nSave report PDF to Azure Blob]
    I --> J[System: Flag provider with ❗\nAlert Credentialing Manager\nBlock committee advancement]
    J --> K[Manager: Review NPDB report details]
    K --> L{Reports are\nmaterial / concerning?}
    L -- No / Not disqualifying --> M[Manager: Document review\nAcknowledge finding\nProceed with credentialing]
    L -- Yes / Disqualifying --> N[Manager: Deny or defer provider\nRecord reason]
    M --> G
    N --> O([End or Deferral])

    H --> P{Continuous query alert\nreceived?}
    P -- No alert --> Q([Ongoing monitoring continues])
    P -- New report received --> I
```

---

## Workflow 9: Provider Status Lifecycle

This diagram shows all possible status transitions for a provider record.

```mermaid
stateDiagram-v2
    [*] --> invited : Outreach email sent
    invited --> onboarding_in_progress : Provider clicks link & creates account
    invited --> invited : Invite resent (expired or no-click)

    onboarding_in_progress --> documents_pending : Application fields complete\nDocuments not all uploaded
    onboarding_in_progress --> verification_in_progress : All docs uploaded & attested\nBots queued

    documents_pending --> verification_in_progress : All documents uploaded & attested

    verification_in_progress --> committee_ready : All bots clear\nNo unacknowledged flags
    verification_in_progress --> verification_in_progress : Flags acknowledged\ncontinue verification

    committee_ready --> committee_in_review : Added to a committee session

    committee_in_review --> approved : Manager approves
    committee_in_review --> denied : Manager denies
    committee_in_review --> deferred : Manager defers
    committee_in_review --> committee_ready : Removed from session\nreturns to queue

    deferred --> onboarding_in_progress : Provider re-enters onboarding

    approved --> [*] : Credentialing complete\nEnrollments begin

    denied --> [*] : Application closed

    approved --> inactive : Provider leaves / inactive
    inactive --> [*]
```

---

## Workflow 10: Staff Notification & Escalation

This diagram shows how alerts escalate when action is not taken.

```mermaid
flowchart TD
    A([Alert event occurs\ne.g., bot failure, expirable due,\nfollow-up due]) --> B[System: Create in-app notification\nfor assigned Specialist]
    B --> C[System: Send email to Specialist]
    C --> D{Action taken within\nconfigured SLA?}

    D -- Yes --> E([Alert resolved])

    D -- No / SLA breached --> F[System: Escalate to Credentialing Manager\nIn-app + email notification\nTask highlighted in RED on dashboard]
    F --> G{Action taken\nby Manager?}
    G -- Yes --> E
    G -- No --> H[System: Log escalation in AuditLog\nManager sees escalation in daily report]

    subgraph SLA Thresholds
        I[Bot failure: 4 hours]
        J[Expirable 7-day alert: 48 hours]
        K[Enrollment follow-up due: 24 hours]
        L[Sanctions flag: 2 hours]
        M[NPDB adverse report: 2 hours]
        N[Recredentialing overdue: 24 hours]
        O[Reference/Work-history not received: 7 days after send, then every 7 days]
        P[CME shortfall within 60 days of cycle end: 24 hours]
        Q[OPPE/FPPE overdue: 48 hours]
        R[Roster validation error: 8 hours]
        S[FPPE kick-off after privilege grant: 24 hours]
    end
```

**SLA threshold summary (full table):**

| Alert type | Module | Initial SLA | Escalation trigger |
|------------|--------|-------------|--------------------|
| Bot failure (PSV) | 6 | 4 h to Specialist | → Manager after 4 h |
| Sanctions flag | 7 | 2 h to Manager | → Medical Director after 2 h |
| NPDB adverse report | 10 | 2 h to Manager | → Medical Director after 2 h |
| Expirable 7-day alert | 5 | 48 h to Specialist | → Manager after 48 h |
| Enrollment follow-up due | 4 | 24 h to Specialist | → Manager after 24 h |
| Recredentialing overdue | 11 | 24 h to Specialist | → Manager after 24 h |
| Reference / work-history unreceived | 13 | Reminder at 7 d, again at 14 d | → Specialist task after 21 d |
| CME shortfall (≤ 60 d to cycle end) | 17 | 24 h to Provider (outreach) + Specialist | → Manager 14 d before cycle end |
| OPPE/FPPE overdue | 15 | 48 h to Evaluator | → Manager after 48 h |
| Roster validation error | 14 | 8 h to Specialist | → Manager after 8 h |
| FPPE kick-off after privilege grant | 16 + 15 | 24 h to auto-create scheduled eval | — |

---

## Workflow 11: Recredentialing Cycle

Every credentialed provider is re-verified on a rolling 36-month cycle (configurable per payer/NCQA requirement). This workflow covers detection, application refresh, PSV re-run, and committee re-approval.

```mermaid
flowchart TD
    A([Scheduled Job — daily]) --> B{Any APPROVED providers\nwith initialApprovalDate <= now - 33 months\nand no active cycle?}
    B -- No --> Z1([No action])
    B -- Yes --> C[Manager: Run Bulk Initiate OR\nSystem: auto-initiate via policy]
    C --> D[System: Create RecredentialingCycle\nstatus = PENDING\ndueDate = initialApprovalDate + 36 months\ncycleNumber = prev + 1]

    D --> E[Specialist: Send recredentialing application\nto provider — pre-populated from CAQH + existing profile]
    E --> F[System: Update cycle.status = APPLICATION_SENT\nLog cycle.startedAt]
    F --> G{Provider returns\nupdated application\n+ attestation?}
    G -- No, 14 days elapsed --> H[System: Send reminder\nSpecialist: Phone/email follow-up]
    H --> G
    G -- Yes --> I[System: Update cycle.status = IN_PROGRESS\nRefresh provider profile]

    I --> J[System: Queue full PSV bot set\ncycle.status = PSV_RUNNING\nSee Workflow 2 for each bot]
    J --> K{All PSV bots\ncomplete without flags?}
    K -- Flagged --> L[Specialist: Review & acknowledge\nOR escalate to Manager]
    L --> K
    K -- All clear --> M[System: Set cycle.status = COMMITTEE_READY\nGenerate recredentialing summary sheet]

    M --> N[Manager: Add cycle to committee agenda\nSee Workflow 3 — same committee flow]
    N --> O{Committee decision?}
    O -- Approved --> P[System: cycle.status = COMPLETED\ncycle.completedAt = now\nSchedule next cycle = now + 36 months]
    O -- Denied --> Q[Provider.status = DENIED\nEnrollments terminated — see Workflow 4]
    O -- Deferred --> R[Cycle stays open\nSpecialist resolves outstanding items]

    P --> S([Recredentialing complete\nProvider remains APPROVED])
    R --> I

    T([Daily check]) --> U{cycle.dueDate < now\nAND status != COMPLETED?}
    U -- Yes --> V[System: cycle.status = OVERDUE\nAlert Manager — see Workflow 10]
    V --> W[Manager: Expedite review\nOR suspend provider if payer-mandated]
    U -- No --> X([OK])
```

**Key rules:**
- Cycles run in parallel with an `APPROVED` provider — Provider.status does not change during recredentialing (tracked entirely via `RecredentialingCycle.status`).
- `initiateBulk` on the manager dashboard fires the 33-month-lookback query used above; the 3-month buffer gives Specialists lead time to collect the refreshed application.
- Payers may require shorter cycles (e.g. 24 months for high-risk specialties) — configurable via `cycleLengthMonths` on each `RecredentialingCycle`.

---

## Workflow 12: Reference & Work-History Verification

Covers both **employer work-history verification** and **professional reference checking** — both use the same public-token form pattern (module #13, NCQA-required).

```mermaid
flowchart TD
    A([Specialist creates request\nworkHistory.create OR reference.create]) --> B[System: Generate unique responseToken\nSave WorkHistoryVerification or ProfessionalReference\nstatus = PENDING]
    B --> C[Specialist: Click Send Request]
    C --> D[System: Email employer/reference\nwith link https://site/verify/work-history/:token\nor /verify/reference/:token\nstatus = SENT, requestSentAt = now]

    D --> E{External party clicks link\nwithin 30 days?}
    E -- No — 7 days elapsed --> F[System: Send reminder email\nstatus = REMINDER_SENT\nreminderCount += 1]
    F --> G{Second reminder at 14 days?}
    G -- Yes — still no response --> H[System: Alert Specialist\nCreate follow-up task]
    H --> I[Specialist: Phone employer/reference\nDocument call outcome]
    I --> E
    E -- Link clicked --> J[Public page: Verify token\nLoad provider + request context\nNo auth required — token is capability]

    J --> K{Token still valid?\nnot expired, not declined}
    K -- Expired / Declined --> L[System: Show expired notice\nstatus = EXPIRED or DECLINED]
    K -- Valid --> M[Employer/Reference: Fill form\nemployment dates, position, performance\nOR reference rating + comments]

    M --> N[System: Save responseData JSON\nstatus = RECEIVED\nresponseReceivedAt = now\nLock form — token single-use]
    N --> O[System: Notify Specialist\nAdd to provider's verification checklist]
    O --> P{All required verifications\nreceived?}
    P -- No --> Q[Specialist continues outreach\nfor remaining verifications]
    P -- Yes --> R[System: Mark verification section complete\nContributes to Committee Ready gate]
    R --> S([Verifications complete])

    L --> T[Specialist: Create new request\nif replacement contact available]
    T --> A
```

**Security notes:**
- Tokens are UUIDv4 (`responseToken`) and single-use. Once the form is submitted, the token is invalidated on the server.
- Public routes `/verify/work-history/:token` and `/verify/reference/:token` bypass auth middleware but rate-limit per token to prevent enumeration.
- Responses are stored as structured JSON for NCQA audit retrieval and, optionally, rendered to PDF for archival.

---

## Workflow 13: Roster Generation & Submission

Payer rosters are the bulk-enrollment format (CSV/Excel) sent to payers monthly or on-demand. Each payer has a `PayerRoster` template configuration; actual submissions are `RosterSubmission` records.

```mermaid
flowchart TD
    A([Specialist: Select payer from Roster page]) --> B{Roster template\nconfigured?}
    B -- No --> C[Manager: Create PayerRoster\nDefine columns + submission method + cadence]
    C --> B
    B -- Yes --> D[Specialist: Click Generate]

    D --> E[System: Query all active providers\nApply payer-specific filters\ne.g., enrollment_type, state, specialty]
    E --> F[System: Render CSV using templateConfig\nCreate RosterSubmission\nstatus = DRAFT\nblobUrl = Azure Blob path]
    F --> G[System: Auto-run validation\nCheck required fields, NPI format,\nlicense expiry, sanctions clear]

    G --> H{Validation passes?}
    H -- Errors --> I[System: status = ERROR\nSave validationErrors JSON\nHighlight rows with issues]
    I --> J[Specialist: Fix upstream data\ne.g., missing NPI, expired license]
    J --> D
    H -- Clean --> K[System: status = VALIDATED\nproviderCount = N rows]

    K --> L{Submission method?}
    L -- Portal upload --> M[Specialist: Download CSV\nManually upload to payer portal]
    L -- SFTP --> N[System: SFTP to payer server\nusing credentials from Key Vault]
    L -- Email --> O[Specialist: Email CSV to payer roster inbox]

    M --> P[Specialist: Click Mark Submitted]
    N --> Q{SFTP success?}
    Q -- Yes --> P
    Q -- No --> R[System: status = ERROR\nAlert Specialist\nSee Workflow 10 — 8h SLA]
    R --> J
    O --> P

    P --> S[System: status = SUBMITTED\nsubmittedAt = now, submittedBy = Specialist]
    S --> T{Payer acknowledgment received?}
    T -- Within 7 days --> U[Specialist: Click Mark Acknowledged\nstatus = ACKNOWLEDGED]
    T -- No ack in 7 days --> V[Specialist: Follow up with payer rep]
    V --> T
    U --> W([Roster submission complete])
```

**Cadence & reporting:**
- Submissions feed the Performance & Analytics module (#20) for on-time-submission rate KPIs.
- Each row carries a digital signature header so payers can verify origin; the `templateConfig.signatureField` controls where it renders.

---

## Workflow 14: OPPE/FPPE Evaluation Lifecycle

**OPPE** (Ongoing) runs on a recurring cadence for every privileged provider (typically every 6 months). **FPPE** (Focused) is triggered by specific events: new privilege grant, performance concern, adverse event.

```mermaid
flowchart TD
    subgraph OPPE — periodic
        A([Scheduled Job — monthly]) --> B[System: For each APPROVED provider\nwith hospital privileges, check last OPPE periodEnd]
        B --> C{periodEnd + 6 months\nreached?}
        C -- Yes --> D[System: Create PracticeEvaluation\ntype = OPPE, status = SCHEDULED\nperiodStart/End = last 6 months\ndueDate = now + 30 days]
    end

    subgraph FPPE — triggered
        E([Trigger event]) --> F{Trigger type?}
        F -- New privilege granted — Workflow 3 --> G[System: Create PracticeEvaluation\ntype = FPPE, status = SCHEDULED\nprivilegeId = granted privilege\nperiodStart = approval date\ndueDate = now + 90 days]
        F -- Performance concern / adverse event --> H[Manager: Create FPPE manually\nLink to specific privilege or competency]
    end

    D --> I[System: Assign Evaluator\ntypically Medical Director or dept chair]
    G --> I
    H --> I

    I --> J[System: Notify Evaluator\nAdd to evaluator's task list]
    J --> K{Evaluator starts within dueDate?}
    K -- No — dueDate passed --> L[System: status = OVERDUE\nAlert Manager — Workflow 10 48h SLA]
    L --> M[Manager: Reassign OR expedite]
    M --> J
    K -- Yes --> N[Evaluator: status = IN_PROGRESS\nReview chart samples, peer feedback,\nquality indicators]

    N --> O[Evaluator: Fill indicators JSON\nBlood-draw accuracy, readmit rate, complication rate,\npeer review score, etc.]
    O --> P[Evaluator: Record findings + recommendation\nOption: Attach supporting document to Azure Blob]

    P --> Q{Recommendation?}
    Q -- Satisfactory --> R[System: status = COMPLETED\ncompletedAt = now\nContinue privileges]
    Q -- Concerns identified --> S[Manager: Open follow-up FPPE\nOR restrict specific privileges\nOR refer to committee]
    Q -- Failed --> T[Manager: Suspend privilege\nReport to committee — may trigger Workflow 3\nPossible NPDB report — Workflow 8]

    R --> U{Was this FPPE on new privilege\nwith requires_fppe = true?}
    U -- Yes --> V[System: Mark provider fully privileged\nRemove FPPE flag from privilege record]
    U -- No --> W([OPPE complete — next cycle scheduled])
    V --> W
    S --> W
    T --> X([Provider restricted — manager action continues])
```

**Integration:** every FPPE that's scheduled because of a new privilege from module #16 links back to `PrivilegeItem.id` so the committee can audit privilege outcomes.

---

## Workflow 15: CME Tracking & Attestation

Continuing Medical Education credits are tracked against each provider's specialty-board cycle. Most boards require 50 Category-1 credits per 2-year cycle.

```mermaid
flowchart TD
    A([Provider: Enters CME page]) --> B[Provider: Logs new CME activity\nactivity name, category, credits, completed date]
    B --> C{Upload certificate?}
    C -- Yes --> D[System: OCR certificate\nExtract provider name, activity, credits, date\nSave Document + CmeCredit with documentId]
    C -- No — self-report --> E[System: Save CmeCredit without documentId\nFlag as self-reported for later audit]

    D --> F[System: Update cycle totals]
    E --> F
    F --> G[System: Recalculate totalCredits\nfor current cycle\ncompare vs requirement \(default 50\)]

    G --> H{totalCredits >= required?}
    H -- Yes --> I[System: requirementMet = true\nProvider CV auto-regenerates]
    H -- No --> J{Days until cycle end?}

    J -- > 60 --> K([Continue tracking])
    J -- <= 60 --> L[System: Create CME shortfall alert\nsee Workflow 10 — 24h SLA]
    L --> M[Specialist: Outreach to provider\nRemind of deadline]
    M --> N{Provider logs more credits?}
    N -- Yes --> F
    N -- No, cycle ends --> O[System: Mark cycle INCOMPLETE\nAlert Manager — may affect recredentialing\nsee Workflow 11]

    I --> P([Cycle in good standing])
    O --> Q[Manager: Determine action\ngrace period, board extension, or compliance flag]
    Q --> R([End])

    S([Cycle end date reached]) --> T[System: Archive CME records\nSet next cycle periodStart = prev periodEnd\nReset counters]
    T --> K
```

**Auto-generated CV (module #17):**
- The provider's CV PDF is rebuilt after every new CME credit, license update, or privilege grant.
- CV renders from `Provider` + `ProviderProfile` + `License[]` + `CmeCredit[]` + `HospitalPrivilege[]` — no separate data store.
- Providers can download the latest CV from their application portal at any time; staff can download from the provider detail page.

---

## Workflow 16: Public REST API & FHIR Access

Module #18 exposes credentialing data to external partners — payers, hospital systems, HIEs — via two surfaces:
- `GET /api/v1/*` — Essen-native REST (API-key authenticated, scoped)
- `GET /api/fhir/Practitioner/*` — FHIR R4 compliant (CMS-0057-F provider directory)

```mermaid
flowchart TD
    A([Partner request for API access]) --> B[Manager: Create ApiKey\nSet name + permissions JSON\ne.g. providers.read, practitioner.read]
    B --> C[System: Generate plaintext key \(64 chars\)\nHash with SHA-256 → store keyHash\nShow plaintext ONCE to Manager]
    C --> D[Manager: Securely deliver key to partner]

    D --> E([Partner makes API request\nAuthorization: Bearer <key>])
    E --> F[Middleware: Extract bearer token\nSHA-256 hash the token\nLookup by keyHash in ApiKey table]

    F --> G{Key found, active, not expired?}
    G -- No --> H[Return 401 Unauthorized\nLog denial to AuditLog]
    G -- Yes --> I[Middleware: Update lastUsedAt\nLoad permissions JSON]

    I --> J{Permission covers\nrequested route?}
    J -- No --> K[Return 403 Forbidden\nLog authz failure to AuditLog]
    J -- Yes --> L[Middleware: Rate limit check\nper key_id + route]

    L --> M{Rate limit OK?}
    M -- No --> N[Return 429 Too Many Requests\nwith Retry-After header]
    M -- Yes --> O{Endpoint kind?}

    O -- /api/v1/... REST --> P[Handler: Query Prisma\nApply field-level PHI redaction\nSSN, DOB-day, home-address always stripped]
    O -- /api/fhir/Practitioner --> Q[Handler: Query Prisma\nMap Provider → FHIR R4 Practitioner resource\nCompliant with us-core-practitioner profile]

    P --> R[Return JSON \(application/json\)\nInclude X-Request-Id header]
    Q --> S[Return JSON \(application/fhir+json\)\nInclude meta.lastUpdated]

    R --> T[Audit: api.request written\nactor = api_key:<id>, path, status, duration]
    S --> T
    T --> U([Response sent to partner])

    H --> T
    K --> T
    N --> T
```

**Data safety guarantees:**
- **No PHI** — both surfaces redact SSN, full DOB (only year returned), home address, and any field marked `@phi` in the schema metadata.
- **Tamper-evident audit** — every request writes to the HMAC-chained `AuditLog` (module #18 shares the same audit trail used for staff actions).
- **Key lifecycle** — keys can be rotated (`POST /admin/api-keys/:id/rotate`) which invalidates the old hash and issues a new plaintext without service disruption if both are valid briefly.
- **CMS-0057-F compliance** — the FHIR endpoint is the canonical provider directory source for any payer that needs to point back at Essen per the federal rule's interoperability mandate.
