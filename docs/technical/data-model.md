# Data Model

**Audience:** Backend engineers, DBAs, integration partners.
**Source of truth:** `prisma/schema.prisma`. This page is a navigation aid.

---

## 1. Conventions

- Snake-cased columns; PascalCase models in TypeScript.
- All tables have `id` (cuid), `createdAt`, `updatedAt`.
- Foreign keys are explicit relations (no implicit join tables unless m:n).
- Soft delete is **not** the default. Audit history is kept on the `AuditLog`.
- PHI fields encrypted in app code use the `Encrypted*` shape (cipher / iv / tag).
- Enums are defined in Prisma; mirrored in TypeScript via `@prisma/client`.

## 2. Domain map

```
Provider ──┬── Education
           ├── License
           ├── Specialty (M:N via ProviderSpecialty)
           ├── HospitalAffiliation
           ├── WorkHistory
           ├── BoardCertification
           ├── DEARegistration
           ├── MalpracticeInsurance
           ├── PeerReference
           ├── Document (M:N via ProviderDocument)
           ├── Verification (PSV results)
           ├── BotRun
           ├── Enrollment ── PayerProduct
           ├── Recredentialing ── RecredentialingItem
           ├── ExpirableItem
           ├── SanctionsMatch
           ├── NpdbReport
           ├── ContinuousMonitoring
           ├── HospitalPrivilege
           ├── OPPE / FPPE
           ├── TelehealthState
           ├── BehavioralHealthSpecialty
           ├── PeerReview / RootCauseAnalysis
           ├── CommitteeReview
           └── ProviderInviteToken (single-active)
```

## 3. Module-aligned tables

| Module | Primary tables |
|---|---|
| Provider directory | `Provider`, `ProviderInviteToken`, `ProviderSpecialty`, `Specialty` |
| Application intake | `Education`, `License`, `BoardCertification`, `WorkHistory`, `MalpracticeInsurance`, `PeerReference`, `Document` |
| PSV bots | `BotConfig`, `BotRun`, `BotEvent`, `RawSourceDoc`, `Verification` |
| Sanctions | `SanctionsList`, `SanctionsMatch`, `SanctionsReview` |
| NPDB | `NpdbQuery`, `NpdbReport`, `NpdbContinuousQuery` |
| Continuous monitoring | `ContinuousMonitoring`, `MonitoringEvent` |
| Committee | `Committee`, `CommitteeMeeting`, `CommitteeReview`, `CommitteeDecision`, `CommitteeMinutes` |
| Hospital privileges | `Hospital`, `HospitalAffiliation`, `HospitalPrivilege`, `OPPE`, `FPPE` |
| Recredentialing | `Recredentialing`, `RecredentialingItem` |
| Expirables | `ExpirableItem` |
| Payer enrollment | `PayerProduct`, `Enrollment`, `EnrollmentEvent`, `EnrollmentDocument`, `RosterSubmission` |
| Telehealth | `TelehealthState`, `TelehealthLicense` |
| Behavioral health | `BehavioralHealthSpecialty`, `BHFidelityCheck` |
| Peer review | `PeerReview`, `PeerReviewFinding`, `RootCauseAnalysis`, `Cape` |
| FSMB-PDC | `FsmbPdcSubscription`, `FsmbPdcAlert` |
| AI governance | `AiModelCard`, `AiDecisionLog` |
| Documents | `Document`, `ProviderDocument`, `DocumentVersion` |
| Communications | `EmailMessage`, `EmailReply`, `SmsMessage`, `Notification`, `NotificationPreference` |
| Tasks | `Task`, `TaskAssignment` |
| Reference data | `State`, `Country`, `Specialty`, `BoardingBody`, `LicenseType`, `Payer` |
| Roster | `RosterSubmission`, `RosterRow`, `RosterAttestation` |
| Reports | `Report`, `ReportRun` |
| Compliance | `NcqaCriterion`, `NcqaCriterionAssessment`, `NcqaComplianceSnapshot`, `JoinTCommissionElement` |
| API keys | `ApiKey`, `ApiKeyAuditLog`, `ApiKeyRateLimit` |
| Auth | `User`, `Account`, `Session`, `VerificationToken` |
| Audit | `AuditLog` (chained), `AuditChainAnchor` |

## 4. Encryption map

| Field path | Reason |
|---|---|
| `Provider.ssn` | PHI |
| `Provider.dateOfBirth` | PHI |
| `Provider.contactInfo.homeAddress` | PHI |
| `License.licenseNumber` | sensitive identifier |
| `DEARegistration.deaNumber` | sensitive identifier |
| `MalpracticeInsurance.policyNumber` | sensitive identifier |
| `RawSourceDoc.contentSummary` | may contain PHI |
| `EmailMessage.body` | may contain PHI |

## 5. Indexing & performance notes

- `Provider`: `@@index([npi])`, `@@index([status])`, `@@index([assignedToId])`.
- `BotRun`: `@@index([providerId, startedAt])`, `@@index([botKey, status])`.
- `AuditLog`: `@@index([entityType, entityId])`, `@@index([createdAt])`.
- `Enrollment`: `@@index([payerProductId, status])`.
- `ExpirableItem`: `@@index([dueAt, status])`.

## 6. Migration policy

1. Generate migration locally — `npx prisma migrate dev --name <change>`.
2. Inspect SQL — only commit reviewed migrations.
3. Never edit a merged migration file.
4. Backfills go in a separate code-only migration with idempotent logic.
5. Production runs `prisma migrate deploy` from the web container start
   script; if it fails, the container fails to start (intentional).

## 7. Recent migrations (sample, last 30)

For the canonical ordered list, see `prisma/migrations/`. Recent representative
migrations include: NPDB Continuous Query, Education PSV, Race / Ethnicity / Language,
NY OMIG sanctions, PSV SLA timers, AI governance tables, Auto-Classifier
fields on `Document`, Audit chain anchors, NCQA criterion catalog,
Behavioral Health specialty tables, Telehealth state model, FSMB-PDC subscriptions.

## 8. ERD

A Mermaid ERD lives at `docs/technical/erd.md` and is regenerated from
schema. (If absent in your checkout, generate via
`npx prisma generate && npx prisma-erd-generator`.)
