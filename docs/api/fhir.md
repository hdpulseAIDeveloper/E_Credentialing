# FHIR R4 Endpoint

The platform publishes a FHIR R4 Practitioner endpoint for compliance with CMS-0057-F (provider directory). Currently read-only.

## Base URL

```
https://credentialing.hdpulseai.com/api/fhir
```

## Capabilities

- FHIR version: R4 (4.0.1).
- Resources: `Practitioner` (search + read).
- Format: `application/fhir+json` (default), `application/json` accepted.
- Conformance URL: `/api/fhir/metadata` (returns `CapabilityStatement`).

## Authentication

Same as REST v1 — `Authorization: Bearer ecred_...`. Requires the `fhir:read` scope.

Errors return FHIR `OperationOutcome` resources with appropriate HTTP status codes.

## Practitioner search

```
GET /api/fhir/Practitioner
```

### Search parameters

| Param | Description |
|-------|-------------|
| `_count` | Page size (default 20, max 100) |
| `_offset` | Offset for pagination |
| `identifier` | NPI, with optional system: `http://hl7.org/fhir/sid/us-npi|1234567890` |
| `family` | Last name (case-insensitive, prefix match) |
| `given` | First name (case-insensitive, prefix match) |
| `active` | `true` or `false` |
| `_lastUpdated` | FHIR date filter (e.g., `ge2026-01-01`) |

### Response: Bundle

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 534,
  "link": [
    { "relation": "self",     "url": "https://.../api/fhir/Practitioner?_count=20" },
    { "relation": "next",     "url": "https://.../api/fhir/Practitioner?_count=20&_offset=20" },
    { "relation": "previous", "url": null }
  ],
  "entry": [
    {
      "resource": {
        "resourceType": "Practitioner",
        "id": "prv-01HF...",
        "active": true,
        "identifier": [
          { "system": "http://hl7.org/fhir/sid/us-npi", "value": "1234567890" },
          { "system": "http://essenhealthcare.com/providerId", "value": "prv_01HF..." }
        ],
        "name": [{ "use": "official", "family": "Doe", "given": ["Jane", "Q"] }],
        "telecom": [{ "system": "email", "value": "jane.doe@essenhealthcare.com" }],
        "qualification": [
          {
            "identifier": [{ "system": "http://essenhealthcare.com/licenseNumber", "value": "12345" }],
            "code": { "text": "State Medical License" },
            "period": { "end": "2028-06-30" },
            "issuer": { "display": "NY Department of Health" }
          }
        ]
      }
    }
  ]
}
```

`total` is the complete match count, not just the page size.

`link.next` is present only if more results exist.
`link.previous` is present only if `_offset > 0`.

## Practitioner read

```
GET /api/fhir/Practitioner/{id}
```

Returns a single `Practitioner` resource. `{id}` is the platform provider id (as returned in the Bundle).

## CapabilityStatement

```
GET /api/fhir/metadata
```

Returns a minimal `CapabilityStatement` describing supported resources, operations, and search parameters.

## PHI exclusion

Practitioner resources never include:

- SSN
- Date of birth
- Home address
- Home phone

Office / business addresses are considered non-PHI and may appear when populated.

## Errors

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "not-found",
      "diagnostics": "Practitioner not found: prv-00000000"
    }
  ]
}
```

| HTTP | code |
|------|------|
| 400 | `invalid` |
| 401 | `security` |
| 403 | `forbidden` |
| 404 | `not-found` |
| 429 | `throttled` |
| 500 | `exception` |

## Compliance notes

This endpoint is intended to meet the CMS-0057-F Provider Directory requirement. It is versioned separately from REST v1 — breaking changes will produce a `Practitioner-v2` or similar resource profile rather than altering the R4 profile in place.

If a regulator requires additional resources (e.g., `Organization`, `HealthcareService`), raise a feature request.
