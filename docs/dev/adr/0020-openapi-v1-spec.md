# ADR 0020 — OpenAPI 3.1 spec for the public REST v1 surface

- **Status:** Accepted
- **Date:** 2026-04-18
- **Wave:** 8
- **Supersedes:** —
- **Related:** ADR 0019 (iterator-aware coverage),
  `docs/qa/STANDARD.md` §1.J / §7,
  `tests/contract/pillar-j-openapi.spec.ts`,
  `src/app/api/v1/openapi.yaml/route.ts`.

## Context

The platform exposes a small but production-grade public REST v1 surface
(`/api/v1/providers`, `/api/v1/providers/{id}`,
`/api/v1/providers/{id}/cv.pdf`, `/api/v1/sanctions`,
`/api/v1/enrollments`). It is API-key gated, scope-checked, audited,
and PHI-stripped. External evaluators reach it via the public
`/sandbox` surface (which describes the synthetic shape) and via
direct documentation, but until Wave 8 there was **no machine-readable
contract**. That blocked:

- Schemathesis fuzz testing (`STANDARD.md §7` lists Schemathesis or
  Dredd against an OpenAPI 3.1 spec).
- TypeScript / Python client generators for downstream customers.
- API-explorer UIs (Stoplight, Swagger UI, Redocly) which the sales
  team has been asked for during early CVO conversations.
- A clean way to gate "every inventoried `/api/v1/*` route is
  documented" — which is the contract test that ships with this ADR.

## Decision

1. **Hand-edit the spec, don't generate it.** The source of truth
   lives at [`docs/api/openapi-v1.yaml`](../../api/openapi-v1.yaml).
   The route handlers are small enough that authoring the contract
   directly is more honest than parsing TypeScript ASTs and producing
   a derived shape that drifts.
2. **Serve it at `/api/v1/openapi.yaml`** with media type
   `application/yaml; charset=utf-8` (RFC 9512). The endpoint reads
   the YAML file once per process and caches it in memory.
3. **Pin the contract with a Pillar J iterator test**
   ([`tests/contract/pillar-j-openapi.spec.ts`](../../../tests/contract/pillar-j-openapi.spec.ts))
   that walks `api-inventory.json`, filters to `/api/v1/*`, and
   asserts every route + every method appears in the spec under the
   templated path (`[id]` → `{id}`). The single permitted exclusion
   is the spec-delivery endpoint itself (would be a circular ref).
4. **Anti-PHI guard:** the same test enumerates a hard list of PHI
   field names (`ssn`, `dateOfBirth`, `dob`, `deaNumber`,
   `personalAddress`, etc.) and walks every `properties` block in
   the parsed spec. None of these names may appear as a schema
   property. Descriptive prose ("never SSN, DOB, DEA") is allowed —
   the test deliberately walks the parsed schema, not the raw text.
5. **Surface the spec from `/sandbox`** so evaluators see the
   contract URL alongside the synthetic playground.

## Why hand-edited

- Two of the v1 endpoints have nontrivial response envelopes
  (`ProviderDetail` includes nested licenses / enrollments /
  expirables arrays). A faithful generated schema would require a
  decorator framework we don't have. Adopting `@trpc/openapi` or
  `zod-openapi` would couple the public REST surface to its current
  implementation, which is the wrong direction — the contract should
  outlive any single implementation.
- The PHI-strip rule is a *promise*, not a derivable fact. The spec
  is the place that promise is documented and the test is the place
  that promise is mechanically enforced. A generator would emit
  whatever fields the implementation happens to return today.

## Consequences

### Positive

- External customers can `curl /api/v1/openapi.yaml` and pipe the
  output into any OpenAPI-aware tool.
- Schemathesis can be wired into CI (Wave 9 candidate).
- Adding a new `/api/v1/*` route now requires backfilling the spec,
  enforced at PR-time by the contract test.
- A new ADR isn't needed for a future v2 — bumping `info.version`
  and adding a parallel `openapi-v2.yaml` is the standard path.

### Negative

- The spec must be updated by the author of any new public endpoint.
  Mitigated by the contract test failing loudly on drift.
- Hand-edited YAML can drift from the implementation in ways that
  type-checking can't catch. Mitigated by:
  - Pillar J iterator (this ADR's test) catches missing paths and
    methods.
  - Future Schemathesis run (Wave 9) will catch response shape drift.
  - The PHI guard catches the most consequential leak.

## Anti-weakening rules

The following invariants MUST be preserved:

1. The contract test MUST iterate `api-inventory.json` rather than
   a hand-maintained list. (Wave 6 / ADR 0019 lesson.)
2. The PHI guard MUST walk parsed schema property names, NOT the
   raw YAML text. The deliberate exception lets descriptive prose
   warn future maintainers about excluded fields.
3. The `SPEC_DELIVERY_ROUTES` exclusion list MUST contain at most one
   entry (`/api/v1/openapi.yaml`). Extending it is a code-smell
   review item.
4. The route handler MUST NOT transform the YAML — it serves the
   file as-is. Future tooling (linting, bundling) belongs in build
   scripts, not in the request path.

## Alternatives considered

- **`@trpc/openapi` for tRPC procedures.** Rejected for this wave —
  the v1 surface is REST, not tRPC. (A future ADR may cover an
  internal OpenAPI for the tRPC contract used by SDK customers.)
- **`zod-openapi` to derive REST schemas.** Rejected — the route
  handlers don't currently use Zod for response shapes (only for
  request inputs). Refactoring every route handler to emit Zod
  output schemas was out of scope for Wave 8.
- **Stoplight Studio as the single source of truth.** Rejected —
  introduces a non-text editing tool into a text-first repo.

## Future work

- **Wave 9 (candidate):** wire Schemathesis into CI to fuzz the v1
  surface against the spec. Requires staging credentials and a small
  harness that allocates an API key with the appropriate scopes.
- Generate a Redocly-rendered HTML version at build time and host
  it under `/docs/api`.
- Add a `/api/v1/openapi.json` route that emits the same spec in
  JSON for tools that don't speak YAML.
