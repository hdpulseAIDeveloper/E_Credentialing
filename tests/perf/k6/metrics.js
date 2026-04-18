// tests/perf/k6/metrics.js
//
// Wave 4.2 — Prometheus scrape latency. The /api/metrics endpoint
// joins multiple Prisma counters; we assert it returns under 1.5s p95
// even under concurrent scrape load (Prometheus typically scrapes
// every 15s; multi-tenant deployments can have many scraping
// processes hitting the same endpoint).
//
// Usage:
//   BASE_URL=http://localhost:6015 \
//   METRICS_BEARER_TOKEN=... \
//   k6 run tests/perf/k6/metrics.js

import http from "k6/http";
import { check } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6015";
const TOKEN = __ENV.METRICS_BEARER_TOKEN || "";

export const options = {
  vus: 10,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.001"],
    http_req_duration: ["p(95)<1500"],
  },
};

export default function () {
  const headers = TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
  const res = http.get(`${BASE_URL}/api/metrics`, { headers });
  check(res, {
    "200 or 401-without-token": (r) =>
      r.status === 200 || (r.status === 401 && !TOKEN),
    "exposition body": (r) =>
      r.status !== 200 || r.body.includes("# HELP ecred_"),
  });
}
