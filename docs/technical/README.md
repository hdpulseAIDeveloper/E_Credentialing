# Technical Documentation

Documentation written for **developers, architects, DevOps, and security
engineers**.

## Contents

| Document | Purpose |
|---|---|
| [Technical Requirements (TRD)](technical-requirements.md) | The contract between business needs and the implementation |
| [Architecture](architecture.md) | Comprehensive architecture and design reference |
| [Data Model](data-model.md) | Database schema, ERD pointers, encryption map |
| [API Surface](api-surface.md) | Inventory of tRPC routers, REST v1 endpoints, FHIR resources |
| [Security](security.md) | Threat model, controls, secrets management |
| [Deployment & Operations](deployment-and-operations.md) | Environments, deploy pipeline, runbook index |
| [Performance & Scalability](performance.md) | Targets, current measurements, scale-out plan |

## Companion documents

- [dev/](../dev/) — day-to-day developer reference (local setup, subsystem deep-dives, ADRs, runbooks). The TRD links into these where appropriate.
- [api/](../api/) — public REST and FHIR reference for external consumers.
- [compliance/](../compliance/) — NCQA, HIPAA, CMS-0057-F mappings.
- [planning/architecture.md](../planning/architecture.md) — original architecture rationale and ADR context.
