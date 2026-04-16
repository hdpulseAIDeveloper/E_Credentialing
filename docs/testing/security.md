# Security Testing

## Automated

### Static analysis

- **CodeQL** on every PR and weekly schedule. `security-and-quality` queries for `javascript-typescript`.
- **ESLint** with security plugins: `eslint-plugin-security`, `eslint-plugin-no-unsanitized`.
- **TypeScript** in strict mode; no `any` without a reviewer exception.

### Secret scanning

- **Gitleaks** on every PR and push.
- **GitHub secret scanning** enabled at repo level.
- Detected secret in a PR blocks merge; in `master` triggers incident.

### Dependency scanning

- **Dependabot** opens PRs weekly (grouped prod/dev minor+patch).
- **GitHub dependency review** on PRs fails on high severity.
- `npm audit` in CI fails on high severity.

### Container scanning

- Base image (`node:22-alpine`) refreshed weekly.
- Trivy scan in CI on every build; fails on HIGH/CRITICAL CVEs.

## Manual

### Penetration test

- Third-party pen test annually.
- Scope: web app, public API, FHIR endpoint, authentication flows, blob access.
- Findings tracked to closure with SLAs:
  - Critical: 7 days
  - High: 30 days
  - Medium: 90 days
  - Low: next release

### Threat modeling

- Every new module that touches PHI, authentication, or external systems goes through a STRIDE-based threat model session documented in `docs/security/threat-models/`.

## Application-layer assertions

Integration tests verify:

- **Authentication**
  - Expired session rejected.
  - Tampered JWT rejected.
  - Revoked provider invite token rejected.
  - API key with wrong prefix rejected.

- **Authorization**
  - Specialist cannot access Admin endpoints.
  - Provider token for provider A cannot access provider B.
  - Read-only API key cannot POST.

- **Encryption**
  - Writing PHI produces ciphertext on disk.
  - Decryption with tampered tag fails.
  - Wrong key fails to decrypt.

- **Rate limiting**
  - 429 returned after threshold.
  - Retry-After header set.
  - Per-key isolation enforced.

- **Audit**
  - Every mutation has an audit entry.
  - Audit entries are immutable (UPDATE/DELETE denied at DB level).

- **PHI leakage**
  - Public API responses do not include PHI fields.
  - Logs redact PHI paths.
  - Error responses do not leak stack traces or schema details.

- **CSRF**
  - State-changing requests from other origins rejected.

- **Injection**
  - Prisma's query builder is used exclusively; no raw SQL except `$queryRaw` with parameters.
  - HTML is never concatenated; React escapes output.

## Bug bounty / disclosure

See [security policy](../../SECURITY.md) for responsible disclosure. Public advisories are opened for each CVE-level fix.

## Compliance evidence

Security testing artifacts retained for 7 years and included in the [auditor package](../compliance/auditor-package.md).
