# ESSEN Credentialing Platform — Business Workflows

**Version**: 0.1 (Pre-Implementation)
**Last Updated**: 2026-04-14
**Status**: Draft — Pending stakeholder review

---

## Overview

This document defines the key end-to-end business workflows using Mermaid flowcharts. Each workflow describes the sequence of events, decision points, actors, and system automations involved.

Actors:
- **Provider** — external healthcare professional
- **Specialist** — Credentialing Specialist (Essen staff)
- **Manager** — Credentialing Manager (Essen staff)
- **Committee** — Medical Director or Committee Member
- **System** — automated platform action (no human)
- **Bot** — Playwright browser automation

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
    Z --> AA([Provider is Committee Ready])
```

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
    A([Provider moves to Committee Queue]) --> B[System: Auto-generate\nProvider Summary Sheet PDF\nSave to Azure Blob]
    B --> C[Provider appears in\nCommittee Dashboard queue]

    C --> D[Manager: Create Committee Session\nSet date, time, location, committee members]
    D --> E[Manager: Add provider to session\nSet agenda order]

    E --> F[Manager: Generate Agenda\nSystem: Compile all provider summaries\nCreate Agenda PDF]
    F --> G[Manager: Send Agenda\nSystem: Email to all committee members\nand Medical Directors]
    G --> H[Committee Members:\nReview agenda and summary sheets]

    H --> I([Committee Session Occurs])
    I --> J[Manager: Record decisions\nfor each provider]

    J --> K{Decision?}
    K -- Approved --> L[Manager: Click Approve\nSystem: Stamp approval date\nStatus = approved\nLog in AuditLog]
    K -- Denied --> M[Manager: Select Denied + enter reason\nStatus = denied\nProvider removed from pipeline]
    K -- Deferred --> N[Manager: Select Deferred + enter reason\nStatus = deferred\nProvider returned to onboarding queue]
    K -- Conditional --> O[Manager: Select Conditional\nList outstanding items\nStatus = conditionally_approved]

    L --> P[System: Notify Specialist of approval\nTrigger Enrollments workflow]
    M --> Q([End — Provider denied])
    N --> R([Provider returns to onboarding])
    O --> S[Specialist: Track and resolve conditional items]
    S --> L
```

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

```mermaid
flowchart TD
    A([Nightly Scheduled Job]) --> B[System: Scan all Expirable records\nFind credentials with upcoming expiry]
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
    end
```
