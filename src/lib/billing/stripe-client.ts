/**
 * Wave 5.3 — lazy Stripe SDK loader.
 *
 * Why lazy? The `stripe` package is intentionally imported via a
 * dynamic `await import()` so:
 *
 *   1. Deployments that have BILLING_ENABLED=false do not need to
 *      install the SDK and pay its bundle cost.
 *   2. The SDK never runs at module-load time, so a missing
 *      STRIPE_SECRET_KEY in dev does not crash `next build`.
 *
 * Anti-weakening: do NOT add a top-level `import Stripe from "stripe"`
 * here. The `// eslint-disable-next-line` allowlist on the dynamic
 * import is intentional.
 */

import { env } from "@/env";

let cached: unknown = null;

export interface StripeClientLike {
  customers: {
    create(args: { email?: string; name?: string; metadata?: Record<string, string> }): Promise<{ id: string }>;
    retrieve(id: string): Promise<unknown>;
  };
  checkout: {
    sessions: {
      create(args: unknown): Promise<{ id: string; url: string | null }>;
    };
  };
  billingPortal: {
    sessions: {
      create(args: unknown): Promise<{ id: string; url: string }>;
    };
  };
  subscriptions: {
    retrieve(id: string): Promise<unknown>;
  };
  webhooks: {
    constructEvent(payload: string | Buffer, sig: string, secret: string): { id: string; type: string; data: { object: unknown } };
  };
}

/**
 * Returns a configured Stripe client, or throws a *friendly* error if
 * billing is disabled or the secret key is missing. Callers in
 * route handlers should catch and respond with 503.
 */
export async function getStripeClient(): Promise<StripeClientLike> {
  if (!env.BILLING_ENABLED) {
    throw new BillingDisabledError("Billing is disabled (BILLING_ENABLED=false).");
  }
  if (!env.STRIPE_SECRET_KEY) {
    throw new BillingDisabledError(
      "STRIPE_SECRET_KEY is not configured; set it in the environment to enable billing.",
    );
  }
  if (cached) return cached as StripeClientLike;

  // Dynamic import keeps the SDK out of the bundle when billing is off.
  // The `stripe` package is intentionally NOT in package.json today —
  // installation is the deploy-time act of opting in to billing.
  // We type the module loosely (`any`) so the codebase compiles
  // without `stripe` present; the runtime contract is enforced by
  // the `StripeClientLike` interface above.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import(/* webpackIgnore: true */ "stripe" as string).catch(() => {
    throw new BillingDisabledError(
      "The `stripe` package is not installed. Run `npm install stripe` to enable billing.",
    );
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Ctor: any = mod?.default ?? mod;
  cached = new Ctor(env.STRIPE_SECRET_KEY, {
    apiVersion: "2024-06-20",
    typescript: true,
  });
  return cached as StripeClientLike;
}

export class BillingDisabledError extends Error {
  readonly code = "billing_disabled";
  constructor(message: string) {
    super(message);
    this.name = "BillingDisabledError";
  }
}

/**
 * Resets the cached Stripe client. Used by tests; never call from
 * production code.
 */
export function __resetStripeClientCacheForTests(): void {
  cached = null;
}
