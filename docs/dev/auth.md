# Authentication

Two distinct auth models:

## Staff — Auth.js v5 (Entra ID)

Configuration in `src/server/auth/`:

- Primary provider: **Microsoft Entra ID** (Azure AD) via OIDC. Strategy: JWT sessions.
- Local dev provider: **Credentials** — enabled only when `AUTH_LOCAL_CREDENTIALS=true`. Creates sessions identical to Entra for test users.
- Magic-link provider is not used for staff; only for providers via the separate system below.

Session claims include:

- `sub` (Entra OID)
- `email`
- `roles[]` (mapped from Entra AD group memberships)

Role-to-group mapping is stored in `Administration → Integrations → Entra groups`. A nightly sync reconciles.

MFA is enforced at the Entra tenant level; the platform does not implement its own MFA.

### Login flow

1. User hits `/api/auth/signin` → Auth.js redirects to Entra.
2. Entra authenticates (including MFA).
3. Redirect back to `/api/auth/callback/azure-ad`.
4. Auth.js creates a JWT session cookie (`__Secure-next-auth.session-token`).
5. Middleware (`src/middleware.ts`) enforces route protection.

### Route protection

Middleware matches:

- `/dashboard/**`, `/providers/**`, `/committee/**`, etc. — staff-only.
- `/application/**`, `/attestation`, `/upload` — allow provider-token.
- `/api/v1/**`, `/api/fhir/**` — public API-key authenticated.
- Everything else — public.

## Providers — Magic link (JWT)

Providers do not have staff accounts. They receive a JWT tied to their provider record.

Configured in `src/lib/auth/provider-token.ts`:

### Token format

- JWT signed with `NEXTAUTH_SECRET`.
- Claims: `{ typ: "provider-invite", providerId, email, iat, exp }`.
- `exp` = 72 hours from issue.

### Single-active-token enforcement

Only one token is valid at a time per provider. The token's own hash must match `Provider.inviteToken`. Issuing a new invite atomically replaces the stored hash; the previous token is instantly invalidated.

### Consumption

Provider clicks their link → the server calls `verifyProviderInviteToken(tokenStr)`:

1. Verify signature and expiration.
2. Verify `typ === "provider-invite"`.
3. Verify `Provider.inviteToken` matches the token hash.
4. Verify `Provider.status` is one of `INVITED`, `ONBOARDING_IN_PROGRESS`, `DOCUMENTS_PENDING`.
5. Return `{ providerId, email }`.

If any step fails, throw a `ProviderTokenError` with a structured code the caller maps to a friendly HTTP status.

### Token lifecycle events

- **Issue**: `Provider.inviteToken` set to hash of new token; email sent.
- **Consume** (attestation): `Provider.inviteToken` cleared. Further requests fail.
- **Reissue** (resend invite): `Provider.inviteToken` overwritten; old token invalidated.
- **Revoke** (provider declines / clerical): `Provider.inviteToken` cleared; audit entry created.

## Public API — API keys

Keys are generated under Administration → Integrations → API Keys. Format: `ecred_<32-char-random>`. The DB stores only `sha256(key)`.

Middleware (`src/app/api/v1/middleware.ts`):

1. Parse `Authorization: Bearer ecred_<...>`.
2. Hash, look up.
3. Verify `isActive`, `!revokedAt`.
4. Enforce rate limit (`src/lib/api/rate-limit.ts`, key = apiKeyId).
5. Update `lastUsedAt` (best-effort, fire-and-forget).
6. Continue to the handler with `{ apiKeyId, scopes }` in context.

### Scopes

Supported scopes: `providers:read`, `sanctions:read`, `enrollments:read`, `fhir:read`. Write scopes are not available by design.

### Error responses

REST:
```json
{ "error": { "code": "unauthorized", "message": "..." } }
```

FHIR:
```json
{
  "resourceType": "OperationOutcome",
  "issue": [{ "severity": "error", "code": "security", "diagnostics": "..." }]
}
```

## Session security

- Session cookies: HttpOnly, Secure, SameSite=Lax. JWT strategy (stateless).
- CSRF: Auth.js handles CSRF for its own endpoints. For custom mutations on public endpoints, `src/lib/api/csrf.ts` provides a token-check helper.
- Cookie TTL: 1 day for rolling sessions; force re-auth after 7 days.

## FAQ

**Why not Azure AD B2C for providers?**
Providers complete the application once; a full identity account is overhead. Magic-link gives the right trust boundary and shifts MFA burden to Essen's email security.

**Can I impersonate a user for debugging?**
Only Admins, only in a non-prod environment, and only via a "break-glass" token that logs both actor and target. Implementation in `src/lib/auth/impersonation.ts` (guarded off in prod).

**What happens if the provider forwards their link to a colleague?**
The link works for whoever holds it until the token is consumed (on attestation) or reissued. We accept this for the onboarding UX; risk is mitigated by the 72-hour expiration and the single-use nature on submit.
