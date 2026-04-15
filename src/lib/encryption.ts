/**
 * AES-256-GCM encryption/decryption for PHI fields (SSN, DOB, addresses).
 * The encryption key is read from ENCRYPTION_KEY env var (base64-encoded 32 bytes).
 * SSN is never logged — all callers must redact before logging.
 */

import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const keyB64 = process.env.ENCRYPTION_KEY;
  if (!keyB64) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  const key = Buffer.from(keyB64, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be exactly 32 bytes (base64-encoded)");
  }
  return key;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a base64-encoded string: iv (12 bytes) + tag (16 bytes) + ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  // Concatenate: iv + tag + ciphertext
  const result = Buffer.concat([iv, tag, encrypted]);
  return result.toString("base64");
}

/**
 * Decrypts a base64-encoded AES-256-GCM ciphertext string.
 * Returns the original plaintext string.
 */
export function decrypt(ciphertextB64: string): string {
  const key = getKey();
  const buf = Buffer.from(ciphertextB64, "base64");

  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/**
 * Encrypts a value if it is a non-empty string; returns null otherwise.
 * Useful for optional PHI fields.
 */
export function encryptOptional(value: string | null | undefined): string | null {
  if (!value) return null;
  return encrypt(value);
}

/**
 * Decrypts a value if it is a non-null string; returns null otherwise.
 */
export function decryptOptional(ciphertextB64: string | null | undefined): string | null {
  if (!ciphertextB64) return null;
  return decrypt(ciphertextB64);
}

/**
 * Redacts a string for safe logging (replaces all chars except first/last 2 with asterisks).
 * Never call with SSN directly — use this to produce safe log representations.
 */
export function redactForLog(value: string, visibleChars = 2): string {
  if (value.length <= visibleChars * 2) return "***";
  const start = value.slice(0, visibleChars);
  const end = value.slice(-visibleChars);
  return `${start}${"*".repeat(value.length - visibleChars * 2)}${end}`;
}
