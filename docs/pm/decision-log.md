# Decision Log

> Significant **non-technical** decisions live here. Technical decisions live
> as ADRs in [dev/adr/](../dev/adr/).

| ID | Date | Decision | Driver | Decider | Notes |
|---|---|---|---|---|---|
| D-001 | 2025-09 | Replace PARCS with a built platform rather than buy a SaaS | Cost, control, NCQA timing | Sponsor | See vendor evaluation memo (archived) |
| D-002 | 2025-10 | Use Microsoft Entra ID for staff SSO | Tenant standard | Sec | Auth.js group → role mapping |
| D-003 | 2025-11 | Single-tenant Azure deployment for ESSEN | Data residency, audit | Sponsor | Multi-tenant explored Phase 6+ |
| D-004 | 2025-12 | Build PSV bot framework in-house | Need open extensibility | Eng Lead | Ref ADR-0001/0003 |
| D-005 | 2026-01 | Adopt CMS-0057-F FHIR Practitioner endpoint as MVP scope | Payer demand | Product | FHIR R4 |
| D-006 | 2026-02 | Audit log MUST be tamper-evident (HMAC chain) | NCQA + audit posture | Sec | Ref ADR-0011 |
| D-007 | 2026-03 | Drop Socket.io; use polling | Stability, cost | Eng Lead | Ref ADR-0003 |
| D-008 | 2026-03 | Provider portal authentication via single-active JWT magic link | Simplicity + revocability | Sec | Ref ADR-0005 |
| D-009 | 2026-04 | Required documents: System Prompt + Development Plan kept current | Documentation governance | Sponsor | This commit; see [docs/README.md](../README.md#required-documents) |
| D-010 | 2026-04 | Documentation organized strictly under `docs/` by audience; root has no docs except `README.md`, `CHANGELOG.md`, `CLAUDE.md` | Discoverability | PM | This commit |

## Process

- Material decisions are surfaced at the weekly status meeting.
- Once decided, the decider opens a PR adding a row here. The PR description
  links to the underlying memo, ticket, or thread.
- Decisions are immutable; a subsequent decision that overrides an earlier
  one gets a new ID and references the prior in **Notes**.
