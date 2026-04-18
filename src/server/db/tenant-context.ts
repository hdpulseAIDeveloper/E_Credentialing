/**
 * Tenant context — Wave 5.1 (multi-tenancy shim).
 *
 * Per-request AsyncLocalStorage that carries the active organizationId
 * from the Next.js middleware (which extracts it from the auth session)
 * down to every Prisma query without us threading it through call
 * arguments.
 *
 * Architecture (per ADR 0014):
 *   request → src/middleware.ts (auth) → withTenant(orgId, () => …)
 *           → tRPC handlers / route handlers
 *           → db (extended with `tenant-extension.ts`)
 *           → reads/writes auto-scoped by organizationId
 *
 * Single-tenant compatibility:
 *   - Every legacy row was backfilled with `org_essen` by the
 *     migration in this same wave.
 *   - When `MULTI_TENANT_ENABLED` is false (default), the extension
 *     defaults the tenant id to `org_essen` when the ALS slot is
 *     empty so every existing call site keeps working unchanged.
 *
 * Anti-weakening (STANDARD.md §4.2):
 *   - DO NOT add an `await` between reading the ALS slot and using its
 *     value — that's how cross-tenant leaks happen.
 *   - DO NOT export `tenantStorage.enterWith` — `run`/`withTenant` are
 *     the only legal entry points.
 */
import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantScope {
  organizationId: string;
  /**
   * If true, the tenant extension allows cross-tenant reads — used by
   * the super-admin global-search surface gated behind step-up MFA.
   * Defaults to false.
   */
  superAdmin?: boolean;
}

export const DEFAULT_TENANT_ID = "org_essen";

const tenantStorage = new AsyncLocalStorage<TenantScope>();

export function withTenant<T>(scope: TenantScope, fn: () => T): T {
  return tenantStorage.run(scope, fn);
}

export function getTenantScope(): TenantScope | undefined {
  return tenantStorage.getStore();
}

export function getTenantId(): string {
  const scope = tenantStorage.getStore();
  if (scope?.organizationId) return scope.organizationId;
  // Single-tenant fallback: the backfilled default.
  return DEFAULT_TENANT_ID;
}

export function isSuperAdminScope(): boolean {
  return Boolean(tenantStorage.getStore()?.superAdmin);
}

/**
 * Escape hatch for narrow operations that legitimately span tenants
 * (e.g., daily cross-tenant aggregations for billing, the super-admin
 * org-CRUD endpoint). Wrapped code runs without the tenant filter.
 *
 * IMPORTANT: this symbol is restricted by the ESLint rule
 * `ecred-local/no-tenant-bypass` to files matching
 * `src/server/db/internal/**` — NEVER import it from a router or UI.
 */
export function dangerouslyBypassTenantScope<T>(fn: () => T): T {
  return tenantStorage.run({ organizationId: "__bypass__", superAdmin: true }, fn);
}

export function isBypassScope(scope: TenantScope | undefined): boolean {
  return scope?.organizationId === "__bypass__";
}
