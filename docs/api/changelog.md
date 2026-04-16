# API Change Log

Each entry is a published change to either REST v1 or the FHIR endpoint.

Guarantees:

- **No breaking changes to REST v1**. Additions only. A breaking change would be released as REST v2 on a parallel path.
- **FHIR** tracks FHIR R4. Additions are compatible; any divergence is released as a separate profile and endpoint.
- A minimum of **90 days notice** is given before deprecating any endpoint or field.

## 2026-04-16

- REST v1: sensitive PHI fields (`ssn`, `dateOfBirth`) explicitly filtered from all responses, even when returned as part of a legacy record shape.
- REST v1: every endpoint now writes an audit entry (method, path, status, result count).
- FHIR: `Practitioner` Bundle `total` now reflects the full match count rather than the page size.
- FHIR: added `link.previous` relation to Bundles when `_offset > 0`.
- FHIR: errors now wrap in `OperationOutcome` with appropriate status codes and FHIR codes.
- REST v1 + FHIR: rate limits (default 60/min per key) applied; 429 responses honored with `retry-after`.

## Earlier

Initial launch of REST v1 and FHIR `Practitioner` endpoint.
