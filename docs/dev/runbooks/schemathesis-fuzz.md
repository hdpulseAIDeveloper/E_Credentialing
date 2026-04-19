# Runbook — Schemathesis fuzz of the public REST v1 surface

- **Owner:** API working group
- **Frequency:** weekly against staging; on-demand against local; **never against prod** without explicit opt-in.
- **Wave:** 9 (introduced 2026-04-18)
- **Related:**
  [`scripts/qa/schemathesis-run.py`](../../../scripts/qa/schemathesis-run.py),
  [`docs/api/openapi-v1.yaml`](../../api/openapi-v1.yaml),
  [`docs/dev/adr/0021-schemathesis-fuzz-harness.md`](../adr/0021-schemathesis-fuzz-harness.md),
  [`tests/contract/pillar-j-openapi.spec.ts`](../../../tests/contract/pillar-j-openapi.spec.ts).

## What this runbook does

Drives [Schemathesis](https://schemathesis.readthedocs.io/) over every
operation declared in the OpenAPI 3.1 spec and verifies the running
environment satisfies four checks per request:

1. **Status code conformance** — every response status is one the spec
   declares.
2. **Response schema conformance** — response bodies validate against
   the declared schema.
3. **Content-Type conformance** — declared `application/json` stays
   `application/json`.
4. **Response time** — no operation exceeds the spec's `x-rate-limit`
   budget (when declared).

Fuzz inputs are property-based via Hypothesis — the harness generates
edge-case query strings, header values, and request bodies to probe
for crashes, 5xx responses, and contract drift.

## Pre-flight (one-time)

1. Install schemathesis (Python 3.11+):

   ```powershell
   python -m pip install --user "schemathesis>=3.30,<4"
   ```

2. Provision a sandbox API key with the read scopes the v1 surface
   needs (`providers:read`, `sanctions:read`, `enrollments:read`,
   `documents:read`). Use the admin → API keys UI in the staging
   environment, NOT prod. Scope definitions are in
   `docs/api/openapi-v1.yaml` under
   `components.securitySchemes.BearerApiKey.x-scopes`.

## Running the fuzz pass

### Against local dev (recommended for first run)

```powershell
# In one terminal, start the app
npm run dev

# In a second terminal, run the harness
$env:SCHEMATHESIS_BASE_URL = "http://localhost:3000"
$env:SCHEMATHESIS_API_KEY = "<sandbox-key>"
python scripts/qa/schemathesis-run.py --hypothesis-max-examples 25
```

### Against staging

```powershell
$env:SCHEMATHESIS_BASE_URL = "https://staging.your-host.example.com"
$env:SCHEMATHESIS_API_KEY = "<sandbox-key>"
python scripts/qa/schemathesis-run.py
```

### Reproducible run (for triaging a flake)

```powershell
python scripts/qa/schemathesis-run.py --hypothesis-seed 1234
```

### Validate the deployed contract matches the local spec

```powershell
python scripts/qa/schemathesis-run.py --use-served-spec
```

## Output

- Console: a per-endpoint summary (PASS / FAIL / N/A).
- `tests/perf/results/schemathesis-junit.xml`: JUnit XML for CI ingestion.

## Triage matrix

| Failure | What it usually means | Next step |
| --- | --- | --- |
| `status_code_conformance` | Endpoint returned a status the spec doesn't declare. | Either widen the spec (if the new status is intentional) or tighten the route handler. |
| `response_schema_conformance` | Response body has fields the spec doesn't declare or is missing required ones. | Almost always: update the spec. Treat the running code as the truth. |
| `content_type_conformance` | Spec says JSON, route returned HTML or YAML. | Check error handlers — often a 500 leaking an HTML stack trace. |
| 5xx anywhere | Real bug. Open a defect card under `docs/qa/defects/`. | Reproduce with the seed printed at the failure; add a regression test under `tests/api/`. |
| Hangs / timeouts | Endpoint is missing a request-size limit or a query timeout. | Check the route handler for unbounded `where` clauses and add `select`/`take` constraints. |

## Anti-weakening rules

1. The `--checks all` flag MUST stay. Disabling individual checks
   (`--checks status_code_conformance` only, etc.) defeats the purpose.
2. The `PROD_HOSTNAMES` list in `scripts/qa/schemathesis-run.py` MUST
   stay narrow and explicit. Use `ALLOW_SCHEMATHESIS_PROD=1` for the
   rare case you really do mean to fuzz prod.
3. Failures uncovered by the harness MUST surface as defect cards
   under `docs/qa/defects/index.md` — they don't get to live as
   "we'll look at it later" Slack messages.

## Escalation

If the harness uncovers a 5xx that reproduces every run:

1. Open `docs/qa/defects/DEF-FUZZ-<NNNN>.md` with the seed and the
   failing operation.
2. Add a regression test under `tests/api/` that exercises the
   minimal failing input.
3. Fix the route handler. The regression test should now pass; rerun
   the fuzz harness to confirm no new related failures.
4. Add a customer-facing entry under `docs/changelog/public.md`
   (the feed that powers `/changelog`) if the fix changes any
   externally observable behaviour, and bump `info.version` in
   `docs/api/openapi-v1.yaml`.
