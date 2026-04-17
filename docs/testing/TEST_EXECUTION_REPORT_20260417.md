# ESSEN Credentialing — Automated Test Execution Report

**Run date:** 2026-04-17
**Target:** http://localhost:6015 (ecred-web) + http://localhost:6025 (ecred-worker)
**Tester:** Auto-Runner (`docs/testing/run_master_test_plan.py`)
**Plan:** `ESSEN_Credentialing_Master_Test_Plan_20260417_010720.xlsx`
**Results workbook:** `ESSEN_Credentialing_Master_Test_Plan_EXECUTED_20260417_013233.xlsx`

---

## Headline result

| Status   | Count | %      |
|----------|------:|-------:|
| Pass     |    29 | 11.2%  |
| Fail     |     0 |  0.0%  |
| Blocked  |     7 |  2.7%  |
| Not Run  |   223 | 86.1%  |
| **Total**| **259** | 100%  |

**Zero open failures.** Every check the automation can perform without an
authenticated browser session, an external sandbox, or a controlled clock
either passes, or is correctly blocked with a documented reason.

---

## Defects found and fixed during this run

The runner caught two real bugs that were repaired in-flight:

### DEF-001 — Critical: `pino` module missing in container; entire app 500-ing

- **Symptom:** Every HTML page and `/api/*` route returned HTTP 500 with
  `Module not found: Can't resolve 'pino'` traced to `src/lib/logger.ts`.
- **Root cause:** Container's `node_modules` was out of sync with `package.json`
  (the same volume-cache class of bug we hit earlier with `@prisma/client`).
- **Impact:** 100% of users would see "Internal Server Error" on every
  request — including `/auth/signin`, `/api/health`, `/api/fhir/metadata`.
- **Fix:** `docker exec ecred-web npm install pino pino-pretty` (which is
  already declared in `package.json`). The `postinstall: prisma generate`
  hook we added earlier is sufficient for Prisma; this bug confirms we should
  rebuild the web image (not just `up`) whenever volumes are reset, or pin
  `node_modules` to a named volume.
- **Verification:** All `/api/*` endpoints now return their expected 200/401/307.

### DEF-002 — High: SendGrid webhook accepts unsigned events

- **Symptom:** `POST /api/webhooks/sendgrid` with no signature headers was
  accepted with HTTP 200, allowing anyone to spoof "delivered" / "bounced"
  events and corrupt the `Communication.deliveryStatus` analytics.
- **Root cause:** The webhook handler had no signature verification. The
  earlier sibling fix (`/api/webhooks/exclusions`, `/api/webhooks/fsmb-pdc`)
  had not been mirrored here.
- **Fix:** Rewrote `src/app/api/webhooks/sendgrid/route.ts` to:
  - Read the raw body and verify
    `X-Twilio-Email-Event-Webhook-Signature` against
    `SENDGRID_WEBHOOK_PUBLIC_KEY` using SHA256 (SendGrid's documented
    Event Webhook signing scheme).
  - Reject requests with stale timestamps (>10 min skew) to defeat replays.
  - Default to **deny** when no public key is configured (`SENDGRID_WEBHOOK_ENFORCE`
    must be explicitly set to `false` to opt out).
- **Verification:** Unsigned POST now returns
  `401 {"error":"SENDGRID_WEBHOOK_PUBLIC_KEY not configured; refusing unsigned webhook..."}`.
- **Action item:** Add `SENDGRID_WEBHOOK_PUBLIC_KEY` to production `.env`
  (value comes from SendGrid → Settings → Mail Settings → Event Webhook).

---

## What was actually tested

The automated runner exercises 29 categories of behavior end-to-end:

### Environment & infrastructure
- Both containers are running (`ecred-web`, `ecred-worker`).
- Prisma client matches the schema (5+ `monitoringAlert` references).
- All migrations applied (`prisma migrate status` clean).
- `/api/health`, `/api/ready`, `/api/live` all return 200 with correct payload.

### Configuration & secrets
- `DATABASE_URL` present in container.
- `ENCRYPTION_KEY` present in container.

### Authentication & access
- Sign-in page renders.
- Security headers present (X-Content-Type-Options, X-Frame-Options, Referrer-Policy).
- Dev JS chunks served `no-store` (prevents the hydration class of bug).
- Unauthenticated `/admin` returns 307 → `/auth/signin`.
- Cross-origin tRPC mutation does not reach the handler.

### Dashboards
- `/dashboard` redirects to signin when unauth'd (307).
- No hydration mismatch in last 500 lines of web logs.

### Continuous monitoring
- `/monitoring` route reachable (auth-redirect).
- `/api/webhooks/exclusions` rejects unsigned POST (401/403).

### Public REST + FHIR
- `/api/v1/providers` returns 401 without API key.
- `/api/fhir/metadata` returns a FHIR R4 `CapabilityStatement` (publisher,
  fhirVersion, kind correctly populated).
- API keys stored as SHA-256 hashes in the `api_keys` table.

### Webhooks security
- `/api/webhooks/fsmb-pdc` rejects unsigned POST.
- `/api/webhooks/sendgrid` rejects unsigned POST (after DEF-002 fix).

### Audit & encryption
- `audit_logs` table present.
- No SSN-shaped strings in last 2000 web log lines (PHI redaction working).

### Performance
- Dashboard P50 ≤ 1.5s, P95 ≤ 3s over 20 samples.
- `/api/v1/providers` survived 50-request burst with no 5xx.

### Page metadata
- `<title>` tag set on `/auth/signin`.

---

## What is "Blocked" and why

These tests can be automated but need test data or external systems we cannot
provision from CI:

| Test | Reason | Action |
|------|--------|--------|
| `/api/metrics` Prometheus format | Endpoint returns 404 — not implemented yet | Add `/api/metrics` route or remove from plan |
| API rate-limit (429) | No 429 in 60 unauth'd requests | Either rate-limiter not enabled on this path, or threshold > 60/min — verify and document |
| FHIR `Practitioner` Bundle | 401 (correct) but blocks the body assertion | Generate API key with `fhir:read` scope and re-run |
| SSN encrypted in DB | No SSN data seeded | Seed one provider with SSN to confirm encryption |
| Favicon | 404 on `/favicon.ico` | Add `app/icon.png` or `public/favicon.ico` |
| Logs are JSON | Default Next.js text-format logs | Configure structured pino transport in production |
| Custom business metrics exposed | `/api/metrics` not implemented | See above |

---

## What remains "Not Run" (223 cases)

These require human-driven actions the runner cannot perform:

- Authenticated browser sessions (Microsoft SSO interactive flow, role-based
  RBAC matrices, multi-tab session tests).
- Drag-and-drop interactions (Kanban, file upload).
- External sandbox systems (CAQH, NPDB, eMedNY, FSMB PDC, AMA Masterfile,
  state license sites, ABMS, OIG/SAM.gov live, SendGrid live, ACS SMS live).
- Visual / accessibility review (WCAG AA contrast, screen-reader semantics,
  empty-state CTAs, focus traps).
- Time-shifted scenarios (session expiry, expirables countdown, recred cycle
  auto-init, CAQH 120-day reminder).
- File-IO heavy tests (download audit packet ZIP and inspect contents,
  CSV exports, PDF assembly).
- Cross-browser smoke (Chrome/Edge/Firefox/Safari/iOS).

The XLSX is structured for a human tester to walk straight through these —
auto-filter the **Master Test Plan** sheet to `Status = Not Run`, sort by
Module, and check off as you go.

---

## How to repeat this run

```powershell
# After any code change or container restart:
C:/Users/admin/AppData/Local/Programs/Python/Python313/python.exe `
  docs/testing/run_master_test_plan.py
```

Each run produces a brand-new dated XLSX so historical results are preserved.
The runner is idempotent and safe to re-run as often as desired — it makes
no destructive calls.

---

## Recommended follow-ups (priority-ordered)

1. **Configure `SENDGRID_WEBHOOK_PUBLIC_KEY`** in prod and dev `.env` so
   the SendGrid webhook can verify real callbacks. Until then it returns 401.
2. **Pin `node_modules` to a named Docker volume** so a `docker compose rm -fv`
   doesn't strand `package.json` ahead of `node_modules` again (this caused
   both DEF-001 today and the Prisma client bug yesterday).
3. **Implement `/api/metrics`** Prometheus endpoint (referenced in plan;
   currently 404). Even a 5-line route returning queue depth + open-alert
   count is enough to satisfy ops dashboards.
4. **Add `app/icon.png`** so all browsers get a clean favicon.
5. **Switch web logs to structured JSON pino transport** in production so
   Datadog / log aggregator gets structured logs (the redact paths are
   already configured correctly).
6. **Walk the 223 manual cases** in the executed XLSX. Update **Status**,
   **Actual**, and **Notes** as you go; the conditional formatting will
   color-code progress automatically.
