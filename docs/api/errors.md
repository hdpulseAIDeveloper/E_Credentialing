# Error Handling

## REST v1 error shape

```json
{
  "error": {
    "code": "not_found",
    "message": "Provider not found",
    "requestId": "req_01HF...",
    "details": { }
  }
}
```

- `code` — stable machine-readable code, lower_snake_case.
- `message` — short human-readable description.
- `requestId` — correlate with server logs.
- `details` — optional structured data for specific errors.

## HTTP status codes

| Status | Meaning | Typical `code` values |
|--------|---------|------------------------|
| 400 | Bad request | `invalid_query`, `invalid_cursor` |
| 401 | Unauthorized | `unauthorized`, `invalid_key` |
| 403 | Forbidden | `forbidden`, `scope_required` |
| 404 | Not found | `not_found` |
| 409 | Conflict | `conflict` |
| 429 | Rate limited | `rate_limited` |
| 500 | Server error | `internal_error` |
| 503 | Dependency unavailable | `unavailable` |

## FHIR error shape

Always an `OperationOutcome`:

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

FHIR `issue.code` follows the standard FHIR code set. When the underlying REST code does not map cleanly, FHIR errors use the closest FHIR code and include the original `code` in the `diagnostics` text.

## Retrying

- 429 and 503 are safe to retry after a backoff. Honor the `Retry-After` header when present (seconds).
- 4xx errors other than 429 are not retriable without changes.
- 5xx errors may be retried with backoff.

## Debugging

Include the `requestId` (from the error body) or the `x-request-id` response header when opening a support ticket. Server-side logs are indexed by that ID.
