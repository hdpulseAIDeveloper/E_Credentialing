# Status & Workflow Reference

All state machines in the platform. Each diagram is the **single source of
truth** for the corresponding `*-status.ts` service in the codebase.

---

## Provider

```
INVITED
  └─ ONBOARDING_IN_PROGRESS
       └─ DOCUMENTS_PENDING
            └─ VERIFICATION_IN_PROGRESS
                 └─ COMMITTEE_READY
                      └─ COMMITTEE_IN_REVIEW
                           ├─ APPROVED ──► INACTIVE ──► INVITED (re-activate)
                           ├─ DENIED ──► INVITED (re-invite)
                           └─ DEFERRED ──► COMMITTEE_READY (return to queue)
```

Backwards transitions allowed only by `MANAGER`+ with a recorded reason.

---

## Enrollment

```
DRAFT ──► SUBMITTED ──► PENDING_PAYER ──► ENROLLED
                                  └──► DENIED
                                  └──► ERROR
                                  └──► WITHDRAWN
```

`ENROLLED` requires confirmation # and effective date. `DENIED` requires
denial reason ≥ 10 chars.

---

## BotRun

```
QUEUED ──► RUNNING ──► COMPLETED
                  ├──► REQUIRES_MANUAL  (subclass-controlled; never auto-COMPLETED)
                  └──► FAILED  (after exhausted retries) ──► RETRYING (transient)
```

Retry policy default: 3 attempts, exponential backoff 30s / 2m / 8m.

---

## Committee decision

```
PENDING (provider in COMMITTEE_READY)
  ├─ APPROVED
  ├─ APPROVED_WITH_CONDITIONS  (conditions text required)
  ├─ DENIED                    (reason required)
  └─ DEFERRED                  (reason + recheck date required)
```

After session ends, chair attests minutes via one-time email token. Once
attested, decisions are immutable.

---

## Sanctions match

```
NEW (auto from bot) ──► ACKNOWLEDGED  (false positive; closed)
                  └──► ESCALATED  (CMO review)
                  └──► CONFIRMED  (true match — pause privileges if config = on)
```

---

## Expirable

```
TRACKED ──► EXPIRING_SOON ──► EXPIRED  (lapsed without renewal)
                          └──► RENEWED  (rolls forward to new TRACKED row)
```

Notification cadence (days before expiry): 120, 90, 60, 30, 7, 1.

---

## Recredentialing cycle

```
INITIATED (T-180 days) ──► APP_IN_PROGRESS ──► PSV_RUNNING ──► COMMITTEE_REVIEW
                                                                  ├─ APPROVED
                                                                  └─ DENIED
```

---

## Provider invite token

```
ISSUED  ──► CONSUMED  (attestation submitted; token cleared)
       ──► REVOKED   (manual revoke or replaced by new invite)
       ──► EXPIRED   (72-hour TTL)
```

A provider can have at most **one** active token at a time.

---

## API key

```
ACTIVE ──► REVOKED  (manual)
       └──► EXPIRED  (TTL hit; if configured)
```

---

## OPPE / FPPE

OPPE — semi-annual: `SCHEDULED ──► IN_PROGRESS ──► COMPLETED ──► ATTESTED`.
FPPE — triggered: `OPENED ──► IN_PROGRESS ──► COMPLETED ──► ATTESTED ──► CLOSED`.

---

## Hospital privilege

```
APPLIED ──► UNDER_REVIEW ──► GRANTED ──► RENEWAL_DUE ──► RENEWED
                       └─► DENIED
                       └─► WITHDRAWN
```
