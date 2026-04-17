# UI / UX Style Guide

**Audience:** Designers, developers, QA.
**Stack:** Tailwind CSS 3 + shadcn/ui (Radix primitives). No second design system.

---

## 1. Design tokens

Tokens are exported from `tailwind.config.ts` and surfaced as CSS variables.

| Semantic token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FFFFFF` | `#0B1020` | Page background |
| `foreground` | `#0F172A` | `#E2E8F0` | Default text |
| `card` | `#F8FAFC` | `#0F172A` | Card backgrounds |
| `border` | `#E2E8F0` | `#1E293B` | Component borders |
| `primary` | `#0EA5E9` | `#38BDF8` | Primary actions, links |
| `primary-foreground` | `#FFFFFF` | `#0B1020` | Text on primary |
| `secondary` | `#0F766E` | `#14B8A6` | Brand accents (matches favicon) |
| `success` | `#16A34A` | `#22C55E` | Confirmations |
| `warning` | `#D97706` | `#F59E0B` | Recommendations |
| `caution` | `#EAB308` | `#FACC15` | Approaching deadlines |
| `destructive` | `#DC2626` | `#EF4444` | Errors, expirations, denials |
| `info` | `#2563EB` | `#60A5FA` | Neutral information |
| `muted` | `#F1F5F9` | `#1E293B` | Disabled / hint backgrounds |
| `muted-foreground` | `#64748B` | `#94A3B8` | Hint and metadata text |

Never hard-code hex values in components. ESLint enforces this via the
`no-hard-coded-colors` lint rule (planned).

---

## 2. Typography

| Role | Font | Size / line-height | Weight |
|---|---|---|---|
| Display (page H1) | Inter | 32 / 40 | 600 |
| Section (H2) | Inter | 24 / 32 | 600 |
| Subsection (H3) | Inter | 18 / 28 | 600 |
| Body | Inter | 14 / 22 | 400 |
| Body strong | Inter | 14 / 22 | 600 |
| Label | Inter | 12 / 18 | 500 |
| Code / mono | JetBrains Mono | 13 / 20 | 400 |

Scale up by 1 step on screens > 1280 px wide.

---

## 3. Spacing

Use the Tailwind 4-pt scale (`px-2`, `py-3`, etc.). Common patterns:

- Card inner padding: `p-4` on small, `p-6` on medium+.
- Form field stacks: `space-y-4`.
- Section spacing: `space-y-8` between top-level sections.
- Page gutters: `px-4` on small, `px-6` md, `px-8` lg.

---

## 4. Components

Always import from `src/components/ui/` (shadcn primitives) before reaching
for a third-party library. Custom feature components live under
`src/components/<feature>/`.

| Pattern | Component | Notes |
|---|---|---|
| Buttons | `Button` | Variants: `default`, `secondary`, `outline`, `ghost`, `destructive`, `link` |
| Forms | `Form`, `FormField` | Wraps react-hook-form + zod resolver |
| Inputs | `Input`, `Textarea`, `Select`, `Checkbox`, `Switch`, `RadioGroup` | All `aria-*` propagate |
| Date | `DatePicker` | Locale-aware; ISO under the hood |
| Modal | `Dialog`, `AlertDialog` | `AlertDialog` for destructive confirmations |
| Toast | `Toast`, `useToast` | Severity tokens map to colors |
| Tables | `DataTable` (TanStack Table v8 wrapper) | Sortable headers, sticky toolbar, density toggle |
| Tabs | `Tabs` | Persist active tab in URL `?tab=` |
| Badge | `Badge` | Status colors map to severity tokens |
| Empty state | `EmptyState` | Icon + headline + supporting + primary action |

---

## 5. Layout

- Persistent left sidebar (`w-60`) with role-filtered nav items.
- Sticky top bar with global search, notifications bell, user menu.
- Content area: `max-w-7xl mx-auto`.
- Wide tables can extend to full width with `max-w-none`.

Responsive breakpoints follow Tailwind defaults: `sm: 640`, `md: 768`,
`lg: 1024`, `xl: 1280`, `2xl: 1536`.

---

## 6. Iconography

- `lucide-react` everywhere. No mixed icon packs.
- Default size 16 px in inline use, 20 px in buttons, 24 px in cards.
- Icons must have `aria-hidden="true"` when accompanied by visible text;
  otherwise an explicit `aria-label`.

---

## 7. Motion

- Subtle: 150 ms ease-out for entry, 100 ms ease-in for exit.
- Respect `prefers-reduced-motion` (Tailwind variant `motion-safe:` /
  `motion-reduce:`).
- Skeleton shimmer ≤ 2 s loops.

---

## 8. Accessibility

- WCAG 2.2 AA target.
- Color contrast: text vs. background ≥ 4.5:1; large text ≥ 3:1.
- Focus visible on every interactive element. Outline color = `primary` with
  2 px offset.
- Form inputs always have an explicit `<label>` (visible or `sr-only`).
- Required fields use `aria-required="true"` and a visible `*`.
- Errors use `aria-describedby` linking to the inline error.
- Keyboard: all flows operable; modal traps focus; ESC closes; tab order
  logical.
- Tables: headers labelled; sortable headers expose `aria-sort`.
- Live regions: toasts use `aria-live="polite"`; error banners
  `aria-live="assertive"`.
- Provider portal pages must remain operable on assistive tech (tested with
  NVDA + VoiceOver during UAT).

---

## 9. Data presentation

- Dates: locale display in UI; ISO 8601 UTC in JSON.
- Phones: E.164 in storage; locale-formatted in UI.
- Money: `Intl.NumberFormat` with currency.
- Identifiers (NPI, DEA, license #): monospaced font; click to copy.
- PHI fields (SSN, DOB): masked by default (`***-**-1234`); reveal triggers an
  audit row.

---

## 10. Error and empty states

Every list view must implement:

- Initial loading: skeleton rows.
- Empty result: `EmptyState` with: icon, heading ("No providers yet"), one
  supporting line, primary action.
- Error: banner with retry button; structured error message from API; never
  leak stack traces or PHI.

---

## 11. Naming conventions

- Pages: noun-first ("Providers", "Committee Sessions").
- Buttons: verb-noun ("Create Provider", "Send Invite").
- Confirmations: action verb past tense ("Provider created.").
- Errors: human, non-technical, action-oriented ("This NPI failed the
  standard checksum. Please double-check the 10 digits.").
- Microcopy avoids "We" / "Our" (the platform speaks neutrally).

---

## 12. Cross-references

- Standard message strings: [messaging-catalog.md](messaging-catalog.md)
- Field validation library: [validation-rules.md](validation-rules.md)
- State machines: [status-workflows.md](status-workflows.md)
