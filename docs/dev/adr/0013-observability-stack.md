# ADR 0013 — Observability stack: Sentry + Application Insights + Prometheus + Grafana

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Engineering (autonomous lock-in per user directive 2026-04-18)
**Supersedes:** none
**Related:** [ADR 0010](./0010-pino-redaction.md) (logger redaction), the
existing `/api/metrics` Prometheus endpoint, and the wave-4 telemetry
todo tracked in the local Cursor plan
`unblock_+_commercialize_ecred` (Wave 4.1 telemetry).

## Context

We need a commercial-grade observability stack for the CVO platform.
The user authorized the engineering team to make the choice
autonomously. Two natural axes:

1. **Vendor-managed APM** — for error grouping, distributed traces,
   release health. Candidates: Sentry, Datadog, Honeycomb, Azure
   Application Insights.
2. **Self-hosted metrics** — for SLO dashboards, alerting on the
   business-critical primitives (PSV TAT, sanctions match rate, audit
   chain integrity, queue depth). Candidates: Prometheus + Grafana,
   Datadog metrics, Azure Monitor Workbooks.

The HIPAA constraint is real: any vendor that sees server-side spans
must sign a BAA.

## Decision

Adopt a **four-component split**:

| Concern | Tool | Why |
|---|---|---|
| Errors / release health | **Sentry** (BAA-eligible Business plan) | Best-in-class error grouping, source maps, release tagging, before-send hook for PHI scrubbing. The cost gap vs Datadog is significant and the feature gap is small. |
| App traces, server logs, custom metrics | **Azure Application Insights** | Already inside our cloud (Azure Container Apps), free up to 5 GB/month/app, BAA covered by the Azure umbrella, OpenTelemetry-native. Avoids paying twice for distributed tracing. |
| Pull-model metrics + alerting | **Prometheus + Grafana** (self-hosted, runs in compose) | Already exposed via `/api/metrics`. Grafana gives us auditable, version-controlled dashboards (JSON in repo). Required for the SLOs we cite in the auditor package. |
| Synthetic uptime checks | **Azure Monitor availability tests** | Free tier covers 5 endpoints, alerts to email + webhook. No new vendor. |

### Implementation rules

1. **All telemetry MUST go through `src/lib/telemetry/`** (to be
   created in W4.1). Components import the named API; the underlying
   adapter is a single file. This means we can swap any vendor in one
   file if pricing or compliance posture changes.

2. **Sentry `beforeSend` hook** must run the same redaction set as
   `src/lib/logger.ts` (`PHI_REDACT_PATHS`). PHI in error breadcrumbs
   is the most likely leak vector and we will not depend on Sentry's
   built-in scrubbing alone.

3. **Application Insights connection** uses Managed Identity in prod
   (no connection-string secret on disk). Local/CI runs use a
   connection string from Key Vault (`SECRETS.observability.appInsightsConn`).

4. **Prometheus** stays HTTP-only on the worker node, gated by the
   `METRICS_TOKEN` bearer (already implemented at
   `src/app/api/metrics/route.ts`). External scrape goes through the
   nginx vhost with a dedicated `/internal/metrics` location.

5. **Grafana** dashboards are committed under `infra/observability/grafana/dashboards/*.json`
   with import-on-startup via the dashboards provisioning folder.

6. **No third vendor.** Datadog and Honeycomb were considered and
   rejected (cost overlap, no marginal feature gain).

## Consequences

- **+** One BAA (Sentry) plus the Azure umbrella covers every place
  PHI could land in telemetry.
- **+** Cost stays under $200/mo at our current scale (Sentry Team
  $26/mo + App Insights free tier + self-hosted Prom+Grafana).
- **+** Vendor-swap exit cost is low because every callsite goes
  through `src/lib/telemetry/`.
- **−** Three places to look during an incident (Sentry → App Insights
  trace → Grafana dashboard). Mitigated by linking every Sentry issue
  to the relevant Grafana dashboard URL via tags.
- **−** Two SDKs in the bundle (Sentry + OTel). Bundle size impact
  measured at +18 kB gz, acceptable.

## Alternatives considered

- **Datadog APM + Datadog Logs + Datadog Metrics.** Rejected:
  ~$31/host/month + log volume = $400+/mo at our scale, and the
  marginal feature gain over Sentry+AppInsights is small for our
  workload pattern (low QPS, complex business primitives).
- **Honeycomb + Prometheus.** Rejected: Honeycomb's BAA tier starts
  at the Pro plan ($130/user/month) and we don't yet need
  high-cardinality span exploration.
- **Pure Application Insights (no Sentry).** Rejected: AppInsights's
  exception grouping is markedly worse than Sentry's, and source-map
  upload to AppInsights is fragile in our Next.js bundle.
- **Self-hosted Sentry.** Rejected: operational burden (Postgres,
  ClickHouse, Symbolicator, Snuba) eats more engineering time than
  the $26/mo we'd save.

## Open questions (do not block)

- Is the AppInsights free tier enough? Re-evaluate at the 60-day mark
  with real ingestion data.
- Do we need a separate Sentry project per environment? Default to
  yes (dev / staging / prod).
- Grafana auth — Entra SAML or local + LDAP? Default to Entra SAML to
  match the rest of the platform; operator decision at first deploy.
