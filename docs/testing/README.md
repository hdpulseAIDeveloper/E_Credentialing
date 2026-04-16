# Testing Strategy

This section documents the testing approach, coverage, and plans.

## Contents

- [Test strategy](strategy.md)
- [Unit tests](unit-tests.md)
- [Integration tests](integration-tests.md)
- [E2E plan](e2e-plan.md)
- [Performance & load](performance.md)
- [Accessibility](accessibility.md)
- [Security testing](security.md)
- [Manual test plans](manual-test-plans.md)

See also: [developer testing reference](../dev/testing.md) for day-to-day commands.

## Current coverage floors

Enforced in `vitest.config.ts`:

- Lines: 60%
- Functions: 50%
- Branches: 50%
- Statements: 60%

Targets (to be raised over time):

- Lines: 85%
- Functions: 80%
- Branches: 75%
- Statements: 85%

## CI enforcement

Every PR runs:

- Typecheck
- ESLint
- Vitest unit + integration with coverage
- Playwright E2E
- Accessibility checks
- Forbidden-terms lint on user-facing docs
- CodeQL security analysis
- Dependency review
- Gitleaks secret scanning
