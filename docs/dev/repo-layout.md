# Repository Layout and Conventions

```
E_Credentialing/
├── .claude/                  # Deployment and automation scripts (ops-only)
├── .github/                  # CI/CD workflows, Dependabot, PR template
├── docs/                     # This directory — all documentation
│   ├── user/                 # User-facing guides (staff + provider)
│   ├── training/             # Role-based training plans
│   ├── dev/                  # Developer docs
│   ├── api/                  # API and FHIR reference
│   ├── ops/                  # Operational runbooks, SLOs
│   ├── compliance/           # NCQA CVO, HIPAA, policy references
│   ├── testing/              # Test strategy and coverage reports
│   ├── planning/             # Product requirements and architecture decisions
│   ├── status/               # Live status trackers (blocked.md, etc.)
│   └── upload/               # Source docs from stakeholders (read-only)
├── nginx/                    # Nginx reverse-proxy configs for production
├── prisma/
│   ├── schema.prisma         # Single source of truth for DB schema
│   ├── migrations/           # Tracked migrations (do NOT gitignore)
│   └── seed.ts               # Dev/test seed data
├── public/                   # Static assets
├── scripts/                  # Utility CLIs (forbidden-terms, web entrypoint)
├── src/
│   ├── app/                  # Next.js App Router pages + API routes
│   ├── components/           # React components
│   ├── hooks/                # React hooks
│   ├── lib/                  # Pure libraries (auth, api helpers, logger, encryption)
│   ├── server/               # tRPC routers and server-only code
│   ├── workers/              # BullMQ workers and PSV bots
│   └── styles/               # Tailwind globals
├── tests/
│   ├── unit/                 # Vitest unit tests (mirrors src/)
│   ├── integration/          # Vitest integration tests (testcontainers)
│   └── e2e/                  # Playwright specs
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Dockerfile.web.prod
├── Dockerfile.worker.prod
├── playwright.config.ts
├── vitest.config.ts
├── next.config.mjs
├── package.json
└── tsconfig.json
```

## File naming

- React components: `PascalCase.tsx` (`ProviderCard.tsx`). One component per file.
- Hooks: `useThing.ts` in `src/hooks/`.
- Libraries: `kebab-case.ts` in `src/lib/`.
- Tests: `thing.test.ts` or `thing.test.tsx` in the matching location under `tests/`.
- API routes: `src/app/api/<path>/route.ts`.
- tRPC routers: `src/server/api/routers/<name>.ts`.
- Prisma migrations: `prisma/migrations/<yyyymmddhhmmss>_<snake_case_name>/migration.sql`.

## Code style

- ESLint + Prettier. `npm run lint` must pass before merge.
- TypeScript strict mode. No `any` except in tests or explicitly justified.
- No `as unknown as X` casts; if needed, leave a `// reason:` comment.
- Prefer `const` and named exports. Default exports only where Next.js requires them (page components, route handlers, layouts).
- Use `zod.nativeEnum(PrismaEnum)` for tRPC inputs where an enum comes from Prisma — never raw string unions.

## Testing conventions

- Unit: no network, no database. Mock Prisma via `vi.mock`.
- Integration: real Postgres (testcontainers) with per-test transactional cleanup.
- E2E (Playwright): run against a real stack. Keep these few and flake-proof.

## Commits and PRs

- Conventional Commits (`feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`).
- Small PRs preferred. PRs over 800 lines need a second reviewer.
- PR template auto-applies from `.github/pull_request_template.md`.
- CI must pass (typecheck, lint, tests, forbidden-terms, build) before merge.

## Documentation policy

- **User-facing docs** under `docs/user/` and `docs/training/`: no references to prior systems, upgrades, or migrations. Enforced by `scripts/forbidden-terms.mjs`.
- **Engineering docs** under `docs/dev/`, `docs/ops/`, `docs/planning/`: free to describe history, prior systems, and decisions.
