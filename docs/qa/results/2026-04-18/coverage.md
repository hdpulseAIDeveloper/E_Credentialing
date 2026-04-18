## Coverage headline (per STANDARD.md §3)

```
Routes covered:    9 of 60
API cells covered: 5 of 34
tRPC covered:      0 of 218
Per-screen cards:  60 of 60
Pillars touched:   A, B, C, D, E, F, G, H, I, J, K, L, M, N, O, P, Q, R
Pillars not run:   (none)
```

### Pillar spec counts (STANDARD.md §2)

| ID | Pillar | Spec files |
| --- | --- | --- |
| A | Functional smoke | 3 |
| B | RBAC matrix | 3 |
| C | PHI scope & encryption | 1 |
| D | Deep end-to-end flows | 1 |
| E | Accessibility | 3 |
| F | Visual regression | 1 |
| G | Cross-browser & responsive | 1 |
| H | Performance, load & soak | 1 |
| I | Security & DAST | 1 |
| J | API contract | 1 |
| K | External integration | 1 |
| L | Time-shifted scenarios | 1 |
| M | Data integrity, migrations, backup & DR | 1 |
| N | Concurrency, idempotency & resilience | 1 |
| O | File / email / SMS / print / PDF | 1 |
| P | Compliance controls | 1 |
| Q | Documentation integrity | 1 |
| R | Observability | 1 |

### Routes missing a spec

- `/admin`
- `/admin/ai-governance`
- `/admin/ai-governance/[id]`
- `/admin/api-keys`
- `/admin/privileging`
- `/admin/provider-types`
- `/admin/roles`
- `/admin/settings`
- `/admin/training`
- `/admin/users`
- `/admin/users/[id]`
- `/admin/workflows`
- `/admin/workflows/[id]`
- `/analytics`
- `/application/attestation`
- `/application/documents`
- `/auth/register`
- `/behavioral-health`
- `/bots/exceptions`
- `/bots/exceptions/[id]`
- `/cme`
- `/committee`
- `/committee/sessions/[id]`
- `/committee/sessions/new`
- `/compliance`
- `/compliance/[framework]`
- `/compliance/[framework]/[id]`
- `/enrollments`
- `/enrollments/[id]`
- `/evaluations`
- `/fsmb-pdc`
- `/legal/cookies`
- `/legal/hipaa`
- `/legal/privacy`
- `/medicaid`
- `/medicaid/[id]`
- `/medicaid/new`
- `/monitoring`
- `/peer-review`
- `/peer-review/[id]`
- `/providers/[id]`
- `/providers/[id]/bots`
- `/reports`
- `/reports/export`
- `/scorecards`
- `/telehealth`
- `/training`
- `/verifications`
- `/verify/carrier/[token]`
- `/verify/reference/[token]`
- `/verify/work-history/[token]`

### API (route, method) cells missing a spec

- `POST /api/ai/chat`
- `POST /api/application/save-section`
- `POST /api/attestation`
- `GET /api/auth/[...nextauth]`
- `POST /api/auth/[...nextauth]`
- `POST /api/auth/register`
- `GET /api/documents/[id]/download`
- `GET /api/fhir/Endpoint`
- `GET /api/fhir/Endpoint/[id]`
- `GET /api/fhir/Location`
- `GET /api/fhir/Location/[id]`
- `GET /api/fhir/Organization`
- `GET /api/fhir/Organization/[id]`
- `GET /api/fhir/Practitioner/[id]`
- `GET /api/fhir/PractitionerRole`
- `GET /api/fhir/PractitionerRole/[id]`
- `GET /api/live`
- `GET /api/metrics`
- `GET /api/providers/[id]/audit-packet`
- `GET /api/trpc/[trpc]`
- `POST /api/trpc/[trpc]`
- `POST /api/upload`
- `GET /api/v1/enrollments`
- `GET /api/v1/providers`
- `GET /api/v1/providers/[id]`
- `GET /api/v1/sanctions`
- `POST /api/webhooks/exclusions`
- `POST /api/webhooks/fsmb-pdc`
- `POST /api/webhooks/sendgrid`

### tRPC procedures missing a spec

- `admin.createProviderType`
- `admin.createUser`
- `admin.createWorkflow`
- `admin.deactivateUser`
- `admin.deleteSetting`
- `admin.deleteUser`
- `admin.deleteWorkflow`
- `admin.saveWorkflow`
- `admin.setDocumentRequirement`
- `admin.updateProviderType`
- `admin.updateUser`
- `admin.upsertSetting`
- `aiGovernance.attestModelCardReview`
- `aiGovernance.deleteModelCard`
- `aiGovernance.getModelCard`
- `aiGovernance.listDecisionLogs`
- `aiGovernance.listModelCards`
- `aiGovernance.recordDecision`
- `aiGovernance.summary`
- `aiGovernance.upsertModelCard`
- `apiKey.availableScopes`
- `apiKey.create`
- `apiKey.delete`
- `apiKey.revoke`
- `behavioralHealth.classifyTaxonomy`
- `behavioralHealth.createAttestation`
- `behavioralHealth.evaluateBcbs`
- `behavioralHealth.listAttestations`
- `behavioralHealth.rosterCounts`
- `behavioralHealth.updateAttestation`
- `behavioralHealth.updateTaxonomy`
- `bot.getById`
- `bot.getLatestByProvider`
- `bot.listByProvider`
- `bot.triggerBot`
- `botOrchestrator.counts`
- `botOrchestrator.get`
- `botOrchestrator.list`
- `botOrchestrator.resolve`
- `cme.create`
- `cme.delete`
- `cme.generateCv`
- `cme.getSummary`
- `cme.listByProvider`
- `cme.update`
- `committee.addProvider`
- `committee.generateAgenda`
- `committee.generateSummary`
- `committee.getQueue`
- `committee.getSession`
- `committee.listSessions`
- `committee.removeProvider`
- `committee.sendAgenda`
- `committee.updateAgendaOrder`
- `communication.addInternalNote`
- `communication.listByProvider`
- `communication.logPhoneCall`
- `communication.sendFollowUpEmail`
- `communication.sendSms`
- `compliance.addEvidence`
- `compliance.createGap`
- `compliance.getControl`
- `compliance.listAuditPeriods`
- `compliance.readiness`
- `compliance.updateGap`
- `directory.deleteRole`
- `directory.listEndpoints`
- `directory.listLocations`
- `directory.listOrganizations`
- `directory.listRolesByProvider`
- `directory.upsertRole`
- `document.createRecord`
- `document.delete`
- `document.getById`
- `document.getChecklist`
- `document.listByProvider`
- `document.triggerOcr`
- `document.updateChecklistItem`
- `enrollment.addFollowUp`
- `enrollment.create`
- `enrollment.delete`
- `enrollment.generateRoster`
- `enrollment.getById`
- `enrollment.list`
- `enrollment.pushToEcw`
- `enrollment.submitViaPortal`
- `enrollment.updateStatus`
- `enrollment.uploadRosterSftp`
- `evaluation.getById`
- `evaluation.getDashboard`
- `evaluation.list`
- `evaluation.listByProvider`
- `evaluation.update`
- `expirable.create`
- `expirable.delete`
- `expirable.getSummary`
- `expirable.list`
- `expirable.listByProvider`
- `expirable.update`
- `fsmbPdc.counts`
- `fsmbPdc.getEvent`
- `fsmbPdc.getSubscription`
- `fsmbPdc.listEvents`
- `fsmbPdc.listSubscriptions`
- `malpractice.create`
- `malpractice.delete`
- `malpractice.getByToken`
- `malpractice.listByProvider`
- `malpractice.listFacilityMinimums`
- `malpractice.sendReminder`
- `malpractice.sendRequest`
- `malpractice.submitResponse`
- `medicaid.addFollowUp`
- `medicaid.confirmEtin`
- `medicaid.create`
- `medicaid.getById`
- `medicaid.getSummary`
- `medicaid.list`
- `medicaid.recordSignature`
- `medicaid.recordSubmission`
- `medicaid.updateGroupAffiliation`
- `medicaid.updatePsp`
- `medicaid.updateStatus`
- `monitoring.acknowledge`
- `monitoring.counts`
- `monitoring.getById`
- `monitoring.list`
- `ncqa.listAssessments`
- `ncqa.listCriteria`
- `ncqa.listSnapshots`
- `npdb.getAdverse`
- `npdb.listByProvider`
- `npdb.triggerQuery`
- `peerReview.addMinute`
- `peerReview.getMeeting`
- `peerReview.listMeetings`
- `peerReview.listMinutesByProvider`
- `privileging.createCategory`
- `privileging.createItem`
- `privileging.deleteCategory`
- `privileging.deleteItem`
- `privileging.getCategory`
- `privileging.listCategories`
- `privileging.search`
- `privileging.updateCategory`
- `privileging.updateItem`
- `provider.create`
- `provider.createHospitalPrivilege`
- `provider.deleteHospitalPrivilege`
- `provider.getAuditTrail`
- `provider.getById`
- `provider.importFromIcims`
- `provider.list`
- `provider.pullCaqhData`
- `provider.sendInvite`
- `provider.transitionStatus`
- `provider.update`
- `provider.updateCoi`
- `provider.updateHospitalPrivilege`
- `provider.updateOnsiteMeeting`
- `recredentialing.getById`
- `recredentialing.getByProvider`
- `recredentialing.getDashboard`
- `recredentialing.list`
- `recredentialing.updateStatus`
- `reference.create`
- `reference.delete`
- `reference.listByProvider`
- `reference.sendReminder`
- `reference.sendRequest`
- `reference.submitResponse`
- `report.complianceSummary`
- `report.exportEnrollments`
- `report.exportExpirables`
- `report.exportProviders`
- `report.exportRecredentialing`
- `report.listSavedReports`
- `roster.acknowledgeRoster`
- `roster.generateSubmission`
- `roster.getRoster`
- `roster.listRosters`
- `roster.submitRoster`
- `roster.validateSubmission`
- `sanctions.getFlagged`
- `sanctions.listByProvider`
- `sanctions.triggerCheck`
- `task.addComment`
- `task.create`
- `task.getById`
- `task.list`
- `task.update`
- `telehealth.coverage`
- `telehealth.deleteCert`
- `telehealth.evaluateImlc`
- `telehealth.listCerts`
- `telehealth.updateImlcRecord`
- `telehealth.upsertCert`
- `training.create`
- `training.delete`
- `training.deleteCourse`
- `training.getComplianceSummary`
- `training.listAll`
- `training.listAssignments`
- `training.listByUser`
- `training.listCourses`
- `training.myAssignments`
- `training.recordCompletion`
- `training.resyncAll`
- `training.resyncMyAssignments`
- `training.update`
- `training.upsertCourse`
- `training.waiveAssignment`
- `workHistory.create`
- `workHistory.delete`
- `workHistory.listByProvider`
- `workHistory.sendReminder`
- `workHistory.sendRequest`
- `workHistory.submitResponse`
