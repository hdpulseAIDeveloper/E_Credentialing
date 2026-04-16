#!/bin/sh
# Web container entrypoint — runs Prisma migrations, then starts the Next.js standalone server.
set -e

echo "[entrypoint] Applying Prisma migrations..."
if ! npx prisma migrate deploy; then
  echo "[entrypoint] prisma migrate deploy failed; container will not start." >&2
  exit 1
fi

echo "[entrypoint] Migrations applied. Starting Next.js standalone server on :${PORT:-6015}..."
exec node server.js
