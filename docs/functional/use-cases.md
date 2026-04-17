# Use Cases

**Audience:** BAs, QA, Product. Pair with the [FRD](functional-requirements.md)
for screen-level detail.

Each use case follows the structure:

- **Actor**, **Goal**, **Preconditions**, **Trigger**, **Main flow**,
  **Alternate flows**, **Postconditions**, **Acceptance**.

---

## UC-01 Onboard a new provider end-to-end

- **Actors:** Specialist (initiator), Provider (completes), PSV bots (system).
- **Goal:** Move a candidate from "offer accepted" to "committee ready".
- **Preconditions:** Provider has an Essen-issued personal email; assigned
  Specialist has the `SPECIALIST` role.
- **Trigger:** Specialist clicks `+ New Provider` or the iCIMS webhook fires.
- **Main flow:**
  1. Specialist creates the provider record with Provider Type and contact info.
  2. System sends an invite email containing a 72-hour magic link.
  3. Provider opens the link and completes the multi-section application,
     uploads required documents, and submits attestation.
  4. System transitions provider to `DOCUMENTS_PENDING`, revokes the invite
     token, and enqueues PSV bots.
  5. Bots verify license, DEA, boards, education, sanctions, NPDB, and
     malpractice in parallel; results stored as `VerificationRecord` rows with
     PDF artifacts in Blob.
  6. When all verifications complete, Specialist transitions the provider to
     `COMMITTEE_READY`.
- **Alternate flows:**
  - Token expired before provider clicks → Specialist reissues invite.
  - Bot returns `REQUIRES_MANUAL` → Specialist completes manually and resolves.
  - Sanction match → Compliance Officer follows the sanction workflow.
- **Postconditions:** Provider is on the committee queue; audit trail complete.
- **Acceptance:** Provider lifecycle completes within < 18 days median; zero
  bot-state inconsistencies; audit chain verifies.

---

## UC-02 Run a committee session

- **Actor:** Manager (chair), Committee Members.
- **Goal:** Approve / deny / defer queued providers.
- **Preconditions:** ≥ 1 provider in `COMMITTEE_READY`.
- **Main flow:**
  1. Manager creates session with date, type, members, notes.
  2. System auto-populates the agenda with summary sheets per provider.
  3. Committee meets, decisions recorded inline (Approve / Approve-with-conditions / Deny / Defer).
  4. Provider statuses transition; Specialist notified per provider.
  5. Chair attests minutes via one-time email token.
- **Alternate flows:** Defer → returns to queue at recheck date; Deny → audit
  with reason; Approve-with-conditions → conditions stored on
  `CommitteeProvider`.
- **Postconditions:** All decisions persisted; minutes attested.
- **Acceptance:** Committee prep < 15 min; minutes attestation captured for
  100% of sessions.

---

## UC-03 Submit a monthly roster to a payer

- **Actor:** Roster Manager.
- **Preconditions:** New approvals occurred since last submission OR scheduled monthly run.
- **Main flow:**
  1. System auto-generates per-payer roster on the 1st at 03:00 ET into draft.
  2. Roster Manager reviews, validates errors, edits if needed.
  3. Submits via Availity API (where applicable) or SFTP per-payer config.
  4. Records ack message and reconciles per row.
- **Acceptance:** Submissions reach payer; per-row reconciliation matches.

---

## UC-04 Sanctions match found

- **Actor:** System (weekly sweep), Compliance Officer (resolve).
- **Trigger:** OIG / SAM / NY OMIG match returned by sanctions bot.
- **Main flow:**
  1. System creates `SanctionsCheck` with status `FLAGGED`.
  2. Compliance dashboard surfaces the match.
  3. Compliance Officer chooses: Acknowledge (false positive),
     Escalate (CMO review), or Confirm (match).
  4. Confirmed match: provider's clinical privileges paused (configurable);
     CMO notified.
- **Acceptance:** No flagged match remains unresolved > 5 business days.

---

## UC-05 Provider expirable approaching lapse

- **Actor:** System, Specialist, Provider.
- **Trigger:** Daily expirable sweep finds an item entering a notification window.
- **Main flow:**
  1. System emails the provider at 120/90/60/30/7 days; SMS at 1 day.
  2. In-app alert to assigned Specialist at 30/7/1 days.
  3. Provider uploads renewal; Specialist marks renewed; expiry rolled forward.
- **Alternate flows:** Lapses without renewal → optional auto-pause of clinical privileges.
- **Acceptance:** ≥ 95% on-time renewal.

---

## UC-06 Recredential a provider

- **Actor:** System, Specialist, Provider, Committee.
- **Trigger:** Anniversary - 180 days.
- **Main flow:**
  1. Recredentialing cycle initiated; abbreviated application invite sent.
  2. PSV re-run.
  3. Committee re-reviews and approves / denies.
- **Acceptance:** ≥ 99% on-time recredentialing.

---

## UC-07 External integration consumes the public API

- **Actor:** API consumer (trusted partner / payer).
- **Preconditions:** API key issued with required scopes.
- **Main flow:**
  1. Partner calls REST `/api/v1/providers?limit=50` or FHIR
     `/api/fhir/Practitioner?_count=50`.
  2. Middleware validates key, checks scopes, enforces rate limit, writes audit.
  3. Response stripped of PHI fields.
- **Acceptance:** Documented endpoints stable; OpenAPI / FHIR conformance tests pass.

---

## UC-08 Auditor package generation

- **Actor:** Compliance Officer.
- **Trigger:** Auditor request or quarterly snapshot.
- **Main flow:**
  1. Compliance Officer selects criteria and time period.
  2. System generates ZIP containing sampled files, policies bundle,
     committee minutes archive, sanctions logs, training records.
  3. Auditor receives a SAS URL valid for 14 days.
- **Acceptance:** Package regenerates deterministically for the same inputs.

---

## UC-09 Document upload by provider

- **Actor:** Provider.
- **Preconditions:** Active invite token; allowed file type ≤ 25 MB.
- **Main flow:** Drag/drop file → multipart upload → AV scan → Blob storage →
  `Document` row created → checklist linkage attempted → success toast.
- **Alternate flows:** Wrong type / oversize / virus / network — see Messaging Catalog.

---

## UC-10 Re-issue an invite

- **Actor:** Specialist.
- **Main flow:** Click `Resend Invite` → new JWT issued → old token
  invalidated atomically → email sent → audit row.
- **Acceptance:** Old token never validates again.

---

## UC-11 Adopt a new bot

- **Actor:** Engineer.
- **Main flow:** Implement `BotBase` subclass → register → unit + integration
  tests → fixture-based parse tests → add to `TRIGGERABLE_BOT_TYPES` if
  manually triggerable → ship.

---

## UC-12 Rotate the AUDIT_HMAC_KEY

- **Actor:** DevOps.
- **Trigger:** Annual rotation or compromise.
- **Main flow:** Snapshot existing chain → start a new chain root with
  `previous_hash = null` and an annotation row → update env → restart →
  ongoing rows form a new chain.

---

## UC-13 Provide an external work-history verification

- **Actor:** Past employer.
- **Trigger:** Specialist sends verification request → external email with
  one-time token link to `/verify/<token>`.
- **Main flow:** Verifier completes the form; submission persists a
  `WorkHistoryVerification` row; specialist notified.
