# ADR 0015 — Design system consolidation (TanStack DataTable, ThemeProvider, no-raw-color, lite Storybook)

**Status:** Accepted
**Date:** 2026-04-18
**Deciders:** Engineering (autonomous lock-in per user directive 2026-04-18 — "make the best choice, make this a most robust and commercially viable CVO")
**Related:** Wave 2.2 in the local Cursor plan
`unblock_+_commercialize_ecred` (design-system consolidation).

## Context

The platform is built on shadcn/ui primitives (Radix + Tailwind) with
hand-rolled wrappers under `src/components/ui/`. As we approach a
commercial CVO release we need three consolidations that today are
either ad-hoc or absent:

1. A canonical table primitive. We currently have a hand-rolled
   `DataTable` (`src/components/ui/data-table.tsx`) that explicitly
   defers TanStack integration to a later date. New screens routinely
   need sorting, filtering, pagination, and column visibility, and
   each one is reinventing those mechanics inline.

2. A theme system. Both palettes (`light`, `dark`) are already defined
   as CSS variables in `src/app/globals.css` lines 6-49, but nothing
   applies the `dark` class to `<html>`. Users cannot opt into dark
   mode, and the OS-level `prefers-color-scheme` is ignored.

3. A guardrail against raw color literals. Components occasionally
   sprout `style={{color:"#0ea5e9"}}` or `className="bg-[#fff]"`,
   which silently breaks dark mode and accessibility audits.

A fourth, often-coupled item is Storybook. A full `@storybook/nextjs`
install adds ~25 dev dependencies and a parallel webpack/vite config
that historically fights our tRPC + Auth.js provider tree.

## Decisions

### D1 — Adopt TanStack Table inside the existing `DataTable` primitive (in place)

Keep the existing `DataTableColumn<Row>` API byte-identical so any
current or future call site keeps working unchanged. Internally,
re-route through `@tanstack/react-table` (already a dependency at
`^8.20.5`). New behavior is opt-in via three new optional props:

```ts
interface DataTableProps<Row> {
  // ...existing props unchanged...
  sortable?: boolean;          // turns headers into sort triggers
  globalFilter?: string;       // case-insensitive substring across cells
  pageSize?: number;           // enables built-in pagination footer
}
```

**Why in place, not a sibling `DataTableAdvanced`?** Two-table sprawl
is a known design-system anti-pattern; we'd inevitably end up with
some screens on the lite version and some on the advanced version,
with subtly diverging styling and a/11y treatment. The opt-in props
let us upgrade screens incrementally without forking the surface.

### D2 — Hand-rolled `ThemeProvider`, not `next-themes`

Sixty lines of code, one `localStorage` key (`ecred-theme`), one
`MediaQueryList` listener. We ship `light | dark | system`. A small
inline `<script>` in `<head>` sets the class before paint to avoid
FOUC. We avoid the `next-themes` dependency because (a) a 60-line
component is not worth a third-party dep that has had several
SSR-hydration bugs in 2024-2025, and (b) we want to own the
`localStorage` key namespace so future compliance footers and
settings panels don't collide.

### D3 — Local ESLint plugin `no-raw-color`

A single rule that bans `#rrggbb`, `#rgb`, `rgb(...)`, `rgba(...)`,
`hsl(...)`, `hsla(...)` literals inside `src/**/*.tsx` JSX strings,
template literals, and object expressions. Allowlist:

- `currentColor`, `transparent`, `inherit`, `none`, `unset`, `initial`,
  `auto`.
- Any `rgb(var(--token))` or `hsl(var(--token))` form — the canonical
  shadcn / Tailwind indirection — which is how the workflow status
  palette in `src/app/(staff)/dashboard/page.tsx` resolves color
  through the `--status-*` CSS variables defined in `globals.css`.

Scope (via ESLint `overrides`): only `src/app/**` and
`src/components/**`. Email templates (`src/lib/email/**`) are exempt
because email clients don't honor CSS variables; bot scripts
(`src/workers/**`) are exempt because they inject HTML into external
pages where our token system is unavailable; server templates
(`src/server/**`) are exempt for the same reason.

Per-line escape hatch
(`// eslint-disable-next-line ecred-local/no-raw-color`) is reserved
for genuine brand-asset SVGs (e.g., the Microsoft 4-square logo on
`/auth/signin`, whose colors are mandated by Microsoft's brand
guidelines and may not be substituted).

### D4 — Lite Storybook (CSF + Vitest render harness), not full `@storybook/nextjs`

CSF 3-format `.stories.tsx` files colocated with components. A
single Vitest test file (`tests/unit/stories/render-stories.test.tsx`)
auto-discovers every story, mounts each named export inside a
minimal provider tree (ThemeProvider + a stub TRPC provider) and
asserts it renders without throwing. This buys us:

- Every component variant is exercised on every CI run.
- Stories double as machine-readable usage docs for engineers and
  the future commercial design-partner program.
- Zero new top-level deps; we already have `@testing-library/react`,
  `jsdom`, and `vitest`.

**Upgrade trigger to full Storybook:** Wave 5.5 (customer-facing
`/changelog` page) when we'll want a public component gallery URL
to ship to design partners. At that point the cost of the full
install is paid back by the marketing surface; today it is not.

## Consequences

- **+** One canonical table primitive with growth room. Each new
  screen no longer reinvents sort/filter/paginate.
- **+** Dark mode shipped end-to-end (CSS tokens already exist).
- **+** Color-token discipline enforced in CI; visual regression
  baselines (Wave 4.4) stay stable across themes.
- **+** Story-render harness gives us 8-10 new component-test cases
  for free.
- **−** A future migration to full Storybook is a real but bounded
  task: copy CSF files into `.storybook/`-aware paths, install
  framework. Tracked under Wave 5.5.
- **−** A bug in the inline FOUC `<script>` could flash the wrong
  theme. Mitigated by a tight contract test in
  `tests/unit/components/theme-provider.test.tsx`.

## Implementation order (Wave 2.2)

1. **W2.2.a** — `src/components/theme-provider.tsx` + tests.
2. **W2.2.b** — `src/components/ui/theme-toggle.tsx`.
3. **W2.2.c** — Wire `<ThemeProvider>` + FOUC `<script>` into `src/app/layout.tsx`.
4. **W2.2.d** — Upgrade `src/components/ui/data-table.tsx` in place; preserve API; add opt-in props.
5. **W2.2.e** — `eslint-rules/no-raw-color.js` plugin + RuleTester unit tests.
6. **W2.2.f** — Wire plugin into `.eslintrc.json`; fix any pre-existing violations (Fix-Until-Green).
7. **W2.2.g** — Eight CSF `.stories.tsx` files (Button, Badge, Card, Input, Select, Dialog, DataTable, ThemeToggle).
8. **W2.2.h** — `tests/unit/stories/render-stories.test.tsx` auto-render harness.
9. **W2.2.i** — `docs/dev/design-system.md` index + Pillar D note in `docs/qa/STANDARD.md`.

## Alternatives considered

- **Full `@storybook/nextjs` install.** Rejected for size and
  brittleness today; reassess at Wave 5.5.
- **Sibling `DataTableAdvanced` component.** Rejected for two-table
  sprawl risk.
- **`next-themes` dependency.** Rejected for negligible code savings
  and history of SSR-hydration bugs.
- **Pure CSS-vars, no provider.** Rejected because we need explicit
  user control of theme (auditor-package screenshots must be
  reproducible).
