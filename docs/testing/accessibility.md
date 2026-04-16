# Accessibility Testing

The platform targets **WCAG 2.1 AA** compliance.

## Automated checks

### Per page (E2E)

Every Playwright test injects `@axe-core/playwright` and asserts:

- No `critical` or `serious` violations.
- No violations with impact `moderate` unless explicitly waived in `tests/support/a11y-waivers.ts` with a rationale.

### Per component (Storybook)

Storybook has the `@storybook/addon-a11y` addon. Every story is run through axe; violations are reported in the test-runner.

### Linter

`eslint-plugin-jsx-a11y` is enabled with `recommended` config. Violations fail the build.

## Manual checks (per release)

Run the following on the top-10 pages (dashboard, provider list, provider detail, committee dashboard, committee session, enrollments, expirables, roster detail, audit log, admin users):

### Keyboard

- Tab order is logical.
- All interactive elements are focusable.
- Focus indicators are visible (min 3:1 contrast).
- `Escape` closes modals; focus returns to the trigger.
- No keyboard traps.

### Screen reader

Tested with:

- NVDA on Windows (primary).
- VoiceOver on macOS (secondary).

Checks:

- Page title announces on navigation.
- Form fields have accessible labels.
- Errors are announced via `role="alert"` / `aria-live`.
- Data tables have headers associated with cells.
- Dynamic content (bot status, toast notifications) is announced.

### Color / contrast

- Text meets AA contrast (4.5:1 body, 3:1 large).
- Status indicators do not rely on color alone — always pair with icon or text.
- Theme test: dark mode and high-contrast mode both pass.

### Zoom / reflow

- 200% browser zoom: no content clipped, no horizontal scroll on a 1280px viewport.
- 400% zoom: reflows to single column.

## Accessibility statement

A public [accessibility statement](../user/security.md#accessibility) describes the target standard and how to report issues.

## Remediation

- Critical or serious: fix before release.
- Moderate: fix within 2 sprints or waive in writing.
- Minor: backlog.

## Ongoing

- Annual external audit by a qualified firm.
- Quarterly internal review.
- Every new page must include manual keyboard and screen reader testing before merge.
