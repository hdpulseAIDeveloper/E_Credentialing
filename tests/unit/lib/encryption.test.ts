import { describe, it, expect } from "vitest";
import {
  encrypt,
  decrypt,
  encryptOptional,
  decryptOptional,
  redactForLog,
  looksLikeCiphertext,
} from "@/lib/encryption";

describe("encryption (AES-256-GCM)", () => {
  it("round-trips a plaintext value", () => {
    const plain = "123-45-6789";
    const ct = encrypt(plain);
    expect(ct).not.toEqual(plain);
    expect(decrypt(ct)).toEqual(plain);
  });

  it("produces distinct ciphertext each call for the same plaintext (random IV)", () => {
    const plain = "1980-01-15";
    expect(encrypt(plain)).not.toEqual(encrypt(plain));
  });

  it("encryptOptional returns null for null/undefined/empty", () => {
    expect(encryptOptional(null)).toBeNull();
    expect(encryptOptional(undefined)).toBeNull();
    expect(encryptOptional("")).toBeNull();
  });

  it("decryptOptional round-trips correctly", () => {
    const ct = encryptOptional("confidential");
    expect(decryptOptional(ct)).toEqual("confidential");
    expect(decryptOptional(null)).toBeNull();
  });

  it("rejects tampered ciphertext (auth tag invalid)", () => {
    const ct = encrypt("top-secret");
    // Flip a byte in the tag region
    const buf = Buffer.from(ct, "base64");
    buf[14] = (buf[14] ?? 0) ^ 0xff;
    expect(() => decrypt(buf.toString("base64"))).toThrow();
  });

  it("redactForLog hides the middle characters", () => {
    expect(redactForLog("1234567890")).toEqual("12******90");
    expect(redactForLog("ab")).toEqual("***");
  });

  describe("looksLikeCiphertext", () => {
    it("returns true for values produced by encrypt()", () => {
      expect(looksLikeCiphertext(encrypt("data"))).toBe(true);
    });

    it("returns false for plaintext", () => {
      expect(looksLikeCiphertext("plaintext-value")).toBe(false);
      expect(looksLikeCiphertext("1980-01-15")).toBe(false);
    });

    it("returns false for null/undefined/empty", () => {
      expect(looksLikeCiphertext(null)).toBe(false);
      expect(looksLikeCiphertext(undefined)).toBe(false);
      expect(looksLikeCiphertext("")).toBe(false);
    });
  });
});
