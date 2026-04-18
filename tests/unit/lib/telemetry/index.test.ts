/**
 * tests/unit/lib/telemetry/index.test.ts
 *
 * Wave 4.1 — verifies the no-op fallback path. Sentry / App Insights
 * SDKs are intentionally NOT installed in dev/test, so the active
 * adapter must always be the no-op composed with the in-process
 * Prometheus registry.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  initTelemetry,
  captureException,
  captureMessage,
  recordCounter,
  recordHistogram,
  flushTelemetry,
  snapshotRegistry,
  _resetRegistry,
  _resetTelemetryForTests,
} from "@/lib/telemetry";

beforeEach(() => {
  _resetRegistry();
  _resetTelemetryForTests();
});

describe("telemetry — no-op fallback", () => {
  it("never throws when SDKs are absent and env vars are unset", async () => {
    delete process.env.SENTRY_DSN;
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
    await initTelemetry();
    expect(() => captureException(new Error("boom"))).not.toThrow();
    expect(() => captureMessage("hello", "info")).not.toThrow();
    await expect(flushTelemetry(50)).resolves.toBeUndefined();
  });

  it("init is idempotent — calling twice resolves without re-init", async () => {
    const first = initTelemetry();
    const second = initTelemetry();
    expect(first).toBe(second);
    await first;
  });
});

describe("telemetry — in-process registry", () => {
  it("counters accumulate per label set", async () => {
    await initTelemetry();
    recordCounter("ecred_test_total", 1, { route: "/a" });
    recordCounter("ecred_test_total", 2, { route: "/a" });
    recordCounter("ecred_test_total", 5, { route: "/b" });
    const snap = snapshotRegistry().filter(
      (m) => m.name === "ecred_test_total",
    );
    expect(snap).toHaveLength(2);
    const a = snap.find((m) => m.labels.route === "/a")!;
    const b = snap.find((m) => m.labels.route === "/b")!;
    expect(a.value).toBe(3);
    expect(b.value).toBe(5);
    expect(a.type).toBe("counter");
  });

  it("histograms are tracked separately from counters", async () => {
    await initTelemetry();
    recordHistogram("ecred_test_duration_ms", 12, { path: "x" });
    recordHistogram("ecred_test_duration_ms", 8, { path: "x" });
    const snap = snapshotRegistry().filter(
      (m) => m.name === "ecred_test_duration_ms",
    );
    expect(snap).toHaveLength(1);
    expect(snap[0].type).toBe("histogram");
    expect(snap[0].value).toBe(20);
  });

  it("label ordering is canonicalized", async () => {
    await initTelemetry();
    recordCounter("ecred_test_canon", 1, { b: "2", a: "1" });
    recordCounter("ecred_test_canon", 1, { a: "1", b: "2" });
    const snap = snapshotRegistry().filter((m) => m.name === "ecred_test_canon");
    expect(snap).toHaveLength(1);
    expect(snap[0].value).toBe(2);
  });

  it("captureException with PHI-shaped context never throws", async () => {
    await initTelemetry();
    expect(() =>
      captureException(new Error("phi-leak"), {
        ssn: "123-45-6789",
        dob: "1980-01-01",
        nested: { mrn: "M-001", harmless: "ok" },
      }),
    ).not.toThrow();
  });
});

describe("telemetry — forced mode", () => {
  it("forceMode='noop' bypasses env var detection", async () => {
    process.env.SENTRY_DSN = "https://example.ingest.sentry.io/123";
    await initTelemetry({ forceMode: "noop" });
    // Should still record into the registry (no-op preserves metrics).
    recordCounter("ecred_test_force_noop");
    const snap = snapshotRegistry().filter(
      (m) => m.name === "ecred_test_force_noop",
    );
    expect(snap[0].value).toBe(1);
    delete process.env.SENTRY_DSN;
  });
});

// Sanity: ensure the optionalImport helper degrades gracefully even if the
// runtime accidentally has the SDKs installed; we rely on init() being
// silent rather than mocking each SDK here.
describe("telemetry — never bubbles SDK errors", () => {
  it("captures during init failures and continues", async () => {
    // Force a mode that would try to load a non-existent module —
    // adapter must still build the no-op path.
    process.env.SENTRY_DSN = "this-is-not-a-real-dsn";
    process.env.APPLICATIONINSIGHTS_CONNECTION_STRING = "fake";
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await initTelemetry({ forceMode: "sentry+ai" });
    // Subsequent calls remain safe.
    recordCounter("ecred_test_after_failed_init");
    const snap = snapshotRegistry().filter(
      (m) => m.name === "ecred_test_after_failed_init",
    );
    expect(snap[0].value).toBe(1);
    consoleSpy.mockRestore();
    delete process.env.SENTRY_DSN;
    delete process.env.APPLICATIONINSIGHTS_CONNECTION_STRING;
  });
});
