/**
 * Azure Key Vault client for retrieving secrets.
 * Uses DefaultAzureCredential (Managed Identity in production, az login in dev).
 */

import { SecretClient } from "@azure/keyvault-secrets";
import { DefaultAzureCredential } from "@azure/identity";

let _secretClient: SecretClient | null = null;

function getSecretClient(): SecretClient {
  if (_secretClient) return _secretClient;

  const vaultUrl = process.env.AZURE_KEY_VAULT_URL;
  if (!vaultUrl) {
    throw new Error("AZURE_KEY_VAULT_URL environment variable is not set");
  }

  _secretClient = new SecretClient(vaultUrl, new DefaultAzureCredential());
  return _secretClient;
}

/**
 * Retrieves a secret value from Azure Key Vault by secret name.
 * Returns the secret value string.
 * Throws if the secret is not found or access is denied.
 */
export async function getSecret(secretName: string): Promise<string> {
  const client = getSecretClient();
  const secret = await client.getSecret(secretName);

  if (!secret.value) {
    throw new Error(`Secret "${secretName}" has no value in Key Vault`);
  }

  return secret.value;
}

/**
 * Retrieves a secret, returning null if not found (rather than throwing).
 * Useful for optional secrets.
 */
export async function getSecretOptional(
  secretName: string
): Promise<string | null> {
  try {
    return await getSecret(secretName);
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      (error.message.includes("SecretNotFound") ||
        error.message.includes("404"))
    ) {
      return null;
    }
    throw error;
  }
}

/**
 * Well-known Key Vault secret names used by bots and integrations.
 */
export const KeyVaultSecrets = {
  AZURE_AD_CLIENT_SECRET: "azure-ad-client-secret",
  DEA_TOTP_SECRET: "dea-portal-totp-secret",
  DEA_USERNAME: "dea-portal-username",
  DEA_PASSWORD: "dea-portal-password",
  EMEDRAL_USERNAME: "emedral-portal-username",
  EMEDRAL_PASSWORD: "emedral-portal-password",
  MPP_USERNAME: "mpp-portal-username",
  MPP_PASSWORD: "mpp-portal-password",
  AVAILITY_USERNAME: "availity-portal-username",
  AVAILITY_PASSWORD: "availity-portal-password",
  VERITY_USERNAME: "verity-portal-username",
  VERITY_PASSWORD: "verity-portal-password",
  EYEMED_USERNAME: "eyemed-portal-username",
  EYEMED_PASSWORD: "eyemed-portal-password",
  SAM_GOV_API_KEY: "sam-gov-api-key",
  SENDGRID_API_KEY: "sendgrid-api-key",
  PHI_ENCRYPTION_KEY: "phi-encryption-key",
} as const;
