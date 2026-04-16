# Getting Started (Local Development)

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 22.x | https://nodejs.org |
| npm | 11.x | bundled with Node |
| Docker Desktop | 29.x | https://www.docker.com/products/docker-desktop |
| Docker Compose | v2.x | bundled with Docker Desktop |
| Git | 2.40+ | https://git-scm.com |
| Python | 3.13 (optional; only for `.claude/deploy.py`) | https://python.org |
| Azure CLI | optional (required if you use Key Vault locally) | https://aka.ms/installazurecliwindows |

Verify:

```bash
node --version   # v22.x
npm --version    # 11.x
docker --version
```

## Clone and install

```bash
git clone <repo-url> E_Credentialing
cd E_Credentialing
npm install --legacy-peer-deps
```

`--legacy-peer-deps` is required because a few peer-dependency ranges are slightly out of step; do not switch to strict resolution without updating them in lockstep.

## Environment file

Copy `.env.example` to `.env` and edit values:

```bash
cp .env.example .env
```

Minimum required values for local dev:

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/e_credentialing_db
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=http://localhost:6015
NEXTAUTH_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<32 random bytes base64>
```

For staff auth locally, set `AUTH_LOCAL_CREDENTIALS=true` to bypass Entra ID and use seeded credentials (dev only).

## Shared local infrastructure

This workspace uses two pre-existing containers for Postgres and Redis:

| Service | Container | Host port |
|---------|-----------|-----------|
| PostgreSQL | `localai-postgres-1` | 5433 |
| Redis | `redis` | 6379 |

If these containers are not already running (e.g., first machine), start them via the `localai` workspace and join the `localai_default` network. See the team wiki for `localai`.

Create the database (one-time):

```bash
docker exec localai-postgres-1 psql -U postgres -c "CREATE DATABASE e_credentialing_db;"
```

## Start the stack

```bash
docker compose -f docker-compose.dev.yml up --build
```

This starts two containers on the `localai_default` network:

- `ecred-web` on `http://localhost:6015`
- `ecred-worker` on `http://localhost:6025` (Bull Board)

Both containers hot-reload on file changes.

## Run migrations

```bash
docker exec ecred-web npx prisma migrate deploy
```

## Seed initial data

```bash
docker exec ecred-web npm run db:seed
```

Seeds: provider types, an admin user, a handful of synthetic providers you can edit freely.

## Sign in

- Open http://localhost:6015
- Click "Sign in"
- Use the credentials printed by the seed script (admin@local / password; also a specialist and committee member role)

## Run without Docker (advanced)

```bash
# In one terminal
npm run dev            # Next.js on :6015
# In another
npm run dev:worker     # Worker + Bull Board on :6025
```

You still need Postgres and Redis running externally.

## Common workflows

### Schema change

1. Edit `prisma/schema.prisma`.
2. `npx prisma migrate dev --name <description>` — creates a migration and applies it.
3. Commit the new migration file under `prisma/migrations/<timestamp>_<description>/`.
4. `npx prisma generate` (usually automatic).

### Run tests

```bash
npm run typecheck
npm run lint
npm run test           # vitest
npm run test:coverage  # vitest with coverage
npm run test:e2e       # Playwright against a running stack
```

### Debug a bot

```bash
npm run bot:headed -- --bot=LICENSE_VERIFICATION --providerId=<id>
```

Runs a single bot with a visible browser window so you can watch it navigate.

### Reset your local database

```bash
docker exec localai-postgres-1 psql -U postgres -c "DROP DATABASE e_credentialing_db;"
docker exec localai-postgres-1 psql -U postgres -c "CREATE DATABASE e_credentialing_db;"
docker exec ecred-web npx prisma migrate deploy
docker exec ecred-web npm run db:seed
```

## Troubleshooting

### `ECONNREFUSED` to Postgres or Redis

Check that `localai-postgres-1` and `redis` are running and on the `localai_default` network:

```bash
docker ps --format "table {{.Names}}\t{{.Networks}}"
```

If not, start `localai` first.

### Prisma types missing after pulling from Git

Run `npx prisma generate` (or `docker exec ecred-web npx prisma generate`).

### Playwright tests fail with missing browser

```bash
npx playwright install --with-deps chromium firefox
```

### Web container loops on startup with "migration failed"

Inspect `docker logs ecred-web`. Usually a migration is expected to fail (e.g., you created a migration that conflicts). Fix the migration in `prisma/migrations/`, then restart.
