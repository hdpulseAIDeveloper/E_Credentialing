/**
 * Global vitest setup.
 * - Forces test-mode env vars so encryption + auth paths use deterministic keys.
 * - Keeps any network traffic from leaking: fail fast if a test accidentally
 *   calls fetch() without an MSW handler.
 */
import { beforeAll } from "vitest";

beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    process.env.ENCRYPTION_KEY = Buffer.from(
      "0123456789abcdef0123456789abcdef"
    ).toString("base64");
  }
  if (!process.env.NEXTAUTH_SECRET) {
    process.env.NEXTAUTH_SECRET = "test-secret-do-not-use-in-prod";
  }
  if (!process.env.AUDIT_HMAC_KEY) {
    process.env.AUDIT_HMAC_KEY = "test-audit-hmac-key-must-be-at-least-32-characters";
  }
  (process.env as Record<string, string>).NODE_ENV = "test";
});
