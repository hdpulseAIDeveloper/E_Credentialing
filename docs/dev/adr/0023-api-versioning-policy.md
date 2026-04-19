# ADR 0023 — Public REST API versioning + deprecation policy + Postman collection

- **Status:** Accepted
- **Date:** 2026-04-18
- **Wave:** 11
- **Supersedes:** —
- **Related:** ADR 0020 (OpenAPI spec), ADR 0022 (TypeScript SDK),
  [`docs/api/versioning.md`](../../api/versioning.md) (canonical policy),
  [`scripts/qa/build-postman-collection.ts`](../../../scripts/qa/build-postman-collection.ts),
  [`scripts/qa/check-postman-drift.ts`](../../../scripts/qa/check-postman-drift.ts),
  [`tests/contract/pillar-j-postman.spec.ts`](../../../tests/contract/pillar-j-postman.spec.ts).

## Context

ADR 0020 shipped the OpenAPI 3.1 spec; ADR 0022 shipped a typed
SDK. Two consequential gaps remain for commercial readiness:

1. **No published versioning policy.** Customers have no way to
   tell whether "we're going to add an enum value" is a breaking
   change for them or whether they get notice before an endpoint
   disappears. Sales-engineering can't honestly answer "what's
   your deprecation policy" without a written commitment.
2. **No one-click API explorer artifact.** Customers can curl the
   YAML/JSON spec, but the most common evaluation flow is "import
   into Postman, click around". Asking customers to set up auth
   on every operation by hand is friction.

## Decision

Two parallel deliverables in Wave 11:

### 1. Publish a versioning + deprecation policy

A canonical document at [`docs/api/versioning.md`](../../api/versioning.md)
describing:

- **URL-path versioning** (`/api/v1/...`, `/api/v2/...`).
- A **SemVer 2.0** model within a major (`info.version` in the spec).
- An explicit catalogue of breaking / sometimes-breaking /
  never-breaking changes.
- A **90-day minimum** notice for deprecations, signalled via
  `Deprecation`, `Sunset` (RFC 9745 / 8594), and
  `Link: rel="successor-version"` (RFC 8288) response headers.
- A **12-month minimum** parallel-run window when a new major
  ships.
- Anti-weakening rules guarding all of the above.

This doc is the contract. It is the file we point legal, sales,
and customer-success at when they ask "what do we promise?".

### 2. Ship a Postman v2.1.0 collection in lockstep with the spec

- Generator: [`scripts/qa/build-postman-collection.ts`](../../../scripts/qa/build-postman-collection.ts).
  Walks the OpenAPI spec, emits one folder per `tag` + one item per
  operation. Auth is wired to a `{{api_key}}` variable; base URL is
  wired to a `{{base_url}}` variable.
- Output: `public/api/v1/postman.json`. Checked in.
- Served at `/api/v1/postman.json` with
  `Content-Disposition: attachment` so customers can download
  with a one-line `curl`.
- Drift gate: [`scripts/qa/check-postman-drift.ts`](../../../scripts/qa/check-postman-drift.ts).
  Rebuilds the collection in memory and compares against the
  checked-in copy (deep-equal, ignoring the volatile
  `_postman_id` field that Postman injects on import). Wired into
  `npm run qa:gate`.
- Contract test: [`tests/contract/pillar-j-postman.spec.ts`](../../../tests/contract/pillar-j-postman.spec.ts).
  12 tests asserting Postman v2.1.0 schema, bearer-auth wiring,
  variable contract, and per-operation parity with the spec.

## Why we did NOT pick "Just point customers at the OpenAPI spec"

Postman can import an OpenAPI spec directly — so why ship a
pre-built collection? Three reasons:

1. **Out-of-the-box auth wiring.** Imported OpenAPI specs require
   the user to manually configure auth in Postman (or the import
   discards it depending on version). The pre-built collection
   wires `Bearer {{api_key}}` on the collection, so every request
   inherits it for free.
2. **Stable customer artifact.** The collection has its own
   download URL we can include in sales decks, README badges, and
   onboarding emails. The contract is "import this URL", not
   "navigate to docs, copy the spec URL, paste, fix auth".
3. **Doubles as a smoke test.** Once a customer imports, they can
   click "Send" on any request and immediately see whether
   `{{base_url}}` and `{{api_key}}` are correct. This is the
   shortest possible path from "received credentials" to "first
   working call".

## Anti-weakening rules

The following invariants MUST be preserved:

1. **The Postman generator MUST cover every spec operation.** The
   contract test in `tests/contract/pillar-j-postman.spec.ts`
   enforces this. Adding an endpoint to the spec without
   regenerating fails CI.
2. **`postman:check` MUST stay in `qa:gate`.** Removing it allows
   silent drift to merge.
3. **The collection MUST NOT bake any real or placeholder
   credential.** The `{{api_key}}` variable ships empty.
4. **The variable names `base_url` and `api_key` are the customer
   contract.** Renaming either is a breaking change requiring a
   `/changelog` entry under the deprecation lifecycle from
   `versioning.md`.
5. **The 12-month parallel-run window in `versioning.md` is
   non-negotiable.** Internal roadmap pressure does not shrink
   it. Any deviation requires a new ADR replacing this one.
6. **The 90-day minimum deprecation notice is non-negotiable.**
   Same justification as above.

## Consequences

### Positive

- A written contract (`versioning.md`) for sales, legal, and
  customer-success to point at without paraphrasing.
- One-click Postman import for customer evaluations.
- Contract-test parity — the collection cannot drift behind the
  spec without breaking CI.
- Clean, documented headers contract for deprecations that aligns
  with the IETF RFCs (9745, 8594, 8288).

### Negative

- Two more files to maintain in lockstep with the spec
  (`postman.json` and the SDK types). Both are auto-generated and
  drift-gated, so the maintenance cost is "regenerate when the
  spec changes" — not "remember to update".
- 12-month parallel-run window will be expensive when v2 ships.
  Mitigated by the parallel-run cost being a one-time event per
  major bump; the alternative (no notice) is worse.
- The Postman collection is a Postman-format artifact. Insomnia
  and Bruno can import Postman v2.1 collections natively, so the
  marginal cost to non-Postman customers is zero. Future ADR
  could add `/api/v1/insomnia.json` if demand emerges.

## Alternatives considered

- **Date-stamped versioning (`/api/2026-04-18/...`).** Rejected.
  Forces customers to track a moving target and re-pin
  constantly. Stripe-style "version on header" was the runner-up
  but is invisible to corporate proxies.
- **Header-negotiation versioning
  (`Accept: application/vnd.platform.v2+json`).** Rejected — see
  `versioning.md §1`. Invisible to ops tooling.
- **Generate the collection at request time.** Rejected — adds
  CPU on every request and makes the collection's content
  non-deterministic for cache invalidation.
- **Vendor `openapi-to-postmanv2` from Postman.** The library is
  ~600KB and pulls 30+ transitive deps, mostly to support
  OpenAPI 2.0 / Swagger features we don't have. Hand-rolling
  ~250 lines of generator that targets only what `openapi-v1.yaml`
  actually uses is honest and zero-dep.
- **Skip the `Sunset` header and just rely on the changelog.**
  Rejected — a machine-readable signal is the difference between
  "customer sees alert in their monitoring" and "customer
  discovers a 410 in production at 3 AM".

## Future work

- **Wave 12 candidate:** runtime contract test asserting that any
  operation with `deprecated: true` in the spec serves the
  required `Deprecation` / `Sunset` / `Link` headers.
- **Wave 12 candidate:** when `/api/v2` is on the roadmap, ship a
  `docs/dev/runbooks/api-migration-v1-to-v2.md` runbook on the
  same day the v2 spec lands.
- **Wave 13 candidate:** `/api/v1/insomnia.json` and
  `/api/v1/bruno.json` mirrors if customers ask.
- **Wave 13 candidate:** publish the Postman collection to
  Postman's public network (and the npm SDK) so customers can
  one-click "Run in Postman".
