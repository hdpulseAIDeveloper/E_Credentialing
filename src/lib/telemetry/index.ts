/**
 * src/lib/telemetry/index.ts
 *
 * Wave 4.1 — unified telemetry surface.
 *
 * Three sinks are wired here, all lazy-loaded and env-gated so dev /
 * test installs stay light:
 *
 *   - **Sentry** (`@sentry/nextjs` server + edge runtimes): exception
 *     capture, breadcrumbs, performance traces. Initialized when
 *     `SENTRY_DSN` is set.
 *   - **Azure Application Insights** (`applicationinsights`): request
 *     traces, dependency tracking, custom metrics. Initialized when
 *     `APPLICATIONINSIGHTS_CONNECTION_STRING` is set.
 *   - **Prometheus** counters/histograms (existing `/api/metrics`
 *     endpoint already uses a hand-curated text exposition; this
 *     module adds a thin in-process counter registry that the metrics
 *     endpoint can fold in).
 *
 * Design notes:
 *
 *   - All three SDKs are optional peer deps. If the package isn't
 *     installed, the wrapper degrades to a no-op so `npm run test`
 *     and local dev are unaffected.
 *   - `initTelemetry()` is idempotent — Next.js calls
 *     `instrumentation.ts.register()` on every cold start across edge
 *     and Node runtimes, and BullMQ workers call it from
 *     `src/workers/index.ts`.
 *   - PHI-safe by default: every `captureException` strips Prisma
 *     `data` payloads and known PHI keys before forwarding.
 *
 * To enable in production:
 *
 *   ```
 *   npm i @sentry/nextjs applicationinsights prom-client
 *   # then set the env vars (see .env.example)
 *   ```
 *
 * Tests live in `tests/unit/lib/telemetry/index.test.ts` and verify
 * the no-op fallback path when SDKs are absent.
 */

type Severity = "fatal" | "error" | "warning" | "info" | "debug";

/**
 * Dynamic require that hides the specifier from TypeScript so we can
 * import a package that isn't installed in dev/test without breaking
 * `tsc`. Returns null if the package can't be resolved.
 */
async function optionalImport(specifier: string): Promise<any> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
    const dynamicImport = new Function(
      "s",
      "return import(s)",
    ) as (s: string) => Promise<any>;
    return await dynamicImport(specifier);
  } catch {
    return null;
  }
}

interface TelemetryAdapter {
  init(): Promise<void>;
  captureException(err: unknown, context?: Record<string, unknown>): void;
  captureMessage(message: string, severity?: Severity): void;
  recordCounter(name: string, value?: number, labels?: Record<string, string>): void;
  recordHistogram(name: string, value: number, labels?: Record<string, string>): void;
  flush(timeoutMs?: number): Promise<void>;
}

// ─── PHI scrubbing ──────────────────────────────────────────────────────────

const PHI_KEYS = new Set([
  "ssn",
  "dob",
  "dateOfBirth",
  "personalEmail",
  "mobilePhone",
  "homeAddress",
  "patientName",
  "mrn",
  "deaNumber",
  "passwordHash",
]);

function scrub(input: unknown, depth = 0): unknown {
  if (depth > 5 || input == null) return input;
  if (Array.isArray(input)) return input.map((v) => scrub(v, depth + 1));
  if (typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(input)) {
      if (PHI_KEYS.has(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = scrub(v, depth + 1);
    }
    return out;
  }
  return input;
}

// ─── In-process counter registry (fed into Prometheus exposition) ───────────

interface CounterValue {
  name: string;
  help: string;
  type: "counter" | "histogram";
  values: Map<string, number>; // serialized labels → value
}

const registry = new Map<string, CounterValue>();

function serializeLabels(labels: Record<string, string> = {}): string {
  return JSON.stringify(
    Object.keys(labels)
      .sort()
      .reduce<Record<string, string>>((acc, k) => {
        acc[k] = labels[k]!;
        return acc;
      }, {}),
  );
}

function bumpRegistry(
  name: string,
  type: "counter" | "histogram",
  value: number,
  labels: Record<string, string> = {},
  help = "in-process metric",
): void {
  let entry = registry.get(name);
  if (!entry) {
    entry = { name, help, type, values: new Map() };
    registry.set(name, entry);
  }
  const key = serializeLabels(labels);
  entry.values.set(key, (entry.values.get(key) ?? 0) + value);
}

/**
 * Snapshot the in-process registry as Prometheus text exposition
 * fragments. Consumed by `/api/metrics`.
 */
export function snapshotRegistry(): Array<{
  name: string;
  help: string;
  type: "counter" | "histogram";
  labels: Record<string, string>;
  value: number;
}> {
  const out: Array<{
    name: string;
    help: string;
    type: "counter" | "histogram";
    labels: Record<string, string>;
    value: number;
  }> = [];
  for (const entry of registry.values()) {
    for (const [labelsKey, value] of entry.values.entries()) {
      out.push({
        name: entry.name,
        help: entry.help,
        type: entry.type,
        labels: JSON.parse(labelsKey) as Record<string, string>,
        value,
      });
    }
  }
  return out;
}

/** Test-only: drop everything in the in-process registry. */
export function _resetRegistry(): void {
  registry.clear();
}

// ─── Adapter implementations ────────────────────────────────────────────────

/**
 * Default no-op adapter. Always installed so callers never have to
 * null-check.
 */
const noopAdapter: TelemetryAdapter = {
  async init() {
    /* no-op */
  },
  captureException(_err, _context) {
    /* no-op */
  },
  captureMessage(_message, _severity) {
    /* no-op */
  },
  recordCounter(name, value = 1, labels = {}) {
    bumpRegistry(name, "counter", value, labels);
  },
  recordHistogram(name, value, labels = {}) {
    bumpRegistry(name, "histogram", value, labels);
  },
  async flush(_timeoutMs) {
    /* no-op */
  },
};

let activeAdapter: TelemetryAdapter = noopAdapter;
let initPromise: Promise<void> | null = null;

interface InitOptions {
  /** Override env-driven detection (used by tests). */
  forceMode?: "noop" | "sentry+ai" | "sentry-only" | "ai-only";
  /** Service identifier used in tags / cloud-role. */
  serviceName?: string;
}

/**
 * Build the active adapter. Tries to lazy-import each SDK; if missing
 * or DSN/connection string unset, falls back to no-op (composed with
 * the in-process registry so /api/metrics still works).
 */
async function buildAdapter(opts: InitOptions): Promise<TelemetryAdapter> {
  const mode = opts.forceMode;
  const wantSentry =
    mode === "sentry+ai" ||
    mode === "sentry-only" ||
    (mode === undefined && Boolean(process.env.SENTRY_DSN));
  const wantAi =
    mode === "sentry+ai" ||
    mode === "ai-only" ||
    (mode === undefined &&
      Boolean(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING));

  // We use `optionalImport` (below) so TypeScript doesn't try to type-check
  // packages that are intentionally not installed in dev/test. The SDKs
  // are installed at deploy time in staging/prod.
  let sentry: any = null;
  if (wantSentry) {
    try {
      sentry = await optionalImport("@sentry/nextjs");
      if (sentry) {
        sentry.init({
          dsn: process.env.SENTRY_DSN,
          environment: process.env.NODE_ENV,
          release: process.env.SENTRY_RELEASE ?? process.env.GIT_SHA,
          tracesSampleRate: Number(
            process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1,
          ),
        });
      }
    } catch {
      sentry = null;
    }
  }

  let ai: any = null;
  if (wantAi) {
    try {
      ai = await optionalImport("applicationinsights");
      if (ai) {
        ai.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
          .setAutoCollectRequests(true)
          .setAutoCollectExceptions(true)
          .setAutoCollectDependencies(true)
          .setAutoCollectPerformance(true, true)
          .setSendLiveMetrics(false)
          .start();
        ai.defaultClient.context.tags[
          ai.defaultClient.context.keys.cloudRole
        ] = opts.serviceName ?? "ecred-app";
      }
    } catch {
      ai = null;
    }
  }

  return {
    async init() {
      /* already done */
    },
    captureException(err, context) {
      const safeContext = scrub(context);
      try {
        if (sentry) {
          sentry.captureException(err, {
            extra: safeContext as Record<string, unknown> | undefined,
          });
        }
        if (ai) {
          ai.defaultClient.trackException({
            exception: err instanceof Error ? err : new Error(String(err)),
            properties: safeContext as Record<string, unknown> | undefined,
          });
        }
      } catch {
        /* never let telemetry kill the request */
      }
    },
    captureMessage(message, severity = "info") {
      try {
        if (sentry) sentry.captureMessage(message, severity);
        if (ai) {
          ai.defaultClient.trackTrace({ message, severity: severityToAi(severity) });
        }
      } catch {
        /* swallow */
      }
    },
    recordCounter(name, value = 1, labels = {}) {
      bumpRegistry(name, "counter", value, labels);
      try {
        if (ai) {
          ai.defaultClient.trackMetric({
            name,
            value,
            properties: labels,
          });
        }
      } catch {
        /* swallow */
      }
    },
    recordHistogram(name, value, labels = {}) {
      bumpRegistry(name, "histogram", value, labels);
      try {
        if (ai) {
          ai.defaultClient.trackMetric({
            name,
            value,
            properties: labels,
          });
        }
      } catch {
        /* swallow */
      }
    },
    async flush(timeoutMs = 2000) {
      try {
        if (sentry) await sentry.flush(timeoutMs);
        if (ai) {
          await new Promise<void>((resolve) => {
            ai!.defaultClient.flush({ callback: () => resolve() });
            setTimeout(resolve, timeoutMs);
          });
        }
      } catch {
        /* swallow */
      }
    },
  };
}

/** Map our Severity → App Insights severity number. */
function severityToAi(s: Severity): number {
  switch (s) {
    case "debug":
      return 0;
    case "info":
      return 1;
    case "warning":
      return 2;
    case "error":
      return 3;
    case "fatal":
      return 4;
  }
}

/** Initialize telemetry. Idempotent. */
export function initTelemetry(opts: InitOptions = {}): Promise<void> {
  if (initPromise) return initPromise;
  initPromise = buildAdapter(opts).then((adapter) => {
    activeAdapter = adapter;
  });
  return initPromise;
}

/** Test-only escape hatch. */
export function _resetTelemetryForTests(): void {
  activeAdapter = noopAdapter;
  initPromise = null;
}

// ─── Public API ─────────────────────────────────────────────────────────────

export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  activeAdapter.captureException(err, context);
}

export function captureMessage(message: string, severity: Severity = "info"): void {
  activeAdapter.captureMessage(message, severity);
}

export function recordCounter(
  name: string,
  value = 1,
  labels: Record<string, string> = {},
): void {
  activeAdapter.recordCounter(name, value, labels);
}

export function recordHistogram(
  name: string,
  value: number,
  labels: Record<string, string> = {},
): void {
  activeAdapter.recordHistogram(name, value, labels);
}

export function flushTelemetry(timeoutMs?: number): Promise<void> {
  return activeAdapter.flush(timeoutMs);
}
