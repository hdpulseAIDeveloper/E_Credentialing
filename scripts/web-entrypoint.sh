#!/bin/sh
# Web container entrypoint — runs Prisma migrations, then starts the Next.js standalone server.
#
# NOTE: The Next.js standalone runner stage does NOT include node_modules/.bin,
# so `npx prisma` cannot locate the binary. We invoke the prisma CLI directly
# through its package entry point, which we copy into the runner image.
set -e

PRISMA_CLI="/app/node_modules/prisma/build/index.js"

echo "[entrypoint] Applying Prisma migrations..."
if ! node "$PRISMA_CLI" migrate deploy; then
  echo "[entrypoint] prisma migrate deploy failed; container will not start." >&2
  exit 1
fi

echo "[entrypoint] Migrations applied. Starting Next.js standalone server on :${PORT:-6015}..."
exec node server.js
