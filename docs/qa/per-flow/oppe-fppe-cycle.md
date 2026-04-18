# Per-flow card: OPPE / FPPE lifecycle

> **STANDARD.md §5 (per-flow).** End-to-end professional practice
> evaluation lifecycle for a credentialed practitioner with active
> hospital privileges. Anchors the Joint Commission NPG-12 evidence
> chain — see [`docs/compliance/jc-npg-12.md`](../../compliance/jc-npg-12.md).

| Field | Value |
| --- | --- |
| Flow id | `flow.oppe-fppe-cycle` |
| Owner | Medical Staff Office × Engineering |
| Standards covered | TJC MS.07.01.03, MS.08.01.01, MS.08.01.03; NCQA CR-7 (provisional) |
| Trigger surfaces | Provider approval + privilege grant (UI), `oppe-auto-schedule` worker (cron) |
| Service of record | `src/server/services/evaluation.ts` (`EvaluationService`) |

## Lifecycle

```
                  Provider APPROVED
                         │
                         ▼
              Hospital privilege APPROVED
                         │
                         ├──────────────┐
                         ▼              ▼
            (1) Auto-FPPE created   (2) Provider becomes
                90-day window           OPPE-eligible
                                        │
                         (cron, nightly)│
                                        ▼
                         (3) Auto-OPPE current cycle
                              created if missing
                                        │
                         (cron, nightly)│
                                        ▼
                         (4) Auto-OPPE next cycle
                              pre-scheduled when
                              within lookahead (30d)
                                        │
                                        ▼
                         (5) Staff completes evaluation
                              → COMPLETED + completedAt
                                        │
                                        ▼
                         (6) Audit chain frozen
                              (HMAC-signed)
```

## Step-by-step

### (1) Auto-FPPE on privilege grant — MS.08.01.01

- Trigger: `provider.privilegeApprove` (and equivalent `provider.privilegeCreate`
  with `status='APPROVED'`) calls `createAutoFppeForPrivilege` from
  `src/lib/fppe.ts`, which delegates to `EvaluationService`.
- Behavior: idempotent. Re-running on the same privilege returns the
  existing FPPE id.
- Audit: `evaluation.auto_fppe_created`, actor `system`.

### (2) OPPE eligibility

- Provider must be `status='APPROVED'` AND have at least one
  `HospitalPrivilege` with `status='APPROVED'`. Eligibility is recomputed
  on every nightly sweep — no eligibility table.

### (3) Initial OPPE cycle

- Created by the first nightly sweep that finds a freshly-eligible
  provider with no OPPE history.
- Period: `[now, now + OPPE_PERIOD_MONTHS]` (default 6 months).
- Trigger label: `Auto-scheduled OPPE — initial cycle`.

### (4) Next-cycle OPPE pre-creation

- When the latest OPPE for a provider has `periodEnd ≤ now + OPPE_LOOKAHEAD_DAYS`
  (default 30), the next cycle is created with
  `periodStart = latest.periodEnd + 1d`.
- Idempotent: a `findFirst` on `(providerId, evaluationType=OPPE, periodStart)`
  returns the existing row if rerun.

### (5) Manual completion

- Staff (any) → `evaluation.update({ id, status: "COMPLETED", findings, recommendation })`.
- Service stamps `completedAt = now()`.
- Reopens are blocked: `EvaluationService.update` rejects any transition
  away from `COMPLETED` with `412 PRECONDITION_FAILED`.

### (6) Audit immutability

- Every state transition writes a row through
  `writeAuditLog` (HMAC-chained, see `docs/compliance/audit.md`).
- The only delete path is `evaluation.delete` — restricted to
  managers, restricted to `SCHEDULED` rows, and itself audited.

## Failure modes & alarms

| Failure | Detection | Mitigation |
| --- | --- | --- |
| Cron skipped (`oppe-auto-schedule` paused) | Bull Board `Repeatable Jobs` view shows last run; `getDashboard.scheduled` count drops. | Re-enable via env (`OPPE_AUTO_SCHEDULE_DISABLED=false`); rerun job manually from Bull Board. |
| Per-provider exception | `runAutoOppeSchedule` summary `errors > 0`; logged as `[EvaluationService.runAutoOppeSchedule] error for provider …`. | Errors are isolated; sweep continues. Triage from worker logs. |
| Privilege grant missed auto-FPPE | `createAutoFppeForPrivilege` returns `null` (privilege not found) or no FPPE row exists for an `APPROVED` privilege. | Manager-only rescue: `evaluation.createAutoFppeForPrivilege` mutation. |
| OPPE / FPPE accumulating in `OVERDUE` | Dashboard summary card on `/evaluations`. | Operational; not auto-resolved. Staff workflow. |

## Test surface

- Unit: `tests/unit/server/services/evaluation-service.test.ts` (19 cases)
- Compliance E2E: `tests/e2e/compliance/jc-npg-12.spec.ts` (3 cases)
- Per-screen: [`docs/qa/per-screen/evaluations.md`](../per-screen/evaluations.md)
- Worker integration: covered by `tests/integration/workers/scheduled-jobs.test.ts`
  (Wave 4.1 — telemetry will add Sentry-backed alarms for `errors > 0`).

## Last verified

2026-04-18 — Wave 3.1 service-layer extraction + JC NPG-12 evidence
backfill.
