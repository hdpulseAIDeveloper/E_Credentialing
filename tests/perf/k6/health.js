// tests/perf/k6/health.js
//
// Wave 4.2 — health-probe load test. Hits /api/live, /api/ready, and
// /api/health under sustained virtual-user load to ensure the
// readiness loop never becomes the bottleneck during incident
// response (orchestrators poll these constantly).
//
// Usage:
//   BASE_URL=http://localhost:6015 k6 run tests/perf/k6/health.js
//
// Thresholds:
//   - p95 < 500ms across all probe endpoints
//   - error rate < 1%

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6015";

export const options = {
  scenarios: {
    health_probe: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "20s", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<500"],
    "http_req_duration{endpoint:live}": ["p(95)<200"],
    "http_req_duration{endpoint:ready}": ["p(95)<500"],
    "http_req_duration{endpoint:health}": ["p(95)<500"],
  },
};

export default function () {
  const live = http.get(`${BASE_URL}/api/live`, {
    tags: { endpoint: "live" },
  });
  check(live, { "live 200": (r) => r.status === 200 });

  const ready = http.get(`${BASE_URL}/api/ready`, {
    tags: { endpoint: "ready" },
  });
  check(ready, { "ready 200 or 503": (r) => r.status === 200 || r.status === 503 });

  const health = http.get(`${BASE_URL}/api/health`, {
    tags: { endpoint: "health" },
  });
  check(health, { "health 200 or 503": (r) => r.status === 200 || r.status === 503 });

  sleep(1);
}
