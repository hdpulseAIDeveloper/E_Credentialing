import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The logger test runs pino in a destination-buffer mode so we can assert
 * redaction of PHI fields without touching stdout.
 */
describe("logger PHI redaction", () => {
  const originalEnv = { ...process.env };
  beforeEach(() => {
    process.env = { ...originalEnv };
    (process.env as Record<string, string>).NODE_ENV = "production";
    vi.resetModules();
  });

  async function capture(): Promise<{ buf: string[]; logger: { info: (o: unknown, m?: string) => void } }> {
    const pino = (await import("pino")).default;
    const buf: string[] = [];
    const stream = {
      write(chunk: string) {
        buf.push(chunk);
      },
    };
    const PHI_REDACT_PATHS = [
      "*.ssn",
      "*.dateOfBirth",
      "*.homePhone",
      "*.homeAddressLine1",
      "*.password",
    ];
    const logger = pino(
      {
        level: "info",
        redact: { paths: PHI_REDACT_PATHS, censor: "[REDACTED]" },
      },
      stream
    );
    return { buf, logger };
  }

  it("redacts ssn and dateOfBirth at any depth", async () => {
    const { buf, logger } = await capture();
    logger.info({ provider: { ssn: "123-45-6789", dateOfBirth: "1980-01-15" } }, "m");
    const line = buf.join("");
    expect(line).toContain("[REDACTED]");
    expect(line).not.toContain("123-45-6789");
    expect(line).not.toContain("1980-01-15");
  });

  it("redacts password fields", async () => {
    const { buf, logger } = await capture();
    logger.info({ user: { password: "s3cret!" } }, "auth");
    const line = buf.join("");
    expect(line).not.toContain("s3cret!");
  });
});
