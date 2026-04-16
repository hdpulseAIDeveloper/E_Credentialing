# API Reference

The ESSEN Credentialing Platform exposes two read-only public APIs:

- **REST v1** — JSON endpoints for integrations.
- **FHIR R4** — Practitioner resources for compliance with CMS-0057-F.

Both share the same authentication (API key), rate limiting, and audit logging.

## Contents

- [Authentication](authentication.md)
- [REST v1 endpoints](rest-v1.md)
- [FHIR R4 endpoint](fhir.md)
- [Error handling](errors.md)
- [Rate limits](rate-limits.md)
- [Audit logging](audit.md)
- [Change log](changelog.md)

## Base URLs

| Environment | REST v1 | FHIR |
|-------------|---------|------|
| Production | `https://credentialing.hdpulseai.com/api/v1` | `https://credentialing.hdpulseai.com/api/fhir` |
| Staging | `https://staging.credentialing.hdpulseai.com/api/v1` | `https://staging.credentialing.hdpulseai.com/api/fhir` |

## Scope

Both APIs are **read-only** by design. There are no write scopes on the public surface.

PHI is not included in public responses. Fields like SSN, date of birth, and home address are stripped regardless of API-key scope.

## Quick start

```bash
curl -H "Authorization: Bearer ecred_..." \
     https://credentialing.hdpulseai.com/api/v1/providers?limit=10
```

```bash
curl -H "Authorization: Bearer ecred_..." \
     https://credentialing.hdpulseai.com/api/fhir/Practitioner?_count=10
```
