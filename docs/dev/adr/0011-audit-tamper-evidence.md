# ADR 0011: Tamper-evident audit log (HMAC chain + DB triggers)

**Status**: Accepted (2026-04-16)

## Context

NCQA CVO and HIPAA require an auditable record of every change that affects a
credentialing decision, plus reasonable assurance that the record has not been
tampered with. The prior implementation stored audit rows with no integrity
signal and permitted UPDATE/DELETE at the DB level, which means a compromised
app role or a mistaken migration could alter history without trace.

## Decision

1. Add a monotonic `sequence` column (`BIGSERIAL`) to `audit_logs`.
2. Add `previous_hash` and `hash` columns. Hash is `HMAC-SHA256(AUDIT_HMAC_KEY, previous_hash || canonical_row)`.
3. Store `ip_address`, `user_agent`, `request_id` alongside each entry.
4. At the DB layer, install triggers that:
   - Block DELETE and TRUNCATE outright.
   - Allow UPDATE only when the `hash` column is transitioning from NULL to a non-NULL value and every other chain-input column is unchanged.
5. Application writes the row inside a transaction, computes the hash against the latest previous hash, and updates the row's `hash` once. The trigger permits exactly this path.
6. Chain verification runs in the compliance export path and in a nightly job; results surface on the Compliance dashboard.

## Consequences

- **Positive**
  - Chain breakage is cheap to detect (O(N) scan).
  - Attackers must tamper with the DB AND know the HMAC key to rewrite history without detection.
  - DELETE/TRUNCATE are impossible for the application role.
  - HIPAA and NCQA CVO integrity requirements are satisfied with in-database evidence.

- **Negative**
  - Every audit write does two SQL statements instead of one (INSERT then UPDATE of hash).
  - Requires `AUDIT_HMAC_KEY` to be set in production; the app refuses to start without it.
  - Re-encryption or reprocessing will not be able to update older rows — by design.

## Alternatives considered

- **Revoke UPDATE/DELETE from the app role, rely solely on DB GRANTs.** Cleaner in theory, but Essen's shared Postgres deployment uses a single `postgres` role; we chose trigger-based enforcement to decouple from role management.
- **Store the chain in an external system** (e.g., an immutable log service). Added failure modes and cost; rejected as over-engineered for current scale.
- **Block-chain the chain to an external anchor** (e.g., publishing a Merkle root hourly). Planned as a future hardening step, not a blocker for launch.

## Operational notes

- `AUDIT_HMAC_KEY` is stored in Azure Key Vault and injected into both the
  `web` and `worker` containers.
- Rotation is documented in [key-rotation.md](../runbooks/key-rotation.md);
  rotating the HMAC key is a breaking change to verifiability of older
  rows and requires publishing the previous key's retirement timestamp.
- Verification of legacy rows (where `hash IS NULL`) is tracked and
  surfaced in the compliance report; those rows are flagged as
  "cannot be cryptographically attested" but remain present for forensic
  review.
