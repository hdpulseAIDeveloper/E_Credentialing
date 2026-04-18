/**
 * Tenant-aware Prisma client extension — Wave 5.1 (multi-tenancy shim).
 *
 * Wraps every PHI/business-critical model with a `$allOperations`
 * extension that:
 *   - on `create` / `createMany` / `upsert`: injects the active
 *     organizationId into `data` (only if the caller didn't supply
 *     one).
 *   - on `findMany` / `findFirst` / `findUnique` / `update*` /
 *     `delete*` / `count` / `aggregate` / `groupBy`: injects an
 *     `organizationId` clause into `where`.
 *
 * Bypass:
 *   - Calls running inside `dangerouslyBypassTenantScope(...)` are
 *     passed through untouched.
 *   - Calls with an unset ALS slot fall back to the default tenant
 *     (`org_essen`) so single-tenant deploys keep working.
 *
 * Models in scope (the "tenant-scoped" set) are listed in
 * `TENANT_SCOPED_MODELS`. Any model NOT in that list is global
 * (e.g., `NcqaCriterion`, `AppSetting`, `PrivilegeCategory`,
 * `TrainingCourse`, `ComplianceControl` — content-catalog tables
 * shared across tenants).
 *
 * Anti-weakening:
 *   - NEVER add a model to the "global" implicit list to silence a
 *     "missing organizationId" runtime error. If the model holds PHI
 *     or business state, add it to `TENANT_SCOPED_MODELS` AND add the
 *     column in the schema.
 *   - NEVER set `multiTenantEnabled: false` to make the extension a
 *     no-op in production. Single-tenant mode still injects
 *     `org_essen` — the difference is *only* whether the ALS slot
 *     overrides that default.
 */
import { Prisma } from "@prisma/client";
import {
  DEFAULT_TENANT_ID,
  getTenantScope,
  isBypassScope,
} from "./tenant-context";

/**
 * Models that have an `organizationId` column in the schema. Order
 * matches `prisma/schema.prisma` so a Ctrl-F line up is one-to-one.
 *
 * Wave 5.1.a ships with a *minimal* set (User, Provider, Document,
 * AuditLog, BotRun) so the migration is small and reviewable. Subsequent
 * sub-waves widen the set to every PHI-bearing model per ADR 0014.
 */
export const TENANT_SCOPED_MODELS = [
  "User",
  "Provider",
  "Document",
  "AuditLog",
  "BotRun",
] as const;

export type TenantScopedModel = (typeof TENANT_SCOPED_MODELS)[number];

const SCOPED_SET = new Set<string>(TENANT_SCOPED_MODELS);

const READ_OPS = new Set([
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "findUnique",
  "findUniqueOrThrow",
  "count",
  "aggregate",
  "groupBy",
]);

const UPDATE_OPS = new Set([
  "update",
  "updateMany",
  "delete",
  "deleteMany",
]);

const CREATE_OPS = new Set(["create", "createMany", "upsert"]);

interface ExtensionOpts {
  /**
   * Hard-codes a tenant id, ignoring the ALS slot. Used by the unit
   * tests so we don't need to wire AsyncLocalStorage into Vitest.
   */
  tenantIdOverride?: string;
}

/**
 * Returns a Prisma client extension that auto-injects organizationId.
 * Use it like: `db.$extends(tenantExtension())`.
 */
export function tenantExtension(opts: ExtensionOpts = {}) {
  return Prisma.defineExtension((client) => {
    return client.$extends({
      name: "ecred-tenant-scope",
      query: {
        $allModels: {
          async $allOperations({ model, operation, args, query }) {
            // Models without an `organizationId` column flow through
            // untouched.
            if (!model || !SCOPED_SET.has(model)) {
              return query(args);
            }

            const scope = getTenantScope();
            if (scope && isBypassScope(scope)) {
              return query(args);
            }

            const tenantId =
              opts.tenantIdOverride ??
              scope?.organizationId ??
              DEFAULT_TENANT_ID;

            const next = injectTenant(operation, args, tenantId);
            return query(next);
          },
        },
      },
    });
  });
}

/**
 * Pure helper — kept exported (no `db` dependency) so the unit test
 * can validate the where/data injection without spinning up Prisma.
 */
export function injectTenant<T extends Record<string, any>>(
  operation: string,
  args: T,
  tenantId: string,
): T {
  const a: any = { ...(args ?? {}) };

  if (CREATE_OPS.has(operation)) {
    if (operation === "createMany") {
      const data = Array.isArray(a.data) ? a.data : [a.data];
      a.data = data.map((row: any) => ({
        organizationId: tenantId,
        ...(row ?? {}),
      }));
    } else if (operation === "upsert") {
      // Tenant filter on the unique-key `where` would break the look-up,
      // so we only inject on the `create` branch.
      a.create = {
        organizationId: tenantId,
        ...(a.create ?? {}),
      };
    } else {
      // create
      a.data = {
        organizationId: tenantId,
        ...(a.data ?? {}),
      };
    }
  } else if (READ_OPS.has(operation) || UPDATE_OPS.has(operation)) {
    a.where = mergeTenantClause(a.where, tenantId);
  }

  return a as T;
}

function mergeTenantClause(
  existing: Record<string, any> | undefined,
  tenantId: string,
): Record<string, any> {
  const e = existing ?? {};
  // If an explicit tenant filter is already set, leave it alone — the
  // caller is doing something deliberate (probably inside a bypass).
  if (Object.prototype.hasOwnProperty.call(e, "organizationId")) {
    return e;
  }
  return { ...e, organizationId: tenantId };
}
