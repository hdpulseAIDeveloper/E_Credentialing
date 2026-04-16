# CI / CD

## CI (`.github/workflows/ci.yml`)

Runs on every `push` to `master` and every `pull_request`.

Jobs:

### `typecheck-lint-test`

- Spin up Postgres and Redis services.
- `npm ci --legacy-peer-deps`.
- `npx prisma migrate deploy` against the ephemeral DB.
- `node scripts/forbidden-terms.mjs` — fails if user-facing docs reference legacy framing.
- `npm run typecheck`.
- `npm run lint`.
- `npm run test -- --coverage`.
- Upload coverage to GitHub Actions summary.

### `build`

- `npm ci --legacy-peer-deps`.
- `npx prisma generate`.
- `next build` (standalone output).
- Fails on any missing envs or type errors surfaced by Next's build step.

## Security (`.github/workflows/security.yml`)

Runs on `push`, `pull_request`, and weekly.

- **CodeQL** (`javascript-typescript` with `security-and-quality` queries).
- **Dependency Review** — PR-level diff review, fails on high-severity vulnerabilities.
- **Gitleaks** — secret scanning.

## Dependabot (`.github/dependabot.yml`)

Weekly updates:

- `npm` — grouped minor/patch for prod and dev.
- `github-actions` — pins rotated to latest.

## PR template (`.github/pull_request_template.md`)

Auto-applied on new PRs. Checklist:

- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run test`
- [ ] `node scripts/forbidden-terms.mjs`
- [ ] New/changed Prisma migrations are tracked
- [ ] New PHI fields encrypted at write-time and redacted in logs
- [ ] `docs/status/blocked.md` updated if the PR introduces a human-input gate

## CD (`.github/workflows/cd-prod.yml`)

Triggers:

- `v*.*.*` tag push
- Manual `workflow_dispatch`

Steps:

1. Install `paramiko`.
2. `ALLOW_DEPLOY=1 python .claude/deploy.py` — SSHes into the production host, pulls latest, rebuilds and restarts containers, prunes old images, tails the state.
3. (Conditional, gated by repo variable `FIRST_DEPLOY == 'true'`) — run `prisma migrate resolve` commands to mark legacy migrations as applied against the previously `db push`-initialized database.
4. Smoke test: `curl` the production health endpoint. Fail the workflow if not 200.

Ownership and rollback:

- Only release managers can push tags.
- Deploys are forward-only; rollback is "deploy the previous tag."
- Every deploy leaves a GitHub Actions run with full logs for audit.

## Local deploy script guard

`.claude/deploy.py` requires `ALLOW_DEPLOY=1` in the environment. This prevents accidental deploys during dev iterations. The CD workflow sets this env explicitly.

## Branch protection

On `master`:

- Requires `ci.yml` and `security.yml` to pass.
- Requires 1 reviewer approval.
- Bypass allowed only for repository admins during emergencies.

## Environment variables in CI

Stored as GitHub Actions secrets:

- `PROD_SSH_HOST`, `PROD_SSH_USER`, `PROD_SSH_KEY`
- `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`
- `SLACK_DEPLOY_WEBHOOK`

Non-secret config is stored as repo "variables" (e.g., `FIRST_DEPLOY`).
