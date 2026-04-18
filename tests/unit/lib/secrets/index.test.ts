/**
 * Unit tests for src/lib/secrets — naming convention enforcement,
 * env-var fallback rules, cache behavior, and prod fail-closed semantics.
 *
 * These freeze the contract that the secret resolver MUST refuse to
 * fetch a misnamed secret AND MUST refuse env-var fallback in production
 * unless ALLOW_ENV_FALLBACK_IN_PROD=1 is explicitly set.
 *
 * The Azure Key Vault module is mocked out — we never want a unit test
 * to attempt a real network call.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the lower-level Key Vault module BEFORE importing the secrets module.
const mockGetSecret = vi.fn<(name: string) => Promise<string>>();
const mockGetSecretOptional = vi.fn<(name: string) => Promise<string | null>>();
vi.mock("@/lib/azure/keyvault", () => ({
  getSecret: (name: string) => mockGetSecret(name),
  getSecretOptional: (name: string) => mockGetSecretOptional(name),
}));

// And silence the logger so tests don't spam stdout.
vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  InvalidSecretNameError,
  SECRETS,
  SecretFetchError,
  clearSecretCache,
  envVarFor,
  optionalSecret,
  requireSecret,
  resolveSecret,
  secretName,
} from "@/lib/secrets";

beforeEach(() => {
  vi.unstubAllEnvs();
  delete process.env.AZURE_KEY_VAULT_URL;
  delete process.env.ALLOW_ENV_FALLBACK_IN_PROD;
  delete process.env.ECRED_DEV_BOT_AVAILITY_USERNAME;
  delete process.env.ECRED_DEV_BOT_AVAILITY_PASSWORD;
  delete process.env.ECRED_PROD_BOT_AVAILITY_USERNAME;
  vi.stubEnv("NODE_ENV", "development");
  mockGetSecret.mockReset();
  mockGetSecretOptional.mockReset();
  clearSecretCache();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("naming convention", () => {
  it("accepts valid bot secret names", () => {
    expect(secretName({ env: "prod", scope: "bot-availity", purpose: "username" })).toBe(
      "ecred-prod-bot-availity-username",
    );
    expect(secretName({ env: "dev", scope: "bot-dea", purpose: "totp" })).toBe(
      "ecred-dev-bot-dea-totp",
    );
  });

  it("accepts valid integration secret names", () => {
    expect(secretName({ env: "prod", scope: "integration-sendgrid", purpose: "api-key" })).toBe(
      "ecred-prod-integration-sendgrid-api-key",
    );
  });

  it("accepts core and observability scopes", () => {
    expect(secretName({ env: "prod", scope: "core", purpose: "hmac" })).toBe(
      "ecred-prod-core-hmac",
    );
    expect(secretName({ env: "prod", scope: "observability", purpose: "dsn" })).toBe(
      "ecred-prod-observability-dsn",
    );
  });

  it("rejects names that don't match the pattern", async () => {
    await expect(resolveSecret("foo")).rejects.toBeInstanceOf(InvalidSecretNameError);
    await expect(resolveSecret("ecred-bot-availity-username")).rejects.toBeInstanceOf(
      InvalidSecretNameError,
    );
    await expect(resolveSecret("ECRED-PROD-BOT-AVAILITY-USERNAME")).rejects.toBeInstanceOf(
      InvalidSecretNameError,
    );
    await expect(resolveSecret("ecred-prod-bot-availity-extra-username")).rejects.toBeInstanceOf(
      InvalidSecretNameError,
    );
  });

  it("envVarFor uppercases and underscores", () => {
    expect(envVarFor("ecred-prod-bot-availity-username")).toBe("ECRED_PROD_BOT_AVAILITY_USERNAME");
  });
});

describe("resolution order — Key Vault available", () => {
  beforeEach(() => {
    process.env.AZURE_KEY_VAULT_URL = "https://example.vault.azure.net/";
  });

  it("returns the Key Vault value when present", async () => {
    mockGetSecret.mockResolvedValueOnce("kv-value");
    const v = await resolveSecret("ecred-prod-bot-availity-username");
    expect(v).toBe("kv-value");
    expect(mockGetSecret).toHaveBeenCalledWith("ecred-prod-bot-availity-username");
  });

  it("caches values for repeated calls", async () => {
    mockGetSecret.mockResolvedValueOnce("kv-value");
    const v1 = await resolveSecret("ecred-prod-bot-availity-username");
    const v2 = await resolveSecret("ecred-prod-bot-availity-username");
    expect(v1).toBe("kv-value");
    expect(v2).toBe("kv-value");
    expect(mockGetSecret).toHaveBeenCalledTimes(1);
  });

  it("noCache forces a fresh fetch", async () => {
    mockGetSecret.mockResolvedValueOnce("v1").mockResolvedValueOnce("v2");
    const v1 = await resolveSecret("ecred-prod-bot-availity-username");
    const v2 = await resolveSecret("ecred-prod-bot-availity-username", { noCache: true });
    expect(v1).toBe("v1");
    expect(v2).toBe("v2");
    expect(mockGetSecret).toHaveBeenCalledTimes(2);
  });
});

describe("env-var fallback rules", () => {
  it("falls back to env var in development when vault is not configured", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.ECRED_DEV_BOT_AVAILITY_USERNAME = "from-env";
    const v = await resolveSecret("ecred-dev-bot-availity-username");
    expect(v).toBe("from-env");
  });

  it("refuses env-var fallback in production by default", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ECRED_PROD_BOT_AVAILITY_USERNAME = "from-env";
    await expect(
      resolveSecret("ecred-prod-bot-availity-username"),
    ).rejects.toBeInstanceOf(SecretFetchError);
  });

  it("allows env-var fallback in production when explicitly opted in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.ALLOW_ENV_FALLBACK_IN_PROD = "1";
    process.env.ECRED_PROD_BOT_AVAILITY_USERNAME = "from-env";
    const v = await resolveSecret("ecred-prod-bot-availity-username");
    expect(v).toBe("from-env");
  });

  it("returns null on missing optional secret without throwing", async () => {
    const v = await optionalSecret("ecred-dev-bot-availity-password");
    expect(v).toBeNull();
  });

  it("requireSecret throws SecretFetchError on miss", async () => {
    await expect(requireSecret("ecred-dev-bot-availity-password")).rejects.toBeInstanceOf(
      SecretFetchError,
    );
  });
});

describe("vault failure semantics", () => {
  it("falls back to env var in dev when Key Vault throws", async () => {
    process.env.AZURE_KEY_VAULT_URL = "https://example.vault.azure.net/";
    process.env.ECRED_DEV_BOT_AVAILITY_USERNAME = "from-env-fallback";
    mockGetSecret.mockRejectedValueOnce(new Error("transient"));
    const v = await resolveSecret("ecred-dev-bot-availity-username");
    expect(v).toBe("from-env-fallback");
  });

  it("re-throws Key Vault errors in production without fallback opt-in", async () => {
    vi.stubEnv("NODE_ENV", "production");
    process.env.AZURE_KEY_VAULT_URL = "https://example.vault.azure.net/";
    process.env.ECRED_PROD_BOT_AVAILITY_USERNAME = "from-env-fallback";
    mockGetSecret.mockRejectedValueOnce(new Error("AccessDenied"));
    await expect(
      resolveSecret("ecred-prod-bot-availity-username"),
    ).rejects.toBeInstanceOf(SecretFetchError);
  });
});

describe("SECRETS catalog", () => {
  it("composes well-formed names through the catalog", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(SECRETS.bot.availity.username()).toBe("ecred-prod-bot-availity-username");
    expect(SECRETS.bot.dea.totp()).toBe("ecred-prod-bot-dea-totp");
    expect(SECRETS.integration.sendgrid.apiKey()).toBe(
      "ecred-prod-integration-sendgrid-api-key",
    );
    expect(SECRETS.core.auditHmac()).toBe("ecred-prod-core-hmac");
    expect(SECRETS.observability.sentryDsn()).toBe("ecred-prod-observability-dsn");
  });

  it("supports an explicit env override for cross-env operations", () => {
    expect(SECRETS.bot.availity.username("staging")).toBe(
      "ecred-staging-bot-availity-username",
    );
  });
});
