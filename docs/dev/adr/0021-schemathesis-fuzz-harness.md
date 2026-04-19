# ADR 0021 — Schemathesis fuzz harness for the public REST v1 surface

- **Status:** Accepted
- **Date:** 2026-04-18
- **Wave:** 9
- **Supersedes:** —
- **Related:** ADR 0020 (OpenAPI v1 spec),
  [`scripts/qa/schemathesis-run.py`](../../../scripts/qa/schemathesis-run.py),
  [`docs/dev/runbooks/schemathesis-fuzz.md`](../runbooks/schemathesis-fuzz.md),
  `docs/qa/STANDARD.md` §1.J / §7.

## Context

ADR 0020 shipped the OpenAPI 3.1 spec for `/api/v1/*` and a contract
test that asserts every inventoried route appears in the spec. That
contract test is **structural** — it confirms the *catalog* matches.
It does not actually exercise any operation against a running server.
Two failure modes still slip through:

1. The route handler returns a status code or body shape the spec
   doesn't declare (drift between spec and code).
2. The route handler crashes on weird-but-legal inputs (5xx where the
   spec promises 4xx, missing rate-limit budget, content-type
   leakage from error pages).

[Schemathesis](https://schemathesis.readthedocs.io/) is the canonical
property-based fuzzer for OpenAPI APIs (used by Stripe, GitLab, and
others in production CI pipelines). It generates Hypothesis-driven
inputs for every operation and checks status / schema / content-type /
response-time conformance per request.

`docs/qa/STANDARD.md §7` explicitly lists "Schemathesis or Dredd
against an OpenAPI 3.1 spec" as the API fuzz baseline.

## Decision

1. **Ship Schemathesis as a one-shot Python harness, not a CI step
   (yet).** The script lives at `scripts/qa/schemathesis-run.py` and
   is documented in `docs/dev/runbooks/schemathesis-fuzz.md`.
2. **Hard-coded prod-hostname guard.** The script refuses to run
   against the prod hostnames in the `PROD_HOSTNAMES` allowlist
   unless `ALLOW_SCHEMATHESIS_PROD=1` is set. This mirrors the
   `ALLOW_DEPLOY` guard pattern already in use by `scripts/ops/`.
3. **`--checks all` is mandatory.** The harness always runs
   `status_code_conformance`, `response_schema_conformance`,
   `content_type_conformance`, and `response_time_conformance`.
4. **JUnit XML output** at `tests/perf/results/schemathesis-junit.xml`
   so the result joins the k6 baselines under one results directory.
5. **Defer CI integration to a future ADR.** Rationale below.

## Why not auto-wire into CI on day one

Schemathesis needs:

- A reachable v1 surface (staging URL or a CI-spawned `npm run dev`).
- A live, scoped sandbox API key — these are dynamic, organisation-bound,
  and currently rotated by hand.
- Roughly 60s of wall-clock per organisation × endpoint family.

Wiring all three into CI today would require a synthetic-key vending
mechanism (probably a fixture organisation seeded by a new
`scripts/seed/schemathesis-org.ts`) plus a stable staging URL for
every PR run. That's a non-trivial chunk of work and depends on
infrastructure we haven't committed to (per-PR ephemeral envs).

The harness on its own delivers ~80% of the value (any engineer can
run it locally before merging API changes). The CI promotion is a
deliberate Wave 10+ candidate.

## Anti-weakening rules

The following invariants MUST be preserved:

1. **`--checks all` cannot be removed.** Reducing the check set turns
   the harness into a smoke test, not a fuzz pass.
2. **`PROD_HOSTNAMES` must stay narrow.** Any hostname added to the
   allowlist requires a separate review. The opt-in env var
   (`ALLOW_SCHEMATHESIS_PROD=1`) is the escape hatch — not the
   default behaviour.
3. **Failures uncovered by the harness MUST become defect cards
   under `docs/qa/defects/`.** They don't get to live as "we'll look
   at it later" Slack messages or unaddressed CI flakes.
4. **The bearer key MUST be redacted in the printed command.** Logs
   must never echo a working API key — the script's `redacted` list
   comprehension is load-bearing.

## Consequences

### Positive

- Drift between code and spec surfaces immediately (with a JUnit
  artifact) instead of being discovered by a customer.
- Provides a reproducible failure mode (`--hypothesis-seed`) —
  perfect for filing defect cards.
- Closes the spec-fuzz gap called out in `STANDARD.md §7`.
- Adds zero CI minutes today; engineers opt in.

### Negative

- Requires Python + a one-time `pip install schemathesis`. Mitigated
  by a clear pre-flight in the runbook.
- Network-dependent — can't run fully offline. Mitigated by
  documenting the local-dev path (`npm run dev` + localhost).
- Not auto-enforced on PRs. Mitigated by the runbook landing in
  the engineering README and a future ADR for CI promotion.

## Alternatives considered

- **Dredd.** Simpler but actively unmaintained (last release Q3 2024).
  Schemathesis has the larger contributor base, OpenAPI 3.1 support,
  and explicit Hypothesis integration.
- **Postman + Newman.** Postman tests are example-based, not
  property-based. They'd duplicate `tests/api/` rather than catch the
  long-tail cases that property-based fuzzing hits.
- **Custom property-based harness.** Re-implementing `--checks all`
  on top of `fast-check` plus our own schema validator was
  considered — three weeks of yak-shaving for a strictly worse
  result than `pip install schemathesis`.
- **CI integration on day one.** Rejected because the necessary
  staging URL + ephemeral API-key vending isn't built yet (see
  "Why not auto-wire into CI on day one" above).

## Future work

- **Wave 10 candidate:** vend a synthetic organisation + scoped API
  key in CI, then promote the harness into the nightly pipeline.
- Once promoted, gate PR merges on a ≤24h-old green schemathesis
  run rather than the in-line PR check (keeps PR latency low while
  still catching drift).
- Add a `--regression-seed-file` mode that replays seeds captured
  from previously-filed defect cards (cheap regression net).
