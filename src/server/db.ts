import { PrismaClient } from "@prisma/client";
import { tenantExtension } from "./db/tenant-extension";

/**
 * Wave 5.1 — db now ships through the tenant-aware Prisma extension
 * (see ADR 0014 + src/server/db/tenant-context.ts). Single-tenant
 * deploys are unaffected: the extension defaults to the backfilled
 * `org_essen` tenant id when the AsyncLocalStorage slot is empty.
 *
 * `dbRaw` is the un-scoped client and is exported for the rare
 * legitimate caller (e.g., the BullMQ worker bootstrap that needs to
 * scan rows across tenants). Importing `dbRaw` from a tRPC router or
 * UI component is blocked by the `ecred-local/no-tenant-bypass`
 * ESLint rule.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const dbRaw =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = dbRaw;

export const db = dbRaw.$extends(tenantExtension()) as unknown as PrismaClient;
