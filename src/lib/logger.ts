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

export const logger = pino({
  level: process.env.LOG_LEVEL ?? (isDev ? "debug" : "info"),
  redact: {
    paths: PHI_REDACT_PATHS,
    remove: false,
    censor: "[REDACTED]",
  },
  transport: isDev
    ? {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss.l" },
      }
    : undefined,
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
