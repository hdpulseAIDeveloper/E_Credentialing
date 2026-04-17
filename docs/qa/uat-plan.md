# User Acceptance Testing (UAT) Plan

**Audience:** Cred Ops, Enrollment, Committee, QA, Product, Sponsor.

UAT confirms that the platform supports real-world workflows end-to-end with
real (or realistic) data and users. It is run on **staging**, never on
production.

## Participants

| Role | Count | Source |
|---|---|---|
| Credentialing Specialist | ≥ 2 | Cred Ops team |
| Enrollment Specialist | ≥ 1 | Enrollment team |
| Committee Chair | 1 | Committee |
| QA Lead | 1 | QA |
| Sponsor delegate | 1 | Operations |

## Schedule

- **Window:** 5 business days minimum per release that touches user flows.
- **Daily standup** at 09:30 ET to triage findings.
- **Sign-off** at end of window: Sponsor delegate + Cred Ops + QA Lead.

## Entry criteria

- All CI gates green on the candidate build.
- Build deployed to staging.
- Test data seeded, including ≥ 25 fixture providers across statuses.
- Known issues list circulated.

## Exit criteria

- All Critical and High defects fixed and re-tested.
- Medium defects either fixed or accepted with ticket + owner + ETA.
- Low defects logged for the backlog.
- Sign-off recorded in `docs/testing/` Master Test Plan XLSX.

## Scenario library (must pass)

### S-01 — Onboard a new provider end-to-end
1. Cred Ops creates a Provider (or receives via iCIMS webhook).
2. Provider receives invite email (use mailtrap on staging).
3. Provider completes intake on a phone-sized browser; uploads PDF, JPG.
4. Cred Ops reviews submission, kicks off all bots, confirms results.
5. Sanctions clean; NPDB clean; license verified.
6. File reaches "Ready for Committee".

**Pass:** all sub-steps complete with no errors; audit entries present.

### S-02 — Run a committee meeting
1. Chair schedules meeting with quorum.
2. Members vote per provider (Approve / Defer / Decline).
3. Minutes auto-draft; chair signs; minutes locked.

**Pass:** locked minutes downloadable as PDF; audit recorded.

### S-03 — Generate and submit a roster
1. Enrollment chooses payer + month.
2. Roster preview matches expectations; attestation submitted.
3. SFTP push succeeds (sandbox).

**Pass:** delivery confirmed; attestation visible.

### S-04 — Sanctions match triage
1. Sweep ingests fixture list with a planted match.
2. Reviewer opens match, dismisses with reason.
3. Notification cleared; audit recorded.

### S-05 — Recredentialing cycle
1. Trigger a cycle for a provider.
2. Items appear with due dates; Cred Ops walks through completion.
3. Cycle completes; status updates.

### S-06 — Public API consumption
1. Admin creates an API key with `provider:read` scope.
2. Partner runs `GET /api/v1/providers` from Postman / Bruno.
3. Confirm rate limit at 60/min; SSN / DOB never returned.

### S-07 — FHIR consumption
1. Same key used for `/api/fhir/Practitioner?npi=...`.
2. Returned bundle conforms to FHIR R4.

### S-08 — Provider intake — invalid file
1. Provider attempts to upload a `.exe`.
2. Friendly error displayed.
3. Audit row records the rejection.

### S-09 — Telehealth state add
1. Add MA, NJ, CT to a provider.
2. Each license tracked with expiration.
3. Expirable items surface in dashboard.

### S-10 — Audit chain verifier
1. QA runs `npm run audit:verify` against staging DB.
2. Expected output: OK; chain length matches anchor.

### S-11 — Behavioral health PSV
1. Cred Ops processes a BH provider.
2. NCQA BH PSV requirements satisfied.

### S-12 — Peer review
1. Open peer review intake; finding entered.
2. RCA + CAP completed.
3. Closeout recorded; provider notified.

### S-13 — AI auto-classify
1. Provider uploads a document; AI suggests classification.
2. Reviewer accepts; decision log records the outcome.

### S-14 — Notifications & inbox
1. Email arrives via SendGrid Inbound Parse linked to thread.
2. SMS sends successfully; delivery webhook recorded.

### S-15 — Admin: API key rotation
1. Admin creates a key; revokes after rotation.
2. Old key returns 401 immediately.

### S-16 — Accessibility
1. Lead a keyboard-only walk-through of provider detail and committee meeting.
2. Screen reader announces all primary controls.

### S-17 — Performance walkthrough
1. With ≥ 100 providers seeded, browse list, detail, and dashboard.
2. No page TTFB > 2 s.

### S-18 — Disaster recovery walk-through (table-top)
1. Sec + DevOps walk through restore from snapshot.
2. RPO ≤ 24h, RTO ≤ 8h confirmed in writing.

### S-19 — Education PSV
1. Trigger Education PSV bot.
2. AMA Masterfile + ECFMG sources verified; evidence captured.

### S-20 — One-click NCQA evidence
1. QA generates an NCQA evidence package for a sample provider.
2. Auditor-friendly ZIP downloads with index PDF.

## Defect handling

See [defect-management.md](defect-management.md). Each defect created during
UAT must include: scenario id, expected vs. actual, browser, screenshot,
severity.
