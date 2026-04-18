# Per-flow card: Telehealth & IMLC Expirables sync

## Purpose

Mirror per-platform telehealth certifications and the IMLC Letter of
Qualification onto the central `/expirables` deadline radar so staff
have ONE place to see everything that ages.

## Architecture

```
TelehealthPanel (UI)              Nightly worker
        │                                │
        ▼                                ▼
telehealth.upsertCert /     runTelehealthComplianceCheck
telehealth.updateImlcRecord            │
        │                                ▼
        ▼                  TelehealthExpirablesService.syncAll()
telehealth.syncExpirables  ──────────────┐
        │                                │
        ▼                                ▼
 TelehealthExpirablesService.syncProvider(providerId)
        │
        │  1. fetch TelehealthPlatformCert[] + ProviderProfile.imlcLoqExpiresAt
        │  2. computeDesiredTelehealthExpirables() → DesiredExpirable[]
        │  3. fetch existing Expirables in (TELEHEALTH_PLATFORM_CERT, IMLC_LOQ)
        │  4. reconcile() → {toCreate, toUpdate, toDelete}
        │  5. apply via Prisma create/update/deleteMany
        ▼
   Expirable rows (visible on /expirables)
```

## Data model

Two new `ExpirableType` enum values landed in
`prisma/migrations/20260418000000_add_telehealth_expirable_types/`:

| Value | Source |
| --- | --- |
| `TELEHEALTH_PLATFORM_CERT` | One row per `TelehealthPlatformCert` whose `status = 'CERTIFIED'` and `expiresAt IS NOT NULL`. |
| `IMLC_LOQ` | One row per provider whose `ProviderProfile.imlcLoqExpiresAt IS NOT NULL`. |

Source-key tracking uses a sentinel URI in the existing
`Expirable.screenshotBlobUrl` column:
`telehealth-expirable://cert:<id>` or
`telehealth-expirable://loq:<providerId>`. This avoids a schema change
for the matching column; once a proper `sourceKey` column lands
(Wave 5.x) the sentinel is deleted.

## Idempotency

The `reconcile()` helper is pure and matches by `sourceKey`. Running
the sync twice produces zero churn. Rows that were not created by this
service (no sentinel URI in `screenshotBlobUrl`) are never touched.

## Audit chain

- `telehealth.expirables.synced` is appended to the HMAC-chained
  audit log on every `syncExpirables` mutation.
- The nightly worker logs a structured summary line:
  `[TelehealthCompliance] expirables(c=N u=N d=N)`.

## Failure modes

| Mode | Behavior |
| --- | --- |
| Provider has zero platform certs and no LoQ | No-op (`{created:0, updated:0, deleted:0}`). |
| Cert moves CERTIFIED → REVOKED | Next sync deletes the matching Expirable row (orphan reconcile). |
| LoQ expiry cleared | Next sync deletes the IMLC_LOQ row. |
| LoQ expiry changed | Next sync updates the row's `expirationDate` + `nextCheckDate`. |
| Manual Expirable row in same bucket | Untouched (no sentinel match). |

## Test surface

- `tests/unit/server/services/telehealth-expirables.test.ts` — pure
  helpers (10 cases): `sourceSentinel` round-trip, `computeDesiredTelehealthExpirables`
  filtering, `reconcile` create / update / no-op / orphan-delete /
  manual-row-untouched.
- `tests/unit/lib/telehealth.test.ts` — IMLC eligibility & coverage
  helpers.
- Pillar A smoke + Pillar B RBAC E2E for `/expirables`.

## Last verified

2026-04-18 — Wave 3.4 buildout.
