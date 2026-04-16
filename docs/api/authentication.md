# API Authentication

Both REST v1 and FHIR use **API key** authentication via the `Authorization: Bearer <key>` header.

## Obtaining a key

Keys are issued by an Admin via **Administration → Integrations → API Keys**. The UI prompts for:

- Friendly name (e.g., "Billing team — directory sync")
- Scopes (see below)
- Optional expiration date
- Optional IP allowlist

The UI shows the plaintext key **once** at creation. Store it securely (e.g., Key Vault, password manager). The server keeps only a SHA-256 hash.

## Key format

```
ecred_<32 alphanumeric characters>
```

Example:
```
ecred_abc123XYZ789...
```

The prefix `ecred_` is a stable identifier; keys are recognizable even in log lines (though the full key is never logged — only the prefix and the last 4 chars are ever written).

## Scopes

| Scope | What it allows |
|-------|----------------|
| `providers:read` | `GET /api/v1/providers`, `GET /api/v1/providers/{id}` |
| `sanctions:read` | `GET /api/v1/sanctions` |
| `enrollments:read` | `GET /api/v1/enrollments` |
| `fhir:read` | `GET /api/fhir/Practitioner`, `GET /api/fhir/Practitioner/{id}` |

No write scopes exist on the public API.

## Using the key

```
GET /api/v1/providers
Host: credentialing.hdpulseai.com
Authorization: Bearer ecred_abc123XYZ789...
```

## Rotating

Admins can rotate a key any time:

1. Create a new key with the same scopes.
2. Roll the new key out to consumers.
3. Revoke the old key.

Old keys are never reusable once revoked.

## Errors

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `unauthorized` | Missing or malformed header |
| 401 | `invalid_key` | Key not found or revoked |
| 403 | `forbidden` | Valid key, insufficient scope |
| 429 | `rate_limited` | Too many requests (see [rate-limits.md](rate-limits.md)) |

For FHIR, errors are wrapped in `OperationOutcome`:

```json
{
  "resourceType": "OperationOutcome",
  "issue": [
    {
      "severity": "error",
      "code": "security",
      "diagnostics": "Missing or invalid API key"
    }
  ]
}
```

## Security notes

- Keys are stored as SHA-256 hashes. We cannot recover a lost key — issue a new one.
- Every authenticated call writes an `AuditLog` entry with `apiKeyId`, endpoint, status, and result count.
- Suspicious patterns (spike in 401s, impossible travel on IP) trigger an alert to Security.
- TLS 1.2+ required. Keys sent over plaintext HTTP are rejected and flagged as a security incident.
