# Personas

> Snapshot of the platform's primary users. Each persona lists daily
> activities, top pain points the platform addresses, and key screens.

## 1. Credentialing Specialist — "Maria"

- **Day:** Reviews intake submissions, kicks off PSV bots, chases missing
  evidence, schedules recredentialing tasks.
- **Pain:** Tab-switching across 8+ portals; manual data re-entry; lost PDFs.
- **Top screens:** Provider list, Provider detail (Documents + Verifications
  tabs), Bots, Tasks.
- **Wins from the platform:** Bot framework + auto-classify cuts 70% of
  manual time; one-click re-run; a single bell for all follow-ups.

## 2. Committee Chair — "Dr. Patel"

- **Day:** Pre-reviews files, runs the meeting, signs minutes.
- **Pain:** Files arrived as binders / mixed PDFs; minutes done in Word.
- **Top screens:** Committee → Meeting agenda; Provider summary card.
- **Wins:** All evidence in one place; voting with audit; minutes generated
  from decisions and signed off in app.

## 3. QA / Compliance Lead — "Aisha"

- **Day:** Spot-checks files, owns NCQA prep, responds to delegated audits.
- **Pain:** Hunting for evidence under deadline; reconciling spreadsheets.
- **Top screens:** Compliance dashboard; NCQA criterion catalog; Audit log.
- **Wins:** Auditor packet in minutes; criterion → evidence is automatic.

## 4. Enrollment Specialist — "James"

- **Day:** Submits to Availity, Verity, eMedNY, EyeMed, etc.; chases payer
  reps; preps monthly rosters.
- **Pain:** Each payer has a different flow; rosters break on edge cases.
- **Top screens:** Enrollments by status; Roster runs; Communications inbox.
- **Wins:** Bots cover the high-volume payers; rosters generated from
  canonical data; SFTP push reduces email back-and-forth.

## 5. Provider — "Dr. Lee"

- **Day:** Receives invite email; completes intake; signs attestation;
  responds to occasional update requests.
- **Pain:** Repeating the same data on every payer form; long PDFs.
- **Top screens:** `(provider)/application/*`.
- **Wins:** Mobile-friendly form; data is reused everywhere; status
  visibility via portal.

## 6. Executive Sponsor — "VP Operations"

- **Day:** Reads weekly KPIs, intervenes on stalled files, briefs board.
- **Pain:** No real-time picture of the credentialing pipeline.
- **Top screens:** Executive dashboard; Reports.
- **Wins:** Live dashboards; trend analytics; board-ready exports.

## 7. External Payer / Partner — "Health Plan Engineer"

- **Day:** Pulls provider summaries via REST; consumes the FHIR Practitioner
  endpoint; reconciles rosters.
- **Pain:** Brittle spreadsheets shared by email.
- **Top screens:** API documentation portal; FHIR endpoint.
- **Wins:** Stable, scoped, rate-limited API with predictable contracts.

## 8. Engineer / Admin — "Sam"

- **Day:** Adds bots, fixes broken selectors, rotates secrets, runs deploys.
- **Pain:** None should be unexpected.
- **Top screens:** Admin → API keys / Bots / Settings; Bull Board; metrics.
- **Wins:** Documentation reflects reality; runbooks cover rotations; AI
  decisions are inspectable.
