# Grafana — E-Credentialing dashboards

Wave 4.1 — pre-built Grafana dashboards for the platform.

## Dashboards

| File | Purpose |
| --- | --- |
| `dashboards/ecred-platform-health.json` | Platform health overview: queue depth, tRPC throughput/latency, audit volume, monitoring alerts, AI decision verdicts, bot run status. |

## Provisioning

Drop the JSON into Grafana via:

1. **UI**: Dashboards → New → Import → upload JSON.
2. **File provisioning**: mount this directory into a Grafana sidecar
   under `/etc/grafana/provisioning/dashboards/` and point a
   `dashboards.yaml` provider at it.

## Required data sources

- **Prometheus** (named `Prometheus` in the dashboard JSON). Configure
  it to scrape the application's `/api/metrics` endpoint with the
  `Authorization: Bearer ${METRICS_BEARER_TOKEN}` header in production.
- (optional) **Azure Monitor** for Application Insights integration —
  not used by the current panels but available for ad-hoc queries.

## Adding new panels

1. Add a new `recordCounter` / `recordHistogram` call in the codebase
   using a stable metric name prefixed with `ecred_`.
2. The in-process registry is folded into the `/api/metrics` exposition
   automatically (see `src/lib/telemetry/index.ts → snapshotRegistry`
   and `src/app/api/metrics/route.ts`).
3. Edit `ecred-platform-health.json` (or add a new dashboard JSON) and
   reference the metric. Keep label cardinality bounded.
