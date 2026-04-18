# k6 performance suites

Wave 4.2 — k6 load test scripts for the E-Credentialing CVO platform.

## Scenarios

| File | Scenario | Default budget |
| --- | --- | --- |
| `health.js` | `/api/health`, `/api/live`, `/api/ready` probe latency under load | p95 < 500ms, error rate < 1% |
| `metrics.js` | Prometheus `/api/metrics` scrape latency | p95 < 1500ms, error rate < 0.1% |
| `fhir-public.js` | FHIR `Practitioner` search + read + CapabilityStatement | p95 < 1500ms, error rate < 1% |
| `api-public.js` | Public REST API key paths (providers list, sanctions feed) | p95 < 1500ms, error rate < 1% |

## Prerequisites

- [k6](https://k6.io/docs/get-started/installation/) `>= 0.50.0`
  installed locally or in CI.
- The application running on `${BASE_URL}` (default
  `http://localhost:6015`).
- `API_KEY` env var if running the `api-public.js` suite against a
  protected endpoint.

## Usage

```bash
# All defaults
k6 run tests/perf/k6/health.js

# Custom base URL + virtual users
BASE_URL=https://staging.example.com k6 run --vus 50 --duration 2m tests/perf/k6/fhir-public.js

# Output a JSON summary to feed dashboards / CI annotations
k6 run --summary-export=results/health.json tests/perf/k6/health.js
```

## CI wiring

Wave 4.2 ships these as nightly suites only — they're heavy enough to
warrant a dedicated runner. The lightweight per-PR perf checks live in
`tests/perf/pillar-h-perf.spec.ts` (Playwright).

Add a CI job (GitHub Actions, Azure Pipelines, etc.) that:

1. Boots the app + Postgres + Redis containers.
2. Seeds a deterministic dataset (`npm run db:seed:all`).
3. Runs `k6 run tests/perf/k6/<scenario>.js` for each suite.
4. Uploads the `--summary-export` JSON as a build artifact.
5. Fails the job when k6 thresholds breach (k6 returns non-zero on
   threshold failure by default).

## Adding a new scenario

1. Create `tests/perf/k6/<name>.js` exporting a default function that
   issues HTTP requests via `import http from "k6/http"`.
2. Define `options.thresholds` for `http_req_duration` and
   `http_req_failed`.
3. Document the scenario in this README's table.
4. Add it to the nightly CI matrix.
