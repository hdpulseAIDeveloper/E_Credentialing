# REST v1 Endpoints

All endpoints are GET-only. JSON response bodies. Authentication per [authentication.md](authentication.md).

## List providers

```
GET /api/v1/providers
```

### Query parameters

| Name | Type | Description |
|------|------|-------------|
| `limit` | int (1..100, default 25) | Page size |
| `cursor` | string | Opaque pagination cursor from previous response |
| `status` | string | Filter by provider lifecycle status |
| `type` | string | Provider type abbreviation (MD, DO, PA, NP, LCSW, LMHC) |
| `state` | string | Two-letter state where provider holds an active license |
| `updated_since` | ISO8601 | Only providers modified since this timestamp |

### Response

```json
{
  "items": [
    {
      "id": "prv_01HF...",
      "type": "MD",
      "firstName": "Jane",
      "lastName": "Doe",
      "middleName": "Q",
      "npi": "1234567890",
      "primarySpecialty": "Internal Medicine",
      "status": "APPROVED",
      "approvedAt": "2025-09-01T14:22:31Z",
      "workEmail": "jane.doe@essenhealthcare.com",
      "licenses": [
        { "state": "NY", "number": "12345", "expiresOn": "2028-06-30", "status": "ACTIVE" }
      ],
      "boardCertifications": [
        { "board": "ABIM", "specialty": "Internal Medicine", "expiresOn": "2029-12-31" }
      ],
      "enrollments": [
        { "payer": "Anthem", "type": "delegated", "state": "ACTIVE", "effectiveDate": "2025-10-01" }
      ]
    }
  ],
  "nextCursor": "opaque-string-or-null"
}
```

PHI fields (SSN, DOB, home address, home phone) are never returned.

## Get one provider

```
GET /api/v1/providers/{id}
```

Returns a single object with the same shape as an item in the list response. Returns `404` if the ID is not found (or the caller does not have scope).

## List sanctions checks

```
GET /api/v1/sanctions
```

### Query parameters

| Name | Type | Description |
|------|------|-------------|
| `limit` | int | Page size |
| `cursor` | string | Pagination cursor |
| `provider_id` | string | Filter to one provider |
| `source` | string | `OIG` or `SAM` |
| `flagged` | boolean | Only return flagged results |
| `since` | ISO8601 | Results run on or after this time |

### Response

```json
{
  "items": [
    {
      "id": "snc_01HF...",
      "providerId": "prv_01HF...",
      "source": "OIG",
      "runAt": "2026-04-14T02:04:17Z",
      "result": "CLEAN",
      "flagged": false
    }
  ],
  "nextCursor": null
}
```

## List enrollments

```
GET /api/v1/enrollments
```

### Query parameters

| Name | Type | Description |
|------|------|-------------|
| `limit` | int | Page size |
| `cursor` | string | Pagination cursor |
| `provider_id` | string | Filter |
| `payer` | string | Filter by payer name |
| `state` | string | Filter by enrollment state (ACTIVE, TERMINATED, etc.) |

### Response

```json
{
  "items": [
    {
      "id": "enr_01HF...",
      "providerId": "prv_01HF...",
      "payer": "Anthem",
      "type": "delegated",
      "state": "ACTIVE",
      "submittedAt": "2025-09-15T12:00:00Z",
      "effectiveDate": "2025-10-01",
      "eftStatus": "ACTIVE",
      "eraStatus": "ACTIVE"
    }
  ],
  "nextCursor": null
}
```

## Pagination

All list endpoints use opaque cursor pagination:

- First call: omit `cursor`.
- Use `nextCursor` from each response as `cursor` on the next call.
- When `nextCursor` is `null`, you have reached the end.

Limits: 25 default, 100 max.

## Consistency

- Responses are near real-time (< 1 minute lag).
- Pagination cursors are stable for at least 24 hours.
- Once a record is returned in a list, it will remain accessible via its detail endpoint (no soft-deletes in public API).
