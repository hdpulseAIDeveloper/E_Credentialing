/**
 * src/lib/secrets — Key Vault access with naming-convention enforcement.
 *
 * Wraps the lower-level `src/lib/azure/keyvault.ts` client with three things
 * production needs and the raw client does not provide:
 *
 *   1. Naming convention enforcement (B-005). Every secret name MUST match
 *      `ecred-<env>-<scope>-<purpose>` where:
 *        - env    = dev | staging | prod
 *        - scope  = bot-<portal> | integration-<name> | core | observability
 *        - purpose = username | password | totp | api-key | hmac | dsn | conn
 *      The fetcher rejects names that do not match. This keeps the vault
 *      tidy and makes role-grant audits straightforward.
 *
 *   2. Graceful env-var fallback. In dev / CI the secret can come from
 *      process.env. In prod we hard-fail-closed: the fallback is disabled
 *      via NODE_ENV=production unless `ALLOW_ENV_FALLBACK_IN_PROD=1` is
 *      explicitly set (audit-logged on first access, see emit-fallback-warning).
 *
 *   3. In-memory caching with TTL so a bot run does not hit Key Vault on
 *      every step. Default TTL: 10 minutes. Cleared on `clearSecretCache()`.
 *
 * The legacy `KeyVaultSecrets` map in `src/lib/azure/keyvault.ts` predates
 * the naming convention. New code SHOULD import `Secret` from this module.
 * The legacy export remains for back-compat and is deprecated.
 *
 * Audit: every successful fetch and every fallback emits a structured pino
 * log line with `secretName` (NEVER the value). See ADR 0014.
 */

import { getSecret, getSecretOptional } from "@/lib/azure/keyvault";
import { logger } from "@/lib/logger";

// ─── Naming convention ───────────────────────────────────────────────────

const ENV_SEGMENT = ["dev", "staging", "prod"] as const;
const PURPOSE_SEGMENT = [
  "username",
  "password",
  "totp",
  "api-key",
  "hmac",
  "dsn",
  "conn",
  "key",
  "secret",
] as const;

type Env = (typeof ENV_SEGMENT)[number];
type Purpose = (typeof PURPOSE_SEGMENT)[number];

/**
 * Strict regex for the agreed naming convention. Examples:
 *   ecred-prod-bot-availity-username
 *   ecred-prod-integration-sendgrid-api-key
 *   ecred-prod-core-audit-hmac
 *   ecred-prod-observability-sentry-dsn
 */
const NAME_PATTERN =
  /^ecred-(dev|staging|prod)-(bot-[a-z0-9]+|integration-[a-z0-9]+|core|observability)-(username|password|totp|api-key|hmac|dsn|conn|key|secret)$/;

export class InvalidSecretNameError extends Error {
  readonly name = "InvalidSecretNameError";
  constructor(secretName: string) {
    super(
      `Secret name "${secretName}" does not match the convention ` +
        `ecred-<env>-<scope>-<purpose>. See src/lib/secrets/index.ts.`,
    );
  }
}

export class SecretFetchError extends Error {
  readonly name = "SecretFetchError";
  constructor(secretName: string, cause: unknown) {
    super(`Failed to fetch secret "${secretName}": ${(cause as Error).message ?? cause}`);
  }
}

/**
 * Compose a properly-named secret key. Use this in code instead of inlining
 * literal strings — typos become compile errors.
 */
export function secretName(parts: {
  env: Env;
  scope: `bot-${string}` | `integration-${string}` | "core" | "observability";
  purpose: Purpose;
}): string {
  const name = `ecred-${parts.env}-${parts.scope}-${parts.purpose}`;
  if (!NAME_PATTERN.test(name)) {
    throw new InvalidSecretNameError(name);
  }
  return name;
}

// ─── Cache ───────────────────────────────────────────────────────────────

interface CacheEntry {
  value: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 10 * 60 * 1000;
const cache = new Map<string, CacheEntry>();

export function clearSecretCache(): void {
  cache.clear();
}

// ─── Fetch ───────────────────────────────────────────────────────────────

/** Convert a Key Vault secret name to its env-var fallback name.
 *  Example: ecred-prod-bot-availity-username -> ECRED_PROD_BOT_AVAILITY_USERNAME
 */
export function envVarFor(name: string): string {
  return name.toUpperCase().replace(/-/g, "_");
}

const fallbackWarningEmitted = new Set<string>();

function emitFallbackWarning(name: string): void {
  if (fallbackWarningEmitted.has(name)) return;
  fallbackWarningEmitted.add(name);
  logger.warn(
    { secretName: name, envVar: envVarFor(name) },
    `secret resolved from process.env fallback (Key Vault not consulted). ` +
      `In production this is only allowed when ALLOW_ENV_FALLBACK_IN_PROD=1.`,
  );
}

interface ResolveOpts {
  /** If true, return null on miss instead of throwing. */
  optional?: boolean;
  /** Override env-var name (defaults to envVarFor(name)). */
  envVar?: string;
  /** Bypass cache (forced refresh). */
  noCache?: boolean;
}

/**
 * Resolve a named secret. Order of resolution:
 *   1. In-memory cache (unless noCache).
 *   2. Azure Key Vault (if AZURE_KEY_VAULT_URL is set).
 *   3. process.env fallback (only allowed in non-prod, or with
 *      ALLOW_ENV_FALLBACK_IN_PROD=1).
 *
 * Always validates the name against the convention before any I/O.
 */
export async function resolveSecret(name: string, opts: ResolveOpts = {}): Promise<string | null> {
  if (!NAME_PATTERN.test(name)) {
    throw new InvalidSecretNameError(name);
  }

  if (!opts.noCache) {
    const cached = cache.get(name);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }
  }

  const vaultConfigured = Boolean(process.env.AZURE_KEY_VAULT_URL);

  if (vaultConfigured) {
    try {
      const value = opts.optional ? await getSecretOptional(name) : await getSecret(name);
      if (value !== null && value !== undefined) {
        cache.set(name, { value, expiresAt: Date.now() + CACHE_TTL_MS });
        logger.debug({ secretName: name, source: "keyvault" }, "secret resolved");
        return value;
      }
    } catch (err) {
      if (process.env.NODE_ENV === "production" && process.env.ALLOW_ENV_FALLBACK_IN_PROD !== "1") {
        throw new SecretFetchError(name, err);
      }
      logger.warn({ secretName: name, err: (err as Error).message }, "Key Vault fetch failed; trying env fallback");
    }
  }

  // Fallback path
  const isProd = process.env.NODE_ENV === "production";
  const fallbackAllowed = !isProd || process.env.ALLOW_ENV_FALLBACK_IN_PROD === "1";
  if (!fallbackAllowed) {
    if (opts.optional) return null;
    throw new SecretFetchError(
      name,
      new Error(
        "no value in Key Vault and env fallback disabled in production. " +
          "Either populate the vault entry or set ALLOW_ENV_FALLBACK_IN_PROD=1 (NOT recommended).",
      ),
    );
  }

  const envName = opts.envVar ?? envVarFor(name);
  const value = process.env[envName];
  if (value === undefined || value === "") {
    if (opts.optional) return null;
    throw new SecretFetchError(
      name,
      new Error(`missing in Key Vault and env var ${envName} is unset`),
    );
  }
  emitFallbackWarning(name);
  cache.set(name, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

/** Convenience: required secret. Throws on miss. */
export async function requireSecret(name: string): Promise<string> {
  const v = await resolveSecret(name, { optional: false });
  if (v === null) {
    throw new SecretFetchError(name, new Error("required secret missing"));
  }
  return v;
}

/** Convenience: optional secret. Returns null on miss. */
export async function optionalSecret(name: string): Promise<string | null> {
  return resolveSecret(name, { optional: true });
}

// ─── Well-known names ────────────────────────────────────────────────────

/**
 * Curated catalog of well-known secret names for the bot fleet and core
 * integrations. Use these instead of building names by hand so a typo is
 * caught at compile time.
 *
 * Convention: SECRETS.<scope>.<purpose>(env?) where env defaults to the
 * NODE_ENV-derived value at runtime.
 */
/** Resolve the default env at call time so a NODE_ENV change after module
 * load (test setup, dynamic config) is honored. */
function defaultEnv(): Env {
  const e: string | undefined = process.env.NODE_ENV;
  if (e === "production") return "prod";
  if (e === "staging") return "staging";
  return "dev";
}

function bot(portal: string, purpose: Purpose, env?: Env): string {
  return secretName({ env: env ?? defaultEnv(), scope: `bot-${portal}`, purpose });
}

function integration(name: string, purpose: Purpose, env?: Env): string {
  return secretName({ env: env ?? defaultEnv(), scope: `integration-${name}`, purpose });
}

function core(purpose: Purpose, env?: Env): string {
  return secretName({ env: env ?? defaultEnv(), scope: "core", purpose });
}

function obs(purpose: Purpose, env?: Env): string {
  return secretName({ env: env ?? defaultEnv(), scope: "observability", purpose });
}

export const SECRETS = {
  bot: {
    availity: {
      username: (env?: Env) => bot("availity", "username", env),
      password: (env?: Env) => bot("availity", "password", env),
    },
    mpp: {
      username: (env?: Env) => bot("mpp", "username", env),
      password: (env?: Env) => bot("mpp", "password", env),
    },
    verity: {
      username: (env?: Env) => bot("verity", "username", env),
      password: (env?: Env) => bot("verity", "password", env),
    },
    emedny: {
      username: (env?: Env) => bot("emedny", "username", env),
      password: (env?: Env) => bot("emedny", "password", env),
    },
    npdb: {
      username: (env?: Env) => bot("npdb", "username", env),
      password: (env?: Env) => bot("npdb", "password", env),
    },
    dea: {
      username: (env?: Env) => bot("dea", "username", env),
      password: (env?: Env) => bot("dea", "password", env),
      totp: (env?: Env) => bot("dea", "totp", env),
    },
    caqh: {
      username: (env?: Env) => bot("caqh", "username", env),
      password: (env?: Env) => bot("caqh", "password", env),
    },
  },
  integration: {
    sendgrid: { apiKey: (env?: Env) => integration("sendgrid", "api-key", env) },
    samGov: { apiKey: (env?: Env) => integration("sam-gov", "api-key", env) },
    icims: { apiKey: (env?: Env) => integration("icims", "api-key", env) },
    azureComms: { conn: (env?: Env) => integration("azure-comms", "conn", env) },
    turnstile: {
      siteKey: (env?: Env) => integration("turnstile", "key", env),
      secret: (env?: Env) => integration("turnstile", "secret", env),
    },
    stripe: {
      apiKey: (env?: Env) => integration("stripe", "api-key", env),
      webhookSecret: (env?: Env) => integration("stripe", "secret", env),
    },
  },
  core: {
    auditHmac: (env?: Env) => core("hmac", env),
    encryptionKey: (env?: Env) => core("key", env),
    nextauthSecret: (env?: Env) => core("secret", env),
  },
  observability: {
    sentryDsn: (env?: Env) => obs("dsn", env),
    appInsightsConn: (env?: Env) => obs("conn", env),
  },
} as const;
