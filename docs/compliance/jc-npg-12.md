# Joint Commission Medical Staff Standards (NPG-12)

> **Audience:** Compliance officers, Medical Staff Office, surveyors.
>
> **Status:** Wave 3.1 — provisional baseline. The platform supports the
> Joint Commission (TJC) Medical Staff (MS) standards for ongoing /
> focused professional practice evaluation. The implementation here is
> built around the standards listed below; the JC's own scoring rubric
> ("Refinement of the Medical Staff (MS) Chapter Standards" published
> 2017 and amended in subsequent annual updates) is the controlling
> reference for the actual survey.

This document maps the platform's OPPE / FPPE feature surface to the
TJC Medical Staff standards a Credentialing Verification Organization
(CVO) is expected to support on behalf of its accredited customers. It
exists so a JC surveyor can independently verify that the workflow
exists, is auditable, and is enforced by the platform — not just by
local hospital policy.

---

## Standards in scope

| TJC standard | Title | Platform mechanism |
| --- | --- | --- |
| **MS.07.01.03** | Peer recommendation accompanies privileging | `peerReview` router + `/peer-review` UI |
| **MS.08.01.01** | Focused Professional Practice Evaluation (FPPE) | Auto-FPPE on every privilege grant — `EvaluationService.createAutoFppeForPrivilege` |
| **MS.08.01.03** | Ongoing Professional Practice Evaluation (OPPE) | Nightly auto-schedule — `EvaluationService.runAutoOppeSchedule` (cron via `oppe-auto-schedule` BullMQ job) |
| **MS.09.01.01** | Adverse credentialing decisions are reportable | Audit-log + `auditor-package` export (Wave 5.4) |
| **MS.10.01.01** | Practitioners with provisional / temporary status are tracked | `provider.status` workflow + `expirables-scan` worker |

---

## How the platform satisfies each standard

### MS.08.01.01 — Focused Professional Practice Evaluation

**Trigger.** When a `HospitalPrivilege` row transitions to `APPROVED`,
the privileging router calls `createAutoFppeForPrivilege(db, privilegeId)`
which delegates to `EvaluationService`. The service:

1. Looks up the privilege by id.
2. Returns the existing FPPE id if a row already exists for
   `(providerId, privilegeId, evaluationType=FPPE)` — **idempotent**.
3. Computes the period as `[grantDate, grantDate + 90d]` (override-able
   per call).
4. Inserts a `PracticeEvaluation` row with `trigger` populated as
   `Auto-FPPE for newly granted privilege "{type}" at {facility}` and
   `triggerRefId = privilegeId`.
5. Writes an `evaluation.auto_fppe_created` audit-log row attributed
   to `actor=system / role=SYSTEM` so survey reviewers can distinguish
   automated chains of custody from human-initiated FPPEs.

**Evidence path for survey.** `/evaluations?evaluationType=FPPE&status=SCHEDULED`
returns every FPPE pre-scheduled by the system. Each detail view shows
the linked `HospitalPrivilege`, the trigger reason, and the audit-log
entries that created and modified the row.

### MS.08.01.03 — Ongoing Professional Practice Evaluation

**Trigger.** A nightly BullMQ job (`oppe-auto-schedule`, registered in
`src/workers/index.ts`) calls `EvaluationService.runAutoOppeSchedule()`
which:

1. Iterates every `Provider` whose `status='APPROVED'` and who has at
   least one `HospitalPrivilege` with `status='APPROVED'`.
2. For providers with **no OPPE history**, seeds a row covering
   `[now, now + 6 months]`.
3. For providers whose latest OPPE ends within `OPPE_LOOKAHEAD_DAYS`
   (default 30) of `now`, pre-creates the **next-cycle** OPPE
   `[latest.periodEnd + 1d, latest.periodEnd + 1d + 6 months]`.
4. Skips creation when an OPPE for that exact `(providerId, periodStart)`
   already exists — **idempotent**.
5. Writes `evaluation.auto_oppe_created` audit-log rows for both kinds.
6. Per-provider exceptions are caught and counted in the `errors` field
   of the run summary; one bad provider does **not** stop the sweep.

**Evidence path for survey.** `/evaluations?evaluationType=OPPE` should
always show a SCHEDULED row covering the current period for every
provider with active privileges. The dashboard summary cards on that
page surface `Scheduled / In Progress / Overdue / Completed This Month`.

**Cadence override.** `OPPE_AUTO_SCHEDULE_DISABLED=true` in the worker
env disables the cron (used by tests and during planned maintenance).
`OPPE_PERIOD_MONTHS` is hard-coded to 6 in the service; per-specialty
overrides land in Wave 3.4 alongside the `evaluations[id]` detail UI.

### Audit chain of custody

Every OPPE / FPPE state change writes a row to `audit_logs` with the
HMAC-chained tamper-evident signature described in
[`docs/compliance/audit.md`](audit.md). Surveyors can request the audit
chain for a specific provider via the auditor package (Wave 5.4).

---

## What is **not** yet implemented

- **Per-specialty OPPE cadence overrides.** Today every approved
  practitioner is on the standard 6-month cycle. Wave 3.4 adds a
  per-`providerType` override table.
- **OPPE detail / drill-down view.** The `/evaluations` list links to
  the provider page; a dedicated `/evaluations/[id]` route with
  indicators chart + finding form is queued for Wave 3.4.
- **Auditor package one-click export.** The bundle of every OPPE / FPPE
  row + audit chain + provider snapshot for a given date range lands
  in Wave 5.4 (`docs/compliance/auditor-package.md`).
- **Peer-recommendation evidence link** for MS.07.01.03 is rendered on
  the provider page but does not yet surface in the auditor package.
  Tracked as a Wave 5.4 follow-up.

---

## Test surface

| Layer | Spec | What it asserts |
| --- | --- | --- |
| Unit | `tests/unit/server/services/evaluation-service.test.ts` | All CRUD, auto-FPPE idempotency, auto-OPPE seed + next-cycle + skip + per-provider error isolation. |
| E2E (compliance) | `tests/e2e/compliance/jc-npg-12.spec.ts` | `/evaluations` reachable, OPPE+FPPE filter chips visible, trpc stack healthy. Tagged `@jc-npg-12` for the §4 hard-fail gate. |
| E2E (RBAC) | `tests/e2e/all-roles/pillar-b-rbac.spec.ts` | Only staff roles can access `/evaluations`. |
| Per-screen card | `docs/qa/per-screen/evaluations.md` | Manual coverage matrix. |
| Per-flow card | `docs/qa/per-flow/oppe-fppe-cycle.md` | End-to-end OPPE/FPPE lifecycle. |

---

## References

- The Joint Commission, *Comprehensive Accreditation Manual for
  Hospitals*, MS chapter (annual edition).
- TJC R3 Report, *Refinement of the Medical Staff (MS) Chapter
  Standards*, Issue 8 (2017) and subsequent annual amendments.
- NCQA, *2026 CR Standards*, CR-7 (provisional credentialing) cross-
  references TJC MS chapter for hospital-employed practitioners.
