/**
 * ioredis client singleton for BullMQ queues and pub/sub.
 * Uses REDIS_HOST and REDIS_PORT from environment.
 */

import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

function createRedisClient(): Redis {
  const host = process.env.REDIS_HOST ?? "localhost";
  const port = parseInt(process.env.REDIS_PORT ?? "6379", 10);

  const client = new Redis({
    host,
    port,
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    lazyConnect: true,
  });

  client.on("error", (err) => {
    console.error("[Redis] Connection error:", err);
  });

  client.on("connect", () => {
    console.log(`[Redis] Connected to ${host}:${port}`);
  });

  return client;
}

export const redis = globalForRedis.redis ?? createRedisClient();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

/**
 * Creates a new Redis connection for pub/sub or BullMQ.
 * BullMQ requires separate connections for each Worker/Queue.
 */
export function createRedisConnection(): Redis {
  const host = process.env.REDIS_HOST ?? "localhost";
  const port = parseInt(process.env.REDIS_PORT ?? "6379", 10);

  return new Redis({
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}
