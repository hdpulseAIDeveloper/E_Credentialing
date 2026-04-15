/**
 * TOTP code generation using otplib for DEA MFA automation.
 * The TOTP secret is retrieved from Azure Key Vault, never hardcoded.
 */

import { authenticator } from "otplib";
import { HashAlgorithms } from "@otplib/core";

/**
 * Generates a current TOTP code from a base32 secret.
 * The secret must be fetched from Azure Key Vault before calling this function.
 * Never log the secret or the generated code.
 *
 * @param secret - Base32-encoded TOTP secret (e.g., from DEA portal MFA setup)
 * @returns Current 6-digit TOTP code
 */
export function generateTotpCode(secret: string): string {
  authenticator.options = {
    step: 30,
    digits: 6,
    algorithm: HashAlgorithms.SHA1,
  };
  return authenticator.generate(secret);
}

/**
 * Returns time remaining (in seconds) until the current TOTP window expires.
 * Useful to wait for a fresh code if the current window is about to expire.
 */
export function totpSecondsRemaining(): number {
  const step = 30;
  const now = Math.floor(Date.now() / 1000);
  return step - (now % step);
}

/**
 * Verifies a TOTP code against a secret.
 * Allows 1 step tolerance (±30s).
 */
export function verifyTotpCode(token: string, secret: string): boolean {
  authenticator.options = { window: 1 };
  return authenticator.verify({ token, secret });
}
