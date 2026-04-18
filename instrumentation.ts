/**
 * Next.js instrumentation hook (`register()`).
 *
 * Wave 4.1 — fires once per process cold-start across both Node and
 * edge runtimes. We use it to bootstrap the unified telemetry surface
 * (Sentry + Application Insights + Prometheus registry).
 *
 * Telemetry SDKs are env-gated and lazy-loaded — see
 * `src/lib/telemetry/index.ts`. When SENTRY_DSN /
 * APPLICATIONINSIGHTS_CONNECTION_STRING are unset, this is a fast no-op.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  // App Insights / Sentry both use Node-only APIs. Skip on the edge
  // runtime; Sentry's edge SDK ships separately and isn't enabled here.
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { initTelemetry } = await import("./src/lib/telemetry");
  await initTelemetry({ serviceName: "ecred-app" });
}
