# PHI Data Map

Where PHI lives across the platform, and how it is protected at each stop.

## Fields classified as PHI

| Field | Table | Protection |
|-------|-------|-----------|
| Social Security number | `providers.ssn` | AES-256-GCM at app layer; masked in UI; reveal audited |
| Date of birth | `providers.dateOfBirth` | AES-256-GCM at app layer; masked to year in lists |
| Home address line 1 | `providers.homeAddressLine1` | AES-256-GCM |
| Home address line 2 | `providers.homeAddressLine2` | AES-256-GCM |
| Home city | `providers.homeCity` | AES-256-GCM |
| Home state | `providers.homeState` | AES-256-GCM |
| Home zip | `providers.homeZip` | AES-256-GCM |
| Home phone | `providers.homePhone` | AES-256-GCM |
| Uploaded document content | Azure Blob Storage | Private container, short-lived SAS, AV-scanned |
| PSV evidence PDF | Azure Blob Storage | Same as above |
| NPDB query response | Azure Blob Storage | Same as above |

## Fields not classified as PHI (in this context)

- Legal name
- NPI, DEA, CAQH, PTAN, Medicaid IDs
- Work email, business phone
- License numbers and states
- Board certifications
- Hospital affiliations
- Work history (employers, dates)
- Committee decisions

These are professional identifiers and public or quasi-public information; they are still access-controlled but not encrypted at rest at the application layer.

## Where PHI flows

```
Provider input form
       │
       ▼
POST /api/application/save-section
       │ encrypt() at route boundary
       ▼
DB (ciphertext)
       │
       ├──► Committee summary sheet PDF (rendered with redaction)
       ├──► Audit log snapshot (redacted before write)
       ├──► CSV export (masked; unmasked requires Manager + reason)
       └──► Public API (PHI explicitly excluded from response shape)
```

## Where PHI does NOT flow

- `console.log` / `logger.info`: pino redact paths strip PHI automatically.
- Error tracking: Sentry `beforeSend` drops known PHI paths.
- Public REST v1 and FHIR: PHI excluded from all response shapes.
- Bot-to-external-site transmission: only identifiers needed for verification (NPI, license number, name) — not SSN, DOB, or home address.

## Testing

Each PHI field has coverage in:

- Unit test (encrypt / decrypt round-trip, looks-like-ciphertext).
- Integration test (DB row contains ciphertext, not plaintext).
- E2E test (value shown masked in UI; reveal produces audit entry).
- API test (value absent from public responses).

## Change process

Adding a PHI field:

1. Add to `schema.prisma` with a `// PHI: encrypted` comment.
2. Update `encrypt()` call sites in the writing service.
3. Update `redactForLog` and `pino` redact paths.
4. Update public API response shape to exclude.
5. Update export masking.
6. Update this data map.
7. Add unit + integration tests.

A reviewer should ensure all 7 steps happen in the same PR.
