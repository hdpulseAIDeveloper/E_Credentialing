# Validation Rules Library

The platform validates input in **two places**:

1. The browser, via react-hook-form + zod resolver (immediate feedback).
2. The server, via the same zod schemas attached to tRPC procedures or
   API routes (defense in depth — never trust client-side validation alone).

This document is the canonical source for the rules. Engineers reference them
by key. Messages live in [messaging-catalog.md](messaging-catalog.md).

---

## Common patterns

| Pattern | Rule |
|---|---|
| Names | 2–60 chars; allowed letters, spaces, hyphen, apostrophe, period |
| Email | RFC 5322 valid; ≤ 254 chars; lowercased on store |
| Phone (US) | 10 digits; or E.164 with `+1` country code |
| URL | RFC 3986; HTTPS required for external integrations |
| Date | ISO 8601; reasonable range (1900–01–01 to today + 50 years unless overridden) |
| Currency | Non-negative; up to 2 decimal places; ISO 4217 currency code |
| ID strings | UUID v4 or platform-generated `cuid2` |

---

## Domain identifiers

### NPI (National Provider Identifier)
- Format: exactly 10 digits.
- **Checksum:** Luhn over the first 9 digits with prefix `80840`. The 10th
  digit must equal the calculated check digit. Invalid NPIs are rejected with
  message key `npi.checksum`.
- Uniqueness: among active providers; deactivated providers may share an NPI
  if reactivated only one is allowed at a time.

### DEA number
- Format: 2 letters + 7 digits. First letter is the registrant type
  (A, B, F, M, P, R), second letter is the first letter of the registrant's
  surname.
- **Checksum:** sum of digits at positions 1, 3, 5 plus 2 × (digits at
  positions 2, 4, 6); the last digit of the result must equal digit 7.

### CAQH ID
- 8-digit numeric.

### iCIMS ID
- Alphanumeric, 6–20 chars, case-insensitive.

### License number
- Free-text; per-state validation rule lookup table maintained in
  `src/lib/validators/licenses.ts`.

### TIN / EIN
- 9 digits; format `XX-XXXXXXX` accepted on input, stored without dash.

### NUCC taxonomy code
- 10 chars alphanumeric; checked against the embedded taxonomy table
  refreshed annually.

---

## Free-text limits

| Field | Max chars |
|---|---|
| Internal notes | 8000 |
| Communication body | 8000 |
| Task description | 2000 |
| Denial reason | 2000 |
| Conditions text | 2000 |
| Audit reason | 1000 |

---

## File upload rules

| Rule | Value |
|---|---|
| Allowed types | PDF, PNG, JPG (MIME-sniffed; not just extension) |
| Max per-file size | 25 MB |
| Max per-session size | 200 MB |
| Virus scanning | Required (ClamAV or Azure Defender for Storage) |
| Naming | Slugified original; bot-generated files follow legacy K: drive convention |
| Storage path | `/providers/{providerId}/{folder}/{filename}` |

---

## Auth & session rules

| Rule | Value |
|---|---|
| Staff session idle timeout | 30 minutes |
| Provider portal idle timeout | 15 minutes |
| Staff session absolute lifetime | 7 days (force re-auth) |
| Provider invite token TTL | 72 hours |
| API key prefix | `ecred_` followed by 32 chars from URL-safe alphabet |
| API key storage | SHA-256 hash only |
| Password (local dev only) | ≥ 12 chars, mixed case, number, symbol; bcrypt cost 12 |

---

## Rate limits

| Surface | Limit |
|---|---|
| `/api/v1/*` per API key | 60 requests / minute (configurable) |
| `/api/fhir/*` per API key | 60 requests / minute (configurable) |
| `/api/upload` per provider token | 30 uploads / hour |
| `/auth/signin/credentials` (dev) | 5 / minute / IP |

---

## Bot input rules

| Rule | Value |
|---|---|
| Triggerable types | Listed in `TRIGGERABLE_BOT_TYPES` (`src/server/api/routers/bot.ts`) |
| Manual trigger cooldown | 60 seconds per provider per type |
| Idempotency window for sanctions sweep | 24 hours |
| Required secrets | resolved from Key Vault just-in-time; missing secret fails the bot |

---

## Numeric ranges

| Field | Range |
|---|---|
| Provider age (derived from DOB) | 18–110 |
| License expiry | today − 30 days to today + 10 years |
| Effective date (enrollment) | today − 365 days to today + 365 days |
| OPPE / FPPE recheck date | today + 1 day to today + 365 days |
| Days waiting (filter) | 0–9999 |

---

## Domain reference data

The following lookups are seeded and admin-managed:

- `ProviderType` (MD, DO, PA, NP, LCSW, LMHC, …) — admin can add/inactivate.
- `Payer` — name, type, methods supported.
- `Facility` — Essen sites for hospital privileges.
- `Specialty` — used for privileging library and analytics.
- `Board` — boards used for board certification PSV.
- `State` — US states + DC + PR + VI + GU + AS + MP.

Foreign-key constraints reject input that does not exist in lookup tables.

---

## Cross-references

- Status transitions: [status-workflows.md](status-workflows.md)
- User-facing copy: [messaging-catalog.md](messaging-catalog.md)
- Field-level FRD detail: [functional-requirements.md](functional-requirements.md)
