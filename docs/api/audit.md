# API Audit Logging

Every API call against the public REST v1 and FHIR endpoints is audited.

## What is recorded

Each request writes an `AuditLog` entry with:

- `apiKeyId` — the key that made the call (never the plaintext key).
- `timestamp` — server time to millisecond precision.
- `method` — HTTP method.
- `path` — full path including any dynamic segment.
- `query` — sanitized query string.
- `ipAddress` — caller IP.
- `userAgent` — client user-agent header.
- `status` — HTTP status returned.
- `resultCount` — for list endpoints, the number of records returned.
- `durationMs` — server-side handling time.
- `requestId` — correlation id shared with the response header.

## Not recorded

- The plaintext API key (only `apiKeyId`).
- Request bodies (irrelevant; all endpoints are GET-only).
- Response bodies (irrelevant; no PHI escapes the public surface).
- Authorization header (stripped by redaction before logging).

## Retention

Audit entries are retained for **7 years** per NCQA CVO standards. They cannot be modified or deleted — the DB revokes UPDATE/DELETE on the `audit_logs` table, and an HMAC chain links each entry to the previous one for tamper detection.

## Consumer access

Admins can review API activity under **Administration → Audit Log** filtered by API key.

## Alerts

The Compliance team is alerted on:

- 401s above baseline (potential credential stuffing)
- 429s above baseline (potential consumer misconfiguration or abuse)
- Impossible travel patterns on the same key
- Sudden surges in a previously-quiet key (possible leaked credential)

## Retrieving your own usage

If you are the integration owner, ask your Essen Integration Manager for a CSV of recent activity. We do not expose the audit log via the public API.
