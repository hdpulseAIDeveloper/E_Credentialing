#!/bin/sh
# Flushes this app's BullMQ queues on the shared prod Redis.
#
# Usage: sh scripts/flush-stale-bull-queues.sh
#
# Only removes keys under the three queue prefixes used by this app:
#   bull:psv-bot:*        (PSV credentialing bots)
#   bull:enrollment-bot:* (payer enrollment bots)
#   bull:scheduled-jobs:* (expirables/sanctions cadence)
# Other apps sharing this Redis instance are untouched.
set -e

REDIS_HOST="${REDIS_HOST:-host.docker.internal}"
REDIS_PORT="${REDIS_PORT:-6379}"

flush_queue() {
  queue="$1"
  pattern="bull:${queue}:*"
  count=$(docker exec ecred-worker-prod sh -c \
    "redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} --scan --pattern '${pattern}' | \
     xargs -r -n 500 redis-cli -h ${REDIS_HOST} -p ${REDIS_PORT} UNLINK | \
     awk '{s+=\$1} END {print s+0}'")
  printf "  ✓ %-20s %s keys removed\n" "${queue}" "${count}"
}

echo "Flushing stale BullMQ queues on ${REDIS_HOST}:${REDIS_PORT}…"
flush_queue psv-bot
flush_queue enrollment-bot
flush_queue scheduled-jobs
echo "Done."
