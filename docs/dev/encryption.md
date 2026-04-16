# Encryption and PHI Handling

The platform encrypts PHI at rest at the application layer. Azure Storage Service Encryption and database-level encryption are defense-in-depth but are not what satisfies HIPAA for the sensitive fields.

## Scope

Encrypted fields (stored as ciphertext strings):

- `Provider.ssn`
- `Provider.dateOfBirth`
- `Provider.homeAddressLine1`, `homeAddressLine2`, `homeCity`, `homeState`, `homeZip`, `homePhone`
- Any other PHI field marked in `schema.prisma`

Hashed (one-way, never reversible):

- `ApiKey.keyHash` — SHA-256 of the key value
- `Provider.inviteToken` — SHA-256 of the JWT payload hash

## Algorithm

`src/lib/encryption.ts` uses **AES-256-GCM** with a 96-bit random IV per encryption call.

Ciphertext is stored as a single string:

```
<base64-iv>:<base64-ciphertext>:<base64-authtag>
```

The format is stable; `looksLikeCiphertext(value)` predicate helps in assertions.

## Key management

- `ENCRYPTION_KEY` is 32 bytes of random data, base64-encoded in env.
- In production, the key is fetched from Azure Key Vault on container boot.
- The key rotates every 12 months. Rotation procedure (see [runbooks/key-rotation.md](runbooks/key-rotation.md)):
  1. Load new key under a new version id.
  2. Deploy a dual-key mode: encrypt with new, decrypt with old-or-new.
  3. Run a background migration that re-encrypts existing ciphertext with the new key.
  4. Remove the old key from service.

## Usage

```ts
import { encrypt, decrypt, encryptOptional, decryptOptional } from "@/lib/encryption";

// Encrypt
const cipherSsn = encrypt(plainSsn);

// Optional — returns null when input is null/undefined
const cipherDob = encryptOptional(provider.dateOfBirth);

// Decrypt
const plainSsn = decrypt(cipherSsn);
```

## Logging

Never log plaintext PHI. Two layers enforce this:

1. `redactForLog(obj, fields)` in `src/lib/encryption.ts` replaces listed keys with `[REDACTED]`.
2. `pino` config in `src/lib/logger.ts` has a broad `redact.paths` list covering known PHI keys, auth headers, cookies, and secrets. Any log line with those paths auto-redacts.

If you add a new PHI field, update both the Prisma schema comment and the `pino` redact paths in the same commit.

## Exports

CSV and report exports pass through `src/lib/export/masking.ts`:

- SSN masked to `XXX-XX-1234`.
- DOB masked to year only.
- Full SSN / DOB disclosure requires a Manager role and the request is logged in `AuditLog` with `action = "EXPORT_UNMASKED_PHI"` and the reason text.

## Decryption audit

Every read of a raw SSN through the "Reveal" UI calls a helper that writes an `AuditLog` entry with `action = "REVEAL_SSN"`. This is how we detect excessive SSN reveals (a SOC signal).

## Testing

- Unit tests cover round-trip encrypt/decrypt, tamper detection (modifying the auth tag), ciphertext shape (`looksLikeCiphertext`).
- Integration tests assert that rows in the DB for a given provider contain ciphertext, not plaintext.
- Property tests (fast-check) verify decrypt(encrypt(x)) === x for arbitrary strings including unicode.

See [`tests/unit/lib/encryption.test.ts`](../../tests/unit/lib/encryption.test.ts) and the testing strategy in [testing.md](testing.md).
