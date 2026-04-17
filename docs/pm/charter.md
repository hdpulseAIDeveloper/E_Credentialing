# Project Charter

**Project:** ESSEN Credentialing Platform
**Sponsor:** ESSEN Health Care — VP Operations
**Delivery owner:** HDPulseAI Engineering Lead
**Status:** Active (production rollout in progress)

## Mission

Replace PARCS with a single, auditable, NCQA-aligned platform that runs the
entire provider credentialing and enrollment lifecycle for ESSEN, and is
extensible for similarly-shaped customers.

## Goals

1. Cut time-to-credential to ≤ 14 days for clean files.
2. Reduce credentialing labor by ≥ 60% per file.
3. Achieve continuous NCQA / Joint Commission readiness.
4. Pass CMS-0057-F payer interop without remediation work.
5. Enable safe, auditable use of AI in credentialing operations.

## In scope

See [BRD § 1](../functional/business-requirements.md#1-purpose) and
[Product Overview § Top capabilities](../product/product-overview.md).

## Out of scope

- Clinical EMR functionality.
- Claims billing.
- Generic e-signature platform (integrate with one).
- Multi-tenant SaaS (Phase 6+ exploration).

## Success criteria

| Criterion | Measure | Target |
|---|---|---|
| Provider count migrated | % of PARCS providers in platform | 100% by end of Phase 4 |
| User adoption | weekly active staff | ≥ 90% of credentialing team by Phase 3 |
| File completion time | calendar days | ≤ 14 days for clean files |
| NCQA prep time | hours | ≤ 8 hrs / cycle |
| Audit findings | count | 0 critical, ≤ 2 minor |
| Uptime | % during business hrs | ≥ 99.5% |
| Public API consumers | count | ≥ 3 paying or partner integrations by Phase 5 |

## Stakeholders

See [stakeholder-map.md](stakeholder-map.md).

## Constraints

- Must run on ESSEN's Azure tenant.
- Must support ESSEN's current data residency posture (US East).
- Must integrate with ESSEN's existing iCIMS hire flow.
- Single Postgres instance (no sharding) within current cycle.

## Assumptions

- Entra ID is the SSO source of truth.
- SendGrid is the outbound email gateway.
- Production is a single-tenant deployment for ESSEN.

## Approval

| Role | Name | Decision |
|---|---|---|
| Sponsor | (VP Operations) | Approved |
| Delivery Lead | (HDPulseAI Engineering Lead) | Approved |
| Compliance | (NCQA / HIPAA Lead) | Approved |
| Security | (Security Lead) | Approved |

## Charter changes

Material changes (mission, scope, success criteria) require sponsor
approval and a new entry in [decision-log.md](decision-log.md).
