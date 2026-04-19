import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

/**
 * Optional URL env var that tolerates operator placeholders.
 *
 * Why this exists (DEF-0016): production `.env` files in the wild
 * routinely contain literal placeholder strings ("placeholder",
 * "changeme", "TBD", "null") for optional integrations that haven't
 * been wired up yet. With a plain `z.string().url().optional()`, those
 * non-empty-but-not-a-URL values fail validation at `next build` page
 * data collection time and break the entire production image build —
 * even though the field is supposed to be *optional* and the runtime
 * code already handles `undefined` via the `.optional()` contract.
 *
 * This helper preserves strict URL validation when the operator has
 * actually entered a URL ("https://…" / "http://…"), but coerces
 * any non-URL value (including `"placeholder"`) to `undefined` so
 * the optional contract is honored end-to-end.
 *
 * Anti-weakening: this does NOT relax validation for *required*
 * URL fields (`DATABASE_URL`, `NEXT_PUBLIC_APP_URL`); those keep
 * the strict `z.string().url()` shape. It only widens the
 * already-`.optional()` URL fields, which is the contract the
 * application code was already coded against.
 */
const optionalUrl = z.preprocess((v) => {
  if (typeof v !== "string") return v;
  const trimmed = v.trim();
  if (trimmed === "") return undefined;
  if (!/^https?:\/\//i.test(trimmed)) return undefined;
  return trimmed;
}, z.string().url().optional());

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    DATABASE_URL: z.string().url(),
    REDIS_HOST: z.string().default("localhost"),
    REDIS_PORT: z.coerce.number().default(6379),
    AZURE_AD_TENANT_ID: z.string().min(1),
    AZURE_AD_CLIENT_ID: z.string().min(1),
    AZURE_AD_CLIENT_SECRET: z.string().min(1),
    NEXTAUTH_SECRET: z.string().min(1),
    NEXTAUTH_URL: optionalUrl,
    AZURE_KEY_VAULT_URL: optionalUrl,
    AZURE_BLOB_ACCOUNT_URL: optionalUrl,
    AZURE_BLOB_CONTAINER: z.string().default("essen-credentialing"),
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: optionalUrl,
    AZURE_COMMUNICATION_SERVICES_ENDPOINT: optionalUrl,
    SENDGRID_API_KEY: z.string().optional(),
    SENDGRID_FROM_EMAIL: z.string().email().default("cred_onboarding@essenmed.com"),
    ENCRYPTION_KEY: z.string().min(1),
    BULL_BOARD_PORT: z.coerce.number().default(6025),
    SAM_GOV_API_KEY: z.string().optional(),
    BILLING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRICE_STARTER: z.string().optional(),
    STRIPE_PRICE_GROWTH: z.string().optional(),
    STRIPE_PRICE_ENTERPRISE: z.string().optional(),
    STRIPE_BILLING_PORTAL_RETURN_URL: optionalUrl,
  },
  client: {
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:6015"),
    NEXT_PUBLIC_BILLING_ENABLED: z
      .enum(["true", "false"])
      .default("false")
      .transform((v) => v === "true"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_HOST: process.env.REDIS_HOST,
    REDIS_PORT: process.env.REDIS_PORT,
    AZURE_AD_TENANT_ID: process.env.AZURE_AD_TENANT_ID,
    AZURE_AD_CLIENT_ID: process.env.AZURE_AD_CLIENT_ID,
    AZURE_AD_CLIENT_SECRET: process.env.AZURE_AD_CLIENT_SECRET,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AZURE_KEY_VAULT_URL: process.env.AZURE_KEY_VAULT_URL,
    AZURE_BLOB_ACCOUNT_URL: process.env.AZURE_BLOB_ACCOUNT_URL,
    AZURE_BLOB_CONTAINER: process.env.AZURE_BLOB_CONTAINER,
    AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT: process.env.AZURE_DOCUMENT_INTELLIGENCE_ENDPOINT,
    AZURE_COMMUNICATION_SERVICES_ENDPOINT: process.env.AZURE_COMMUNICATION_SERVICES_ENDPOINT,
    SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
    SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    BULL_BOARD_PORT: process.env.BULL_BOARD_PORT,
    SAM_GOV_API_KEY: process.env.SAM_GOV_API_KEY,
    BILLING_ENABLED: process.env.BILLING_ENABLED,
    STRIPE_SECRET_KEY: process.env.STRIPE_SECRET_KEY,
    STRIPE_WEBHOOK_SECRET: process.env.STRIPE_WEBHOOK_SECRET,
    STRIPE_PRICE_STARTER: process.env.STRIPE_PRICE_STARTER,
    STRIPE_PRICE_GROWTH: process.env.STRIPE_PRICE_GROWTH,
    STRIPE_PRICE_ENTERPRISE: process.env.STRIPE_PRICE_ENTERPRISE,
    STRIPE_BILLING_PORTAL_RETURN_URL: process.env.STRIPE_BILLING_PORTAL_RETURN_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_BILLING_ENABLED: process.env.NEXT_PUBLIC_BILLING_ENABLED,
  },
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
