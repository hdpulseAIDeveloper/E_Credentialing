# Runbook: Encryption key rotation

Annual rotation of `ENCRYPTION_KEY` (AES-256-GCM, 32 bytes).

## Plan

- Frequency: every 12 months (or on incident).
- Zero-downtime via a dual-key window.
- Takes ~1 hour of active work + background re-encryption job.

## Procedure

### 1. Generate new key in Key Vault

```bash
# Generate 32 bytes base64
openssl rand -base64 32

# Store as new secret version in Key Vault
az keyvault secret set --vault-name <vault> --name ecred-encryption-key --value <new>
```

### 2. Deploy dual-key mode

- Update `src/lib/encryption.ts` to read `ENCRYPTION_KEY` (current) and `ENCRYPTION_KEY_OLD` (previous version).
- Encrypt always uses the current key.
- Decrypt tries the current key first, falls back to the old.
- Configure prod env with both:
  ```
  ENCRYPTION_KEY=<new>
  ENCRYPTION_KEY_OLD=<previous>
  ```
- Deploy and verify reads/writes work for both existing (old-ciphertext) and new records.

### 3. Run the re-encryption job

```bash
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-worker-prod npm run job:reencrypt-phi"
```

This iterates every row with encrypted columns, decrypts with whichever key works, re-encrypts with the current key, and updates. Safe to resume; tracks per-table progress.

### 4. Verify no old ciphertext remains

```bash
# Emit a report of rows whose ciphertext cannot be decrypted with the NEW key alone
ALLOW_DEPLOY=1 python .claude/deploy.py "docker exec ecred-worker-prod npm run job:reencrypt-report"
```

Target: 0 rows. If non-zero, investigate the specific rows.

### 5. Retire the old key

- Remove `ENCRYPTION_KEY_OLD` from env.
- Deploy.
- Disable the old Key Vault secret version.

## Validation

- Every encrypted column on sampled rows decrypts successfully.
- Unit tests pass.
- `logger` shows no decrypt-with-old-key fallbacks after the retirement deploy.

## Incident rotation (suspected leak)

If the key is suspected compromised, compress the timeline:

1. Immediately generate a new key and deploy dual-key mode.
2. Run the re-encryption job at higher concurrency.
3. After re-encryption, retire the old key *and* rotate the Key Vault encryption-at-rest key if the underlying vault trust is in doubt.
4. File an incident in the security log with timeline and scope.
