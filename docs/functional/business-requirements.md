# Business Requirements Document (BRD) — E-Credentialing CVO Platform

**Version:** 2.2
**Last Updated:** 2026-04-19
**Status:** Active
**Audience:** Sponsors, Steering Committee, Business Analysts, Product, QA
**Owner:** Credentialing Manager + Tech Lead

---

## 1. Purpose

The **E-Credentialing CVO platform** (Credentialing Verification
Organization platform) is Essen Medical's healthcare provider
credentialing, verification, monitoring, and onboarding system,
**also offered as a managed CVO service to external medical groups
and ACOs**. This BRD captures the business problems we are solving,
the outcomes we expect, and the high-level business requirements that
frame the [Functional Requirements Document](functional-requirements.md)
and [Technical Requirements Document](../technical/technical-requirements.md).

---

## 2. Background

Essen previously relied on **PARCS** (legacy credentialing system), the **K:
drive PCD folders** for documents, and a patchwork of spreadsheets for
enrollments and expirables. Operational pain:

- Median time to credential exceeded 45 days.
- PSV (state license, DEA, board) was performed manually, ~3–4 hours per provider.
- Expirations were discovered reactively, days or weeks after lapse.
- Audit posture was incomplete — manual artifacts, inconsistent retention.
- NCQA CVO accreditation was difficult to demonstrate against PARCS.
- HIPAA exposure from K: drive shares with no field-level encryption.

The platform replaces all of the above and serves as the new system of record.

---

## 3. Business goals

| Goal | Measure | Target |
|---|---|---|
| Faster onboarding | Median invite → committee-ready | < 18 days |
| Less manual PSV work | Manual hours per provider | < 30 minutes |
| Proactive expirable management | Lead time on renewal alerts | ≥ 90 days |
| Defensible compliance | NCQA CVO file completeness | 100% |
| Audit readiness | Audit log completeness on mutations | 100% |
| Single source of truth | Documents stored in Azure Blob | 100% (K: drive retired) |
| Lower follow-up errors | Enrollment follow-up on time | ≥ 95% |

---

## 4. Stakeholders

| Stakeholder | Role |
|---|---|
| Credentialing Specialists | Primary daily users; manage application, documents, bots, enrollments |
| Credentialing Managers | Oversight, escalations, reporting, approvals workflow |
| Committee Members / Medical Director | Approve / deny / defer providers |
| Roster Managers | Generate and submit per-payer rosters |
| Compliance Officer | NCQA, HIPAA, audit, retention, sanctions workflow |
| System Administrators | Manage users, roles, integrations, configuration |
| Healthcare Providers | External; complete their own application |
| Executive Sponsors | Outcomes, budget, governance |
| IT / DevOps | Infrastructure, security, deployments |
| Auditors (NCQA, internal) | Receive auditor packages, evidence sampling |

---

## 5. Business requirements

Each requirement has an ID, priority, owner, and acceptance criteria. The FRD
expands these into per-screen functional rules.

### BR-001 Replace PARCS as system of record (P0)
Owner: Credentialing Manager. Acceptance: zero new records in PARCS during
Phase 4 Week 5 onward; all active providers migrated; PARCS decommissioned at
Phase 4 Week 8 + 30-day hold.

### BR-002 Single document store (P0)
Owner: DevOps. Acceptance: 100% of documents stored in Azure Blob Storage,
private container, SAS-only download.

### BR-003 HIPAA-aligned PHI protection (P0)
Owner: Security. Acceptance: PHI encrypted at rest (AES-256-GCM) and in
transit (TLS 1.2+); RBAC enforced; full audit logging.

### BR-004 Tamper-evident audit trail (P0)
Owner: Tech Lead. Acceptance: every create/update/delete logged with actor,
role, timestamp, before/after; HMAC chain verified by `verifyAuditChain()`;
DELETE/TRUNCATE blocked at the database.

### BR-005 Azure AD SSO for staff (P0)
Owner: IT. Acceptance: every staff user signs in via Entra ID; no separate
credential storage for staff in production.

### BR-006 Automated PSV (P0)
Owner: Tech Lead. Acceptance: state medical licenses, DEA, board
certifications, OIG sanctions, SAM.gov sanctions, NPDB, and education (AMA /
ECFMG / ACGME) verified end-to-end with PDF artifacts and parsed records.

### BR-007 Payer enrollment tracking (P0)
Owner: Roster Manager. Acceptance: per-provider per-payer enrollments tracked
through the full state machine; follow-up cadence enforced; payer
confirmation numbers and effective dates captured.

### BR-008 Expirable monitoring (P0)
Owner: Specialist. Acceptance: every dated credential tracked; alerts at
120/90/60/30/7/1 days; on-time renewal rate measurable; clinical privileges
optionally pause on lapse.

### BR-009 Reporting and exports (P1)
Owner: Manager. Acceptance: provider status lists, enrollment summaries,
expirables due, committee agendas exportable to CSV; saved reports re-runnable.

### BR-010 NCQA CVO readiness (P0)
Owner: Compliance Officer. Acceptance: CR 1–9 mapped to platform capabilities;
compliance dashboard tiles green when seed data loaded; auditor package
generates required evidence.

### BR-011 CMS-0057-F provider directory FHIR API (P1)
Owner: Tech Lead. Acceptance: `Practitioner` FHIR R4 resource available
with pagination, accurate `Bundle.total`, and `OperationOutcome` errors.

### BR-012 Recredentialing 36-month cycle (P0)
Owner: Specialist. Acceptance: cycles initiated automatically 180 days prior
to anniversary; abbreviated app supported; PSV re-run; committee re-review.

### BR-013 Committee workflow (P0)
Owner: Manager + Committee. Acceptance: committee sessions scheduled; agenda +
summary sheets generated; Approve/Deny/Defer recorded with required reasons;
attestations captured.

### BR-014 Provider self-service application (P0)
Owner: Tech Lead. Acceptance: provider receives invite link (single-active
JWT, 72-h TTL); completes application; uploads documents; submits attestation;
revoked token after submission.

### BR-015 Role-based access control (P0)
Owner: Security. Acceptance: roles `SPECIALIST`, `MANAGER`, `COMMITTEE_MEMBER`,
`ADMIN`, `ROSTER_MANAGER`, `COMPLIANCE_OFFICER`; tRPC procedures enforce
appropriate role; admin-only routes guarded at middleware.

### BR-016 Continuous sanctions monitoring (P0)
Owner: Compliance Officer. Acceptance: OIG + SAM run weekly; state Medicaid
(NY OMIG) screened; flagged matches surface in compliance queue.

### BR-017 Hospital privileges tracking (P1)
Owner: Specialist. Acceptance: per-facility privilege application, approval,
renewal tracked.

### BR-018 OPPE / FPPE periodic and focused evaluations (P1)
Owner: Manager + Committee. Acceptance: semi-annual OPPE and triggered FPPE
recorded; minutes attestation captured.

### BR-019 Staff training & LMS (P1)
Owner: Compliance Officer. Acceptance: annual HIPAA training and platform
training tracked per user; gaps surface on dashboards.

### BR-020 AI governance (P1)
Owner: Tech Lead. Acceptance: every AI-driven decision recorded with model id,
prompt hash, output hash, and reviewer override reason where applicable.

### BR-021 Machine-readable Public Error Catalog & RFC 9457 Problem Details (P1)
Owner: Tech Lead + API Product. Acceptance:
- Every REST v1 error response is `application/problem+json` per **RFC 9457**
  (Problem Details for HTTP APIs), carrying `type`, `title`, `status`,
  `detail`, and `instance`. The legacy `{ "error": { "code", "message" } }`
  envelope is emitted alongside Problem Details for one major version with
  an `x-deprecated: true` marker.
- The `type` URI in every Problem body resolves to a public,
  human-readable description page — the catalog HTML at `/errors/{code}`
  is reachable **anonymously** by any party that holds the URI, per
  RFC 9457 §3.1.1.
- A typed registry at `src/lib/api/error-catalog.ts` is the single source
  of truth for every code; the four faces (TS module, JSON list at
  `GET /api/v1/errors`, JSON entry at `GET /api/v1/errors/{code}`, public
  HTML pages at `/errors` and `/errors/{code}`) stay in lockstep with it.
- Coverage gate: every code emitted by the platform appears in the
  registry, in the OpenAPI 3.1 contract (`docs/api/openapi-v1.yaml`), and
  in at least one contract test (Schemathesis fuzz harness, ADR 0021).
- Anti-regression gate: `tests/e2e/anonymous/pillar-a-public-smoke.spec.ts`
  iterates every `group: "public"` route in `route-inventory.json` and
  asserts an anonymous GET returns 200 (no 307 to `/auth/signin`). This
  is the gate that closed DEF-0007 and that prevents its return.

---

## 6. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | Page load < 2 s for staff pages under normal load |
| NFR-002 | Bot queue handles ≥ 10 concurrent runs without degradation |
| NFR-003 | Uptime ≥ 99.5% during business hours |
| NFR-004 | All PHI encrypted at rest (AES-256-GCM) and in transit (TLS 1.2+) |
| NFR-005 | RBAC enforced at the API layer |
| NFR-006 | Sessions: HttpOnly + Secure + SameSite=Lax; staff idle 30 min, provider 15 min |
| NFR-007 | Audit log immutable (append-only) and tamper-evident (HMAC chain) |
| NFR-008 | Platform supports ≥ 500 concurrent providers |
| NFR-009 | All accessibility checks (axe) pass with no serious/critical violations |
| NFR-010 | Public REST p95 < 200 ms at 50 RPS; FHIR p95 < 400 ms at 20 RPS |
| NFR-011 | CI must pass typecheck, lint, vitest unit + integration, Playwright E2E, axe, forbidden-terms, CodeQL, gitleaks |
| NFR-012 | Disaster recovery: RPO ≤ 24 h, RTO ≤ 8 h |

---

## 7. Out of scope (current cycle)

- Patient-facing features.
- Billing / claims integration.
- Multi-tenant operation for other organizations.
- Native mobile app (responsive web only).
- Telemedicine clinical workflow (only credentialing, IMLC tracking, platform certifications, coverage gap alerts).

---

## 8. Assumptions and dependencies

- Essen IT operates the Entra ID tenant, Azure subscription, and SendGrid /
  ACS accounts.
- Credentialing Operations owns the source-of-truth credential data and
  external-portal access.
- The K: drive remains read-only for 90 days after Phase 4 cutover.
- Provider source data flows from iCIMS via API + webhook; CAQH supplements.

---

## 9. Approval

| Role | Name | Date | Signature |
|---|---|---|---|
| Executive Sponsor | TBD | | |
| Credentialing Manager | | | |
| Tech Lead | | | |
| Compliance Officer | | | |
| IT / DevOps | | | |

---

## 10. Change log

| Date | Version | Change | Author |
|---|---|---|---|
| 2026-04-14 | 0.1 | Initial requirements from planning docs | HDPulse |
| 2026-04-15 | 1.0 | Status updates for implemented modules; added NFRs | Claude Code |
| 2026-04-17 | 2.0 | Documentation refresh — promoted to canonical BRD; added BR-011 through BR-020; aligned with shipped scope | Documentation refresh |
| 2026-04-19 | 2.2 | Documentation refresh (Wave 21 + 21.5) — added BR-021 (machine-readable Public Error Catalog & RFC 9457 Problem Details). Cross-references ADRs 0025, 0026, 0027 and the DEF-0007 closure / DEF-0008 escalation. | Documentation refresh |
