/**
 * Structured logger for the ESSEN Credentialing platform.
 *
 * - Uses pino — fast JSON logs in production, pretty output in dev.
 * - Redacts PHI-bearing paths so nothing with SSN / DOB / phone / address
 *   ever reaches stdout or aggregator.
 * - A single module-level logger; callers use child loggers for context.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ providerId }, "created provider");
 *   const log = logger.child({ module: "bots" });
 *   log.error({ err }, "bot failed");
 */
import pino from "pino";

const PHI_REDACT_PATHS = [
  "*.ssn",
  "*.socialSecurityNumber",
  "*.dateOfBirth",
  "*.dob",
  "*.homePhone",
  "*.homeAddressLine1",
  "*.homeAddressLine2",
  "*.homeCity",
  "*.homeState",
  "*.homeZip",
  "*.mobilePhone",
  "*.personalEmail",
  "*.password",
  "*.passwordHash",
  "*.apiKey",
  "*.Authorization",
  "*.authorization",
  "req.headers.authorization",
  "req.headers.cookie",
  "res.headers['set-cookie']",
];

const isDev = process.env.NODE_ENV !== "production";

// We deliberately do NOT use pino's transport worker (`{ transport: { target:
// "pino-pretty" } }`) here. Next.js's webpack runtime cannot reliably resolve
// the pino-pretty worker thread, which produced
//   "uncaughtException: Error: the worker thread exited"
// every time the logger module loaded inside the dev server. JSON output in
// every environment is the right answer for log-aggregator pipelines anyway —
// devs who want pretty output can pipe `docker logs ... | npx pino-pretty`.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: PHI_REDACT_PATHS,
    remove: false,
    censor: "[REDACTED]",
  },
  base: {
    service: "ecred",
    env: process.env.NODE_ENV ?? "development",
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

/**
 * Helper: create a child logger scoped to a single module or request.
 */
export function childLogger(bindings: Record<string, unknown>): pino.Logger {
  return logger.child(bindings);
}
