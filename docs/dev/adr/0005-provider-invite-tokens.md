# 0005. Single-use provider invite tokens

- Status: Accepted
- Date: 2026-04-16

## Context

Providers authenticate to complete their application via a magic-link JWT. The initial implementation:

- Accepted any signed JWT whose `providerId` matched a record.
- Did not enforce single-use.
- Allowed forgeries if a secret ever leaked.
- Allowed "stale" tokens whose provider status had changed.

## Decision

Centralize provider-token verification in `src/lib/auth/provider-token.ts`. On every verification:

1. Verify signature and expiration.
2. Verify `typ === "provider-invite"`.
3. Verify the token's hash matches the single value stored in `Provider.inviteToken`.
4. Verify `Provider.status` is in a valid onboarding state.
5. Return `{ providerId, email }` on success; throw a structured `ProviderTokenError` on any failure.

Token lifecycle:

- Issue: `Provider.inviteToken` set to hash of new token; email sent.
- Consume on attestation: `Provider.inviteToken` cleared.
- Reissue: `Provider.inviteToken` overwritten — old token invalidated.
- Revoke: `Provider.inviteToken` cleared via admin action.

## Consequences

- A leaked old link does not grant access after reissue.
- A provider cannot reuse their attestation link to edit the application post-submit.
- Clear error codes let the UI show friendly messages (`expired`, `revoked`, `not_eligible`).
- The `providerProcedure` in tRPC is removed — providers never call tRPC; REST routes only.
- Audit entries on issue, reissue, consume, and revoke.

## Alternatives considered

- **Short-lived JWT without DB tracking** — still vulnerable to replay within the window and doesn't support reissue-revokes-old.
- **Full session cookies for providers** — adds session-management overhead; overkill for one-time onboarding.
- **Signed URLs with nonce in DB only (no JWT)** — viable but introduces bespoke verification; the JWT path reuses `jose` and pattern developers already know.
