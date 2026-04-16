# 0004. AES-256-GCM at the application layer for PHI

- Status: Accepted
- Date: 2026-04-16

## Context

HIPAA requires encryption of electronic PHI at rest and in transit. Azure services already encrypt at rest, but "encrypt at rest at the platform level" is not equivalent to encrypting the PHI itself from the application's perspective — anyone with DB access can read plaintext.

## Decision

Encrypt identified PHI fields (`ssn`, `dateOfBirth`, home address, home phone) at the application layer using **AES-256-GCM** with a 96-bit random IV per call. Ciphertext format: `<iv>:<ciphertext>:<authtag>` (base64 parts).

- Key stored in Azure Key Vault; 32 bytes, rotated annually.
- Plaintext only ever lives in memory for the duration of a request.
- A `looksLikeCiphertext(value)` predicate exists for assertion in tests and a sanity check before DB writes.

## Consequences

- DB readers (including backups or audit exports) see ciphertext, not PHI.
- Search on encrypted fields is impossible — we use hashed or partial-indexed fields (e.g., SSN last-4) for searching.
- Key rotation requires a staged migration (dual-key mode for a period).
- Logger must redact these fields by path (enforced in `pino` config) so plaintext in process memory never leaks into logs.
- Unit and integration tests assert DB rows contain ciphertext, not plaintext.

## Alternatives considered

- **Azure Postgres TDE only** — fails the threat model; anyone with valid DB credentials sees plaintext.
- **pgcrypto (column-level encryption in Postgres)** — keeps keys in the DB or application layer but adds SQL complexity; rejected in favor of simpler application-layer encryption.
- **Vault-based field-level encryption service** — high complexity for our current scale; revisit when PHI volume justifies.
