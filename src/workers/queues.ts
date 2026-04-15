/**
 * BullMQ queue definitions.
 * All queues use the Redis connection from src/lib/redis.ts.
 */

import { Queue, QueueOptions } from "bullmq";
import { createRedisConnection } from "../lib/redis";

const defaultQueueOptions: Partial<QueueOptions> = {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 200 },
  },
};

// ─── PSV Bot Queue (High Priority) ────────────────────────────────────────────
export const psvBotQueue = new Queue("psv-bot", {
  connection: createRedisConnection(),
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 1, // High priority
  },
});

// ─── Enrollment Bot Queue (Medium Priority) ───────────────────────────────────
export const enrollmentBotQueue = new Queue("enrollment-bot", {
  connection: createRedisConnection(),
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 5, // Medium priority
  },
});

// ─── Scheduled Job Queue (Low Priority) ──────────────────────────────────────
export const scheduledJobQueue = new Queue("scheduled-jobs", {
  connection: createRedisConnection(),
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    priority: 10, // Low priority
  },
});

export type PsvBotJobData = {
  botRunId: string;
  providerId: string;
};

export type ScheduledJobData = {
  jobType: "expirables-scan" | "sanctions-monthly" | "follow-up-cadence";
  runDate: string;
};
