# ESSEN Credentialing Platform — Documentation

This folder is the entry point for all platform documentation.

## By audience

### For users (staff and providers)

- **[User guide](user/README.md)** — plain-language guides for every feature staff and providers use every day.
- **[Training plans](training/README.md)** — role-based onboarding and ongoing training.

### For engineers

- **[Developer guide](dev/README.md)** — local setup, architecture, subsystem deep-dives, ADRs, runbooks.
- **[API reference](api/README.md)** — REST v1 and FHIR R4.
- **[Testing](testing/README.md)** — test strategy, plans, and performance/accessibility/security testing.

### For compliance and auditors

- **[Compliance](compliance/README.md)** — NCQA CVO, HIPAA, CMS-0057-F, PHI data map, retention, policies.

### For operations

- **[Runbooks](dev/runbooks/README.md)** — incident response, rollback, key rotation, access provisioning.
- **[Deployment](dev/deployment.md)** — environments, deploy script, config.

## By topic

| Topic | Entry point |
|-------|-------------|
| Getting started (staff) | [user/getting-started.md](user/getting-started.md) |
| Provider onboarding | [user/provider-onboarding.md](user/provider-onboarding.md) |
| Local development | [dev/getting-started.md](dev/getting-started.md) |
| Architecture | [dev/architecture.md](dev/architecture.md) |
| Authentication | [dev/auth.md](dev/auth.md) |
| PHI encryption | [dev/encryption.md](dev/encryption.md) |
| PSV bots | [dev/bots.md](dev/bots.md) |
| Release process | [../CHANGELOG.md](../CHANGELOG.md) |
| Public API auth | [api/authentication.md](api/authentication.md) |
| NCQA readiness | [compliance/ncqa-cvo.md](compliance/ncqa-cvo.md) |
| HIPAA summary | [compliance/hipaa.md](compliance/hipaa.md) |
| Test strategy | [testing/strategy.md](testing/strategy.md) |

## Project planning artifacts

The original scope documents, ERD, and workflows live under [planning/](planning/). Source stakeholder documents live under [upload/](upload/).

## Documentation policy

- User-facing documentation (`docs/user/**`, `docs/training/**`) describes the platform as a new Credentialing application. A CI linter enforces that framing.
- Engineering documentation (`docs/dev/**`, `docs/compliance/**`, `docs/api/**`, `docs/testing/**`) is free to reference internal context.
- Every new feature adds or updates at least one user-facing page and one engineering page before merge.
- Every Architecture Decision is captured as an ADR under [dev/adr/](dev/adr/).
