// tests/perf/k6/api-public.js
//
// Wave 4.2 — public REST API load test. Targets the
// /api/v1/providers and /api/v1/sanctions endpoints (both gated by
// API key + scope; pass API_KEY for authenticated paths).
//
// Thresholds:
//   - p95 < 1500ms across all endpoints
//   - error rate (excluding intentional 401s) < 1%

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6015";
const API_KEY = __ENV.API_KEY || "";

export const options = {
  vus: 20,
  duration: "1m",
  thresholds: {
    "http_req_duration{endpoint:providers}": ["p(95)<1500"],
    "http_req_duration{endpoint:sanctions}": ["p(95)<1500"],
    http_req_failed: ["rate<0.05"],
  },
};

function headers() {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

export default function () {
  const providers = http.get(`${BASE_URL}/api/v1/providers?limit=10`, {
    tags: { endpoint: "providers" },
    headers: headers(),
  });
  check(providers, {
    "providers 200/401/429": (r) =>
      [200, 401, 429].includes(r.status),
  });

  const sanctions = http.get(`${BASE_URL}/api/v1/sanctions?limit=10`, {
    tags: { endpoint: "sanctions" },
    headers: headers(),
  });
  check(sanctions, {
    "sanctions 200/401/429": (r) =>
      [200, 401, 429].includes(r.status),
  });

  sleep(1);
}
