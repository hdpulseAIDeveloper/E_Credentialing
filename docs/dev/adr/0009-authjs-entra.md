# 0009. Auth.js v5 with Entra ID for staff

- Status: Accepted
- Date: 2026-02-10

## Context

Essen staff are on Microsoft 365 and use Entra ID for identity. Staff auth must enforce MFA (already configured at the Entra tenant level) and map to internal roles.

## Decision

Use Auth.js v5 (formerly NextAuth) with the Entra ID provider. JWT sessions. Role list built from Entra AD group memberships via an onboarding sync job. Local dev supports a credentials provider gated by `AUTH_LOCAL_CREDENTIALS=true`.

## Consequences

- MFA enforcement lives in Entra; zero MFA code in the app.
- Staff provisioning is an Azure AD admin action — no user management in the app.
- Session cookies are HttpOnly, Secure, SameSite=Lax, JWT strategy.
- A group-to-role sync job reconciles role changes nightly (configurable).
- Provider auth uses a separate, magic-link token system (see ADR-0005).

## Alternatives considered

- **Azure AD B2C** — unnecessary for staff; we already have AD.
- **Custom OAuth** — Auth.js gives us callbacks, session handling, and a healthy ecosystem.
- **NextAuth v4** — v5 is the forward-compatible choice and works with App Router.
