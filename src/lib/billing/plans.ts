/**
 * Wave 5.3 — Stripe billing plan catalog.
 *
 * Single source of truth for plan ids, display names, and Stripe price
 * env-var bindings. The /pricing page and the /settings/billing UI
 * both read from this module so we never duplicate prices.
 *
 * Anti-weakening:
 *   - Plan slugs are hard-coded and stable; never rename a slug,
 *     only deprecate (mark `archived: true`) and add a new one.
 *   - Stripe price IDs are NEVER hard-coded; they live in env so
 *     dev/staging/prod can each have their own live/test mode prices.
 */

export type PlanSlug = "starter" | "growth" | "enterprise";

export interface PlanDefinition {
  slug: PlanSlug;
  displayName: string;
  /**
   * Marketing tagline used on /pricing and the in-app upsell modal.
   * Kept short on purpose (≤ 80 chars).
   */
  tagline: string;
  /**
   * Indicative monthly price, in USD cents. Used to render the
   * /pricing page when Stripe is disabled. The authoritative price is
   * always the Stripe `unit_amount` looked up at checkout time.
   */
  indicativePriceCents: number;
  priceUnit: "month" | "month-per-provider";
  /**
   * Env-var name that holds the Stripe Price id (price_xxx) for this
   * plan. Resolved by `resolveStripePriceId(slug)` below.
   */
  stripePriceEnv:
    | "STRIPE_PRICE_STARTER"
    | "STRIPE_PRICE_GROWTH"
    | "STRIPE_PRICE_ENTERPRISE";
  features: string[];
  /**
   * Maximum number of providers allowed on this plan. `null` = no
   * cap (used by enterprise). Enforced at the application layer in
   * `assertWithinPlanLimits()`; Stripe metering wires later.
   */
  maxProviders: number | null;
  /** Soft-archive a plan instead of deleting it. */
  archived?: boolean;
}

export const PLANS: Record<PlanSlug, PlanDefinition> = {
  starter: {
    slug: "starter",
    displayName: "Starter",
    tagline: "Up to 25 providers. Everything NCQA needs to certify a small group.",
    indicativePriceCents: 49_900,
    priceUnit: "month",
    stripePriceEnv: "STRIPE_PRICE_STARTER",
    maxProviders: 25,
    features: [
      "Up to 25 active providers",
      "All 13 NCQA primary-source verifications",
      "Document AI extraction + reminders",
      "Single tenant",
      "Email support",
    ],
  },
  growth: {
    slug: "growth",
    displayName: "Growth",
    tagline: "Up to 250 providers. Adds OPPE/FPPE, telehealth, and the FHIR directory.",
    indicativePriceCents: 199_900,
    priceUnit: "month",
    stripePriceEnv: "STRIPE_PRICE_GROWTH",
    maxProviders: 250,
    features: [
      "Up to 250 active providers",
      "Everything in Starter",
      "OPPE / FPPE workflow",
      "Telehealth coverage gap UI",
      "FHIR R4 public directory",
      "Slack + email support",
    ],
  },
  enterprise: {
    slug: "enterprise",
    displayName: "Enterprise",
    tagline: "Unlimited providers, multi-org tenancy, audit-log export, named CSM.",
    indicativePriceCents: 0, // contact sales — pricing is per-deal
    priceUnit: "month",
    stripePriceEnv: "STRIPE_PRICE_ENTERPRISE",
    maxProviders: null,
    features: [
      "Unlimited providers",
      "Everything in Growth",
      "Multi-org tenancy + SSO/SCIM",
      "Auditor-package one-click export",
      "Custom DPA + BAA",
      "Named customer success manager",
    ],
  },
};

/**
 * Returns the configured Stripe Price id for a plan, or `null` if the
 * env var isn't set. Callers MUST handle `null` (in particular, the
 * checkout route returns 503 with a clear error).
 */
export function resolveStripePriceId(slug: PlanSlug): string | null {
  const def = PLANS[slug];
  if (!def) return null;
  // Read from process.env directly: the price IDs are optional in
  // src/env.ts (different per env), so reading them lazily lets us
  // surface a useful error rather than crashing at boot.
  const value = process.env[def.stripePriceEnv];
  return value && value.trim().length > 0 ? value : null;
}

export function listActivePlans(): PlanDefinition[] {
  return Object.values(PLANS).filter((p) => !p.archived);
}

export function getPlan(slug: string): PlanDefinition | null {
  if (slug in PLANS) return PLANS[slug as PlanSlug];
  return null;
}

/**
 * Hard-coded enforcement helper used at the application layer until
 * we wire Stripe usage records. Returns `null` if the org is within
 * its limits, or a structured error object that callers can surface.
 */
export function assertWithinPlanLimits(args: {
  planSlug: string;
  currentProviderCount: number;
}): { ok: true } | { ok: false; reason: string } {
  const plan = getPlan(args.planSlug) ?? PLANS.starter;
  if (plan.maxProviders === null) return { ok: true };
  if (args.currentProviderCount <= plan.maxProviders) return { ok: true };
  return {
    ok: false,
    reason: `Plan "${plan.displayName}" allows up to ${plan.maxProviders} providers; current count is ${args.currentProviderCount}.`,
  };
}
