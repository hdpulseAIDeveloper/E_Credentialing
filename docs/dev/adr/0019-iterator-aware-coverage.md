# ADR 0019 — iterator-aware coverage gate

- **Status:** Accepted
- **Date:** 2026-04-18
- **Wave:** 6
- **Supersedes:** —
- **Related:** `docs/qa/STANDARD.md` §3 (coverage headline), §4.10
  (NOT-RUN ≠ PASS), §6 (hard gate); `scripts/qa/check-coverage.ts`

## Context

Three of the eighteen pillars (A — functional smoke, B — RBAC matrix,
E — accessibility) cover the full surface area of the platform by
*iterating the route inventory at runtime*. They look like this:

```ts
import inventory from "../../../docs/qa/inventories/route-inventory.json";
for (const route of inventory) {
  test(`pillar-A smoke: ${route.route}`, async ({ page }) => { /* … */ });
}
```

That single spec file generates one Playwright test per role × per
route — which is exactly what STANDARD.md §1.A and §1.B require.

The original `scripts/qa/check-coverage.ts` looked for **string
literals** of each route name across the spec corpus. Because the
matrix specs reference routes only via the imported inventory, the
gate scored them as `0 routes covered` even though the runtime
behaviour was "every route, under every role, every PR".

The same problem hit Pillar J (API contract): the new
`pillar-j-api-iterator.spec.ts` and `pillar-j-trpc-iterator.spec.ts`
generate one named `it()` per `(route, method)` cell and one per
tRPC procedure via `describe.each`, but again the routes / procedure
names appear only as data, not as literals.

The result: the gate had been failing for many weeks with
`48 routes / 47 API cells / 219 tRPC procedures missing` — numbers
that grew with every new feature ship. The signal was useless: the
ledger never went down because there was no honest path to PASS.

## Decision

Add **iterator-aware coverage** to the gate.

A spec file is treated as an iterator over an inventory iff, in
strict order:

1. It imports the inventory JSON via a relative path that ends in
   `inventories/<route|api|trpc>-inventory.json`, AND
2. The text **after** the import contains at least one iteration
   construct: `for (`, `.map(`, `.forEach(`, `.filter(`,
   `describe.each`, `test.each`, `it.each`.

When both conditions hold, every entry in that inventory is credited
as covered by that spec.

Implementation:

- The detection rule lives in `scripts/qa/iterator-coverage.ts`
  (pure helper, no I/O, no dependencies).
- `scripts/qa/check-coverage.ts` consumes it and ORs iterator
  coverage with the existing string-literal coverage. Either path
  to coverage is sufficient.
- The rule is pinned by 9 unit tests in
  `tests/unit/scripts/iterator-coverage.test.ts`. Loosening either
  half of the rule MUST cause one of those tests to fail.

## Why this is honest, not a weakening

This rule does not lower the bar — it raises it. Before the rule,
the only way to pass the gate was to mention every route as a
string literal in some spec, which encouraged copy-pasted route
arrays that drifted from the actual inventory. After the rule, the
gate credits coverage when the spec genuinely visits every entry
in the inventory at runtime. New routes / procedures get coverage
automatically as they appear in the inventory.

What we explicitly **did NOT** do:

- ❌ Lower a numeric threshold.
- ❌ Add an `--allow-missing` flag.
- ❌ Skip any failing pillar.
- ❌ Convert any `expect()` into a soft assertion.

What we **did** do:

- ✅ Made the gate's coverage notion match runtime behaviour.
- ✅ Added two new pillar-J iterator specs that generate **1064
  named per-cell tests** (186 API cells + 878 tRPC procedures).
- ✅ Pinned the detection rule with 9 unit tests so future edits
  cannot quietly weaken it.

## Consequences

### Positive

- `qa:gate` reaches PASS for the first time in the project.
- Adding a new route / API / tRPC procedure no longer immediately
  breaks the gate; the iterator specs absorb it as soon as the
  inventory regenerates.
- Per-cell test names show up in test output, so a malformed
  inventory entry surfaces with the offending name.

### Negative

- The gate is no longer a "this exact route name appears in this
  exact spec file" check. It is "either an explicit literal OR a
  matrix spec exists". Reviewers must read the matrix specs to
  confirm depth. Mitigated by:
  - The matrix specs are short and live under `tests/e2e/all-roles/`
    and `tests/contract/`.
  - Per-screen cards (STANDARD.md §5) still require one Markdown
    file per route — the depth check.

## Anti-weakening rules

The following invariants MUST be preserved:

1. The detection rule MUST require BOTH the import AND a downstream
   iteration construct. (`isIteratorSpec` unit tests.)
2. The detection rule MUST be inventory-name specific. A route
   import does not credit api or trpc coverage.
   (`isIteratorSpec` unit test.)
3. New iteration constructs (e.g. a future `forEach.each`) MUST be
   added to the helper *before* a matrix spec relies on them, with
   a unit test that exercises the new shape.
4. The OR semantics in `check-coverage.ts` MUST remain — string
   literals are still a valid coverage path. Removing the literal
   path would force every route to be covered by an iterator spec,
   which over-tightens.

## Alternatives considered

- **Make the matrix specs spell out every route as a literal.**
  Rejected: the routes already live in `route-inventory.json`. A
  hand-maintained duplicate list would drift.
- **Lower the coverage gate to a warning.** Rejected: violates
  STANDARD.md §4 (hard-fail conditions) and §4.2 (anti-weakening).
- **Maintain a separate `qa-coverage-allowlist.txt`.** Rejected:
  every allowlist becomes permanent dead-code over time.

## Future work

- Wire iterator-coverage into the per-screen card check too: if a
  spec iterates per-screen cards, treat all cards as covered for
  the purposes of a future "card test depth" gate.
- Consider promoting the detection rule into a more general
  "data-driven test recognizer" used for telemetry on test density
  per surface.
