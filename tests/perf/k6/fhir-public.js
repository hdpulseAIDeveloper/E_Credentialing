// tests/perf/k6/fhir-public.js
//
// Wave 4.2 — FHIR R4 public surface load test. Targets the
// CMS-0057-F-relevant endpoints:
//
//   - /api/fhir/metadata            (CapabilityStatement)
//   - /api/fhir/Practitioner        (search)
//   - /api/fhir/HealthcareService   (search, derived)
//   - /api/fhir/InsurancePlan       (search, derived)
//
// Public endpoints are gated by the `fhir:read` scope. Pass an
// API key via API_KEY (the script falls back to unauthenticated
// requests, which exercise the rate-limit path).
//
// Thresholds:
//   - p95 < 1500ms across all FHIR reads
//   - error rate < 1%

import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:6015";
const API_KEY = __ENV.API_KEY || "";

export const options = {
  scenarios: {
    fhir_browse: {
      executor: "ramping-vus",
      startVUs: 5,
      stages: [
        { duration: "30s", target: 25 },
        { duration: "2m", target: 25 },
        { duration: "10s", target: 0 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    "http_req_duration{endpoint:metadata}": ["p(95)<800"],
    "http_req_duration{endpoint:practitioner}": ["p(95)<1500"],
    "http_req_duration{endpoint:healthcareservice}": ["p(95)<1500"],
    "http_req_duration{endpoint:insuranceplan}": ["p(95)<1500"],
  },
};

function headers() {
  return API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {};
}

export default function () {
  const meta = http.get(`${BASE_URL}/api/fhir/metadata`, {
    tags: { endpoint: "metadata" },
  });
  check(meta, {
    "metadata 200": (r) => r.status === 200,
    "metadata is FHIR Capability": (r) =>
      r.status !== 200 || r.body.includes("CapabilityStatement"),
  });

  const prac = http.get(`${BASE_URL}/api/fhir/Practitioner?_count=20`, {
    tags: { endpoint: "practitioner" },
    headers: headers(),
  });
  check(prac, {
    "practitioner 200/401/429": (r) =>
      [200, 401, 429].includes(r.status),
  });

  const hs = http.get(`${BASE_URL}/api/fhir/HealthcareService?_count=20`, {
    tags: { endpoint: "healthcareservice" },
    headers: headers(),
  });
  check(hs, {
    "healthcareservice 200/401/429": (r) =>
      [200, 401, 429].includes(r.status),
  });

  const ip = http.get(`${BASE_URL}/api/fhir/InsurancePlan?_count=20`, {
    tags: { endpoint: "insuranceplan" },
    headers: headers(),
  });
  check(ip, {
    "insuranceplan 200/401/429": (r) =>
      [200, 401, 429].includes(r.status),
  });

  sleep(1);
}
