# ADR 0022 — Public REST v1 TypeScript SDK + spec-driven types

- **Status:** Accepted
- **Date:** 2026-04-18
- **Wave:** 10
- **Supersedes:** —
- **Related:** ADR 0020 (OpenAPI v1 spec),
  ADR 0021 (Schemathesis fuzz harness),
  [`src/lib/api-client/v1.ts`](../../../src/lib/api-client/v1.ts),
  [`src/lib/api-client/v1-types.ts`](../../../src/lib/api-client/v1-types.ts),
  [`scripts/qa/check-sdk-drift.ts`](../../../scripts/qa/check-sdk-drift.ts),
  [`docs/dev/runbooks/sdk-generation.md`](../runbooks/sdk-generation.md).

## Context

ADR 0020 shipped the OpenAPI 3.1 spec and ADR 0021 shipped a fuzz
harness. Customers evaluating the platform now ask the obvious next
question: "is there an SDK?". Two specific friction points:

1. Sales-engineering demos need a TypeScript snippet that compiles.
   Hand-rolling fetch calls per demo is slow and drift-prone.
2. Internal E2E tests against the v1 surface should be type-safe so
   spec changes ripple through CI, not into production at 3 AM.

## Decision

Ship a **two-file** TypeScript SDK in-tree, with a generator script
that anyone can copy:

1. **`src/lib/api-client/v1-types.ts`** — auto-generated from
   `docs/api/openapi-v1.yaml` by `openapi-typescript@7`. Exports
   `paths`, `components`, and `operations` types. Treated as a
   build artifact: never hand-edited.
2. **`src/lib/api-client/v1.ts`** — hand-written, dependency-free
   `V1Client` class wrapping `fetch`. Strongly typed by importing
   from `v1-types.ts`. Throws a `V1ApiError` carrying both the HTTP
   status and the structured `{ error: { code, message } }` envelope.

A **drift gate** keeps the two files honest:

- `npm run sdk:gen` — regenerate `v1-types.ts` from the spec.
- `npm run sdk:check` — regenerate into a temp file and compare
  byte-for-byte. Non-zero exit on any diff. Wired into
  `npm run qa:gate`.

A **runbook** at `docs/dev/runbooks/sdk-generation.md` documents
both the TypeScript flow (in-tree, mandatory) and the optional
**Python SDK** flow via `openapi-python-client` (out-of-tree, on
demand for Python customers).

## Why no Python SDK in-tree?

The Python ecosystem has two competing canonical generators
(`openapi-python-client` and `openapi-generator`). Each has opinions
about packaging, typing libraries (pydantic v1 vs v2), and async vs
sync clients. Picking one and shipping it in-tree would either
duplicate maintenance or alienate the half of customers who use the
other. The runbook documents both flows, with example commands, and
recommends customers vendor whichever fits their stack.

If/when a single Python customer asks for an officially-supported
SDK, we'll vendor it (probably `openapi-python-client`, pydantic v2)
in a separate repository under the org and release it on PyPI. That
becomes its own ADR.

## Anti-weakening rules

The following invariants MUST be preserved:

1. **`v1-types.ts` is auto-generated and MUST NEVER be hand-edited.**
   The drift gate will fail any manual edit on the next CI run.
2. **`v1.ts` MUST stay dependency-free.** No `axios`, no `ky`, no
   `superagent`. The CVO promise is "drop into any v18+ Node or
   modern browser, no transitive deps". Adding a transitive
   dependency requires a new ADR.
3. **`V1ApiError` MUST surface BOTH status and the structured error
   `code`.** Customer retry / circuit-breaker logic depends on both.
4. **`sdk:check` MUST stay in `qa:gate`.** Removing it allows silent
   spec/SDK drift to merge.
5. **The drift gate is a byte-for-byte comparison** — no
   "ignore whitespace" or "ignore comments". The generator is
   deterministic; drift is drift.
6. **The Wave 10 SDK covers ONLY the operations the spec declares.**
   Adding a method to `V1Client` for an undocumented endpoint is a
   defect — fix the spec first.

## Consequences

### Positive

- Customers get a working type-safe TypeScript snippet on first
  read of the README.
- Internal E2E tests can use the same SDK, which means refactors
  to the spec ripple through TypeScript before they ripple through
  customer code.
- The drift gate makes "I forgot to regenerate the SDK" impossible
  to merge.
- Zero new runtime dependencies — `v1.ts` only consumes built-in
  `fetch`/`Headers`/`URLSearchParams`/`Response`.

### Negative

- `openapi-typescript` is now a hard build dep (devDependency, but
  required for the gate). Mitigated by pinning the major version
  (`^7`) and noting it explicitly in the runbook.
- Every spec change requires a regenerate-and-commit step. Mitigated
  by the gate failing loudly with the exact fix instructions.
- Python customers don't get a free in-tree SDK. Mitigated by the
  runbook documenting the canonical out-of-tree path.

## Alternatives considered

- **`@hey-api/openapi-ts`.** Newer, generates a full client (not
  just types). Rejected — locks consumers into its specific runtime
  client, defeating the "drop in any project" promise.
- **`@trpc/openapi` for tRPC.** Out of scope — the v1 surface is
  REST. A future ADR may cover an internal SDK derived from tRPC.
- **Hand-written types, no generator.** Rejected — this is exactly
  the spec/code drift the OpenAPI spec exists to prevent.
- **In-tree Python SDK.** Rejected for now (see "Why no Python SDK
  in-tree?" above).

## Future work

- **Wave 11 candidate:** publish `@your-org/credentialing-v1` to
  npm so customers can `npm install` the SDK instead of vendoring
  the two files.
- **Wave 11 candidate:** when a Python customer commits, vendor
  `openapi-python-client` output into a sibling repo and release
  on PyPI as `your-org-credentialing`.
- Add a `V1Client.healthcheck()` helper that calls a (yet to be
  added) `/api/v1/health` endpoint so customers can validate
  base-url + key in one line.
- Generate Postman / Insomnia collection JSON from the spec at
  build time and serve at `/api/v1/postman.json`.
