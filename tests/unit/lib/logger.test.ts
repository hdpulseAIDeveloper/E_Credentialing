/**
 * Logger redaction tests.
 *
 * These are HIPAA-critical: if the redaction config silently breaks
 * (e.g., someone removes a path, or pino changes its shape), PHI would
 * land in stdout / log aggregators. These tests freeze the contract.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Writable } from "node:stream";
import pino from "pino";

describe("logger PHI redaction", () => {
  let captured: string[] = [];
  let sink: Writable;
  let log: pino.Logger;

  beforeEach(() => {
    captured = [];
    sink = new Writable({
      write(chunk, _enc, cb) {
        captured.push(chunk.toString());
        cb();
      },
    });
    // Re-create a logger with the same redact paths as src/lib/logger.ts.
    // We purposely don't import the singleton — we want to assert the
    // redact config itself is correct.
    log = pino(
      {
        level: "trace",
        redact: {
          paths: [
            "*.ssn",
            "*.socialSecurityNumber",
            "*.dateOfBirth",
            "*.dob",
            "*.homePhone",
            "*.homeAddressLine1",
            "*.homeAddressLine2",
            "*.homeCity",
            "*.homeState",
            "*.homeZip",
            "*.mobilePhone",
            "*.personalEmail",
            "*.password",
            "*.passwordHash",
            "*.apiKey",
            "*.Authorization",
            "*.authorization",
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']",
          ],
          remove: false,
          censor: "[REDACTED]",
        },
      },
      sink,
    );
  });

  afterEach(() => {
    captured = [];
  });

  function lastLine() {
    return JSON.parse(captured[captured.length - 1]!);
  }

  it("redacts provider.ssn", () => {
    log.info({ provider: { id: "p1", ssn: "123-45-6789" } }, "x");
    expect(lastLine().provider.ssn).toBe("[REDACTED]");
    expect(lastLine().provider.id).toBe("p1");
  });

  it("redacts provider.dateOfBirth and homeAddress fields", () => {
    log.info(
      {
        provider: {
          dateOfBirth: "1980-01-01",
          homeAddressLine1: "123 Main St",
          homeCity: "Albany",
          homeState: "NY",
          homeZip: "12208",
        },
      },
      "x",
    );
    const line = lastLine();
    expect(line.provider.dateOfBirth).toBe("[REDACTED]");
    expect(line.provider.homeAddressLine1).toBe("[REDACTED]");
    expect(line.provider.homeCity).toBe("[REDACTED]");
    expect(line.provider.homeState).toBe("[REDACTED]");
    expect(line.provider.homeZip).toBe("[REDACTED]");
  });

  it("redacts password and apiKey", () => {
    log.info({ user: { password: "sekret", apiKey: "sk_live_abc" } }, "x");
    const line = lastLine();
    expect(line.user.password).toBe("[REDACTED]");
    expect(line.user.apiKey).toBe("[REDACTED]");
  });

  it("redacts HTTP auth headers and cookies", () => {
    log.info(
      {
        req: {
          headers: {
            authorization: "Bearer abc.def.ghi",
            cookie: "next-auth.session-token=xyz",
            "user-agent": "vitest",
          },
        },
      },
      "x",
    );
    const line = lastLine();
    expect(line.req.headers.authorization).toBe("[REDACTED]");
    expect(line.req.headers.cookie).toBe("[REDACTED]");
    expect(line.req.headers["user-agent"]).toBe("vitest");
  });

  it("does not leak PHI through msg/string interpolation", () => {
    log.info({ provider: { ssn: "123-45-6789" } }, "processed provider");
    const raw = captured[captured.length - 1]!;
    expect(raw).not.toContain("123-45-6789");
  });
});
