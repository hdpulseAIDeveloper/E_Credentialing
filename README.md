# ESSEN Credentialing Platform

NCQA-aligned, HIPAA-compliant, AI-augmented provider credentialing and
enrollment platform. Built on Next.js 14, TypeScript, tRPC, Prisma, and
PostgreSQL. Runs on Docker on Azure VPS.

## Documentation

All documentation lives under [docs/](docs/), organized by audience.

- **Start here:** [docs/README.md](docs/README.md) — master index.
- **Required documents** (kept current at all times):
  - [docs/system-prompt.md](docs/system-prompt.md) — regenerate-from-scratch prompt.
  - [docs/development-plan.md](docs/development-plan.md) — phased delivery plan.
- **Quick links by audience:**
  - Product / executives → [docs/product/](docs/product/)
  - Users (staff + providers) → [docs/user/](docs/user/)
  - Functional (BA / QA / Product) → [docs/functional/](docs/functional/)
  - Technical (developers / architects / DevOps / security) → [docs/technical/](docs/technical/) and [docs/dev/](docs/dev/)
  - Project Management → [docs/pm/](docs/pm/)
  - QA → [docs/qa/](docs/qa/)
  - Compliance → [docs/compliance/](docs/compliance/)
  - Public REST + FHIR API → [docs/api/](docs/api/)

## Repository conventions

These three files stay at the repo root by tooling convention; nothing
else does:

| File | Purpose |
|---|---|
| `README.md` | This file — entry point that points to documentation. |
| `CLAUDE.md` | Day-to-day AI build-agent prompt (auto-loaded by Claude Code). Pointer page: [docs/dev/claude-md.md](docs/dev/claude-md.md). |
| `CHANGELOG.md` | Product change log per [Keep a Changelog](https://keepachangelog.com). Pointer page: [docs/changelog.md](docs/changelog.md). |

## Development quick start

See [docs/dev/getting-started.md](docs/dev/getting-started.md). The short
version:

```bash
docker compose -f docker-compose.dev.yml up --build
# Web on http://localhost:6015, worker on :6025
```

## License & ownership

Proprietary to ESSEN Health Care; built and maintained by HDPulseAI.
