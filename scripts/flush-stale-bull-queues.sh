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

REDIS_CONTAINER="${REDIS_CONTAINER:-vms-redis-prod}"

flush_queue() {
  queue="$1"
  pattern="bull:${queue}:*"
  # Use a Lua script inside Redis so the SCAN + UNLINK happen in one round trip
  # and we don't have to shell-pipe 168k keys. Returns the total key count.
  count=$(docker exec "${REDIS_CONTAINER}" redis-cli --no-raw EVAL "
    local cursor = '0'
    local removed = 0
    repeat
      local res = redis.call('SCAN', cursor, 'MATCH', ARGV[1], 'COUNT', 1000)
      cursor = res[1]
      for _, k in ipairs(res[2]) do
        redis.call('UNLINK', k)
        removed = removed + 1
      end
    until cursor == '0'
    return removed
  " 0 "${pattern}" | tr -d '()"' | awk '{print $NF}')
  printf "  OK %-20s %s keys removed\n" "${queue}" "${count}"
}

echo "Flushing stale BullMQ queues via ${REDIS_CONTAINER}..."
flush_queue psv-bot
flush_queue enrollment-bot
flush_queue scheduled-jobs
echo "Done."
