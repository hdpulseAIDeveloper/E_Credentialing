# ESSEN Credentialing — CVO Platform

NCQA-aligned, HIPAA-compliant, AI-augmented **Credentialing Verification
Organization (CVO) platform**. Automates primary-source verification,
OPPE / FPPE cycles, payer enrollment, recredentialing, sanctions
monitoring, and a public FHIR R4 provider directory (DaVinci PDex
Plan-Net IG, CMS-0057-F). Audit-ready out of the box.

Built on Next.js 14 (App Router), TypeScript, tRPC, Prisma, and
PostgreSQL. Worker on BullMQ + Redis. Runs in Docker on Azure VPS;
Azure Container Apps via `azd up` for production.

Public surfaces:

- `/` — marketing landing
- `/cvo` — what a CVO actually does, and how this platform covers it
- `/pricing` — Starter / Growth / Enterprise tiers
- `/sandbox` — public read-only API on synthetic data (no auth)
- `/changelog` + `/changelog.rss` — customer release notes

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

The dev container's command is `npm run dev:warm`, which spawns
`next dev --turbo` and pre-compiles every static AND every dynamic
route from `route-inventory.json` so the user's first click never
pays the cold-compile cost. This is binding per
[ADR 0029](docs/dev/adr/0029-dev-loop-performance-baseline.md) /
`docs/qa/STANDARD.md` §11. Validate locally with:

```bash
npm run qa:live-stack:full   # all 7 Pillar S surfaces (incl. dev-perf budget)
```

## Quality bar

Every change MUST pass the **HDPulseAI QA Standard v1.3.0** at
[docs/qa/STANDARD.md](docs/qa/STANDARD.md):

- 19 testing pillars (A–S); Pillar S is the live-stack reality gate
  ([ADR 0028](docs/dev/adr/0028-live-stack-reality-gate.md)),
  Surface 7 enforces a 2000 ms dev-loop re-fetch budget
  ([ADR 0029](docs/dev/adr/0029-dev-loop-performance-baseline.md)).
- 15 §4 hard-fail conditions — including pending Prisma migrations,
  dead seed accounts, cold Dockerfile build regressions, named-volume
  staleness, and lazy-compile dev-loop regressions.
- The per-PR Definition of Done is at
  [docs/qa/definition-of-done.md](docs/qa/definition-of-done.md).
- `npm run qa:gate` is the single entry point and includes both
  `qa:migrations` and `qa:live-stack`.

## License & ownership

Proprietary to ESSEN Health Care; built and maintained by HDPulseAI.
