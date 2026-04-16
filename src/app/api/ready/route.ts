/**
 * GET /api/ready — readiness probe.
 *
 * Returns 200 only when all downstream dependencies (database, optionally
 * Redis) are reachable. Orchestrators route traffic here; a failed readiness
 * check pulls the instance out of the load balancer without restarting the
 * container. This is stricter than /api/live.
 */
import { NextResponse } from "next/server";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";

async function checkDb(): Promise<boolean> {
  try {
    await db.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    logger.warn({ err }, "readiness: database check failed");
    return false;
  }
}

async function checkRedis(): Promise<boolean> {
  if (!process.env.REDIS_URL) return true;
  try {
    const { createRedisConnection } = await import("@/lib/redis");
    const redis = createRedisConnection();
    const pong = await redis.ping();
    await redis.quit();
    return pong === "PONG";
  } catch (err) {
    logger.warn({ err }, "readiness: redis check failed");
    return false;
  }
}

export async function GET() {
  const [dbOk, redisOk] = await Promise.all([checkDb(), checkRedis()]);
  const ok = dbOk && redisOk;
  return NextResponse.json(
    {
      status: ok ? "ready" : "not-ready",
      timestamp: new Date().toISOString(),
      checks: { database: dbOk, redis: redisOk },
    },
    { status: ok ? 200 : 503 }
  );
}
