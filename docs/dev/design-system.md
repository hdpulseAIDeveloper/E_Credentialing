# Design system — engineer's reference

> **CVO platform** design tokens, component primitives, and contribution rules.
> Authoritative reference: [ADR 0015](adr/0015-design-system.md).

This document is the day-to-day reference for engineers who build UI on
the Credentialing Verification Organization (CVO) platform. It explains
the token vocabulary, the primitive components, and how to add new ones
in a way that survives lint, dark mode, and future visual regression
tests (Wave 4.4).

## 1. Color tokens

All colors live in CSS custom properties defined in
[`src/app/globals.css`](../../src/app/globals.css). They are referenced
by Tailwind utility classes (e.g. `bg-primary`, `text-card-foreground`)
generated through the `tailwind.config.js` `theme.extend.colors` map.

| Group | Tokens |
|---|---|
| Surface | `background`, `foreground`, `card`, `card-foreground`, `popover`, `popover-foreground` |
| Brand | `primary`, `primary-foreground`, `secondary`, `secondary-foreground` |
| Accent / mute | `accent`, `accent-foreground`, `muted`, `muted-foreground` |
| Semantic | `destructive`, `destructive-foreground` |
| Form / focus | `border`, `input`, `ring` |
| Workflow status | `--status-invited`, `--status-onboarding`, `--status-docs-pending`, `--status-verification`, `--status-committee-ready`, `--status-committee-review`, `--status-approved`, `--status-denied`, `--status-deferred`, `--status-inactive` |

Both light and dark variants are defined; theme switching toggles the
`.dark` class on `<html>` (see §3 below).

### Using tokens

Prefer Tailwind classes:

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90" />
```

For one-off CSS values use the `hsl(var(--token))` form (this is the
canonical shadcn pattern and is accepted by `no-raw-color`):

```tsx
<div style={{ backgroundColor: "hsl(var(--status-approved))" }} />
```

### What's banned

The local ESLint rule [`ecred-local/no-raw-color`](../../eslint-rules/no-raw-color.js)
rejects raw hex / rgb / hsl literals inside `src/app/**/*.tsx` and
`src/components/**/*.tsx`. Email templates, bot scripts, and server
code are exempt because their runtime environments don't honor CSS
variables. See ADR 0015 §D3 for the full carve-out list.

## 2. Component primitives

Located under [`src/components/ui/`](../../src/components/ui/). Most are
shadcn/Radix wrappers; new behavior should land in those files rather
than in screen-level components so it propagates to every consumer.

| Primitive | Source | Stories |
|---|---|---|
| Button | `src/components/ui/button.tsx` | `stories/button.stories.tsx` |
| Badge | `src/components/ui/badge.tsx` | `stories/badge.stories.tsx` |
| Card | `src/components/ui/card.tsx` | `stories/card.stories.tsx` |
| Input | `src/components/ui/input.tsx` | `stories/input.stories.tsx` |
| Select | `src/components/ui/select.tsx` | `stories/select.stories.tsx` |
| Dialog | `src/components/ui/dialog.tsx` | `stories/dialog.stories.tsx` |
| DataTable (TanStack) | `src/components/ui/data-table.tsx` | `stories/data-table.stories.tsx` |
| ThemeToggle | `src/components/ui/theme-toggle.tsx` | `stories/theme-toggle.stories.tsx` |

### DataTable

The single canonical table primitive. Backed by `@tanstack/react-table`
internally; the column API is intentionally small. Opt-in features:

```tsx
<DataTable
  columns={columns}
  rows={rows}
  rowKey={(r) => r.id}
  sortable                       // click headers to sort
  globalFilter={searchInputValue} // case-insensitive substring across cells
  pageSize={25}                   // shows the pagination footer
  defaultSort={{ columnId: "createdAt", desc: true }}
/>
```

Each column may declare:

- `sortAccessor(row)` — primitive value used for sorting (required for sortable columns)
- `filterValue(row)` — string used by the global filter (defaults to the sort accessor)
- `align`, `width`, `className` — visual hints

## 3. Theming

Every page is wrapped at the root in [`<ThemeProvider>`](../../src/components/theme-provider.tsx).
It exposes `useTheme()` returning `{ theme, resolvedTheme, setTheme }`,
where `theme` is one of `"light" | "dark" | "system"`.

The provider:

- Reads `localStorage["ecred-theme"]` on mount.
- Falls back to `prefers-color-scheme` when stored theme is `system`.
- Toggles `class="dark"` on `<html>` so all CSS-var-based tokens flip.
- Re-renders in real time when the OS theme changes (system mode).

A small inline `<script>` (`themeFoucScript` in the same file) runs in
`<head>` BEFORE React hydrates so the user never sees a light-to-dark
flash on first paint.

The user-facing toggle is `<ThemeToggle />` — render it in any header
or settings panel.

## 4. Adding a new component

1. Create the file under `src/components/ui/`.
2. Use only token-based Tailwind classes; never hex/rgb/hsl literals.
3. Export named functions; if you need variants, use `class-variance-authority`
   like [`button.tsx`](../../src/components/ui/button.tsx).
4. Add a `*.stories.tsx` under `stories/` — see
   [`stories/README.md`](../../stories/README.md). Every named export
   becomes a story; the harness in
   [`tests/unit/stories/render-stories.test.tsx`](../../tests/unit/stories/render-stories.test.tsx)
   asserts each renders without error on every CI run.
5. Add focused unit tests under `tests/unit/components/` for any
   non-trivial behavior (sorting, filtering, controlled state…). Use
   `// @vitest-environment jsdom` at the top.
6. Run `npm run lint && npm run test` before committing.

## 5. CI gate

| Check | Script | Enforces |
|---|---|---|
| Lint (incl. `no-raw-color`) | `npm run lint` | No raw color literals in UI surfaces |
| Unit + story render | `npm run test` | Every component variant renders cleanly |
| QA coverage gate | `npm run qa:gate` | Per-screen cards + pillar specs exist |

## 6. Roadmap

- **Wave 4.4** — Playwright visual regression baselines per browser.
  Will use the same `stories/` corpus as the canonical visual surface.
- **Wave 5.5** — Promote lite-Storybook to full `@storybook/nextjs`
  with a public component-gallery URL for the design-partner program.
