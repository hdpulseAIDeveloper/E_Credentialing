# Unit Testing Criteria

**Audience:** Every developer.

## What you must test before opening a PR

1. **All zod schemas** for new fields — invalid → fail; required → fail.
2. **All tRPC procedures** you add or change:
   - One success case.
   - One unauthorized case (`UNAUTHORIZED`).
   - One forbidden case (`FORBIDDEN` or row-level deny).
   - One bad-input case (`BAD_REQUEST`).
   - One conflict case if writes are involved (`CONFLICT`).
3. **Pure functions** in `src/lib/` and `src/server/services/` you add or
   change.
4. **Mappers** — given a Prisma result, the public DTO matches the schema.
5. **State machines** — every legal transition + at least one illegal transition
   tested (Provider, Enrollment, BotRun, Recredentialing, etc.).
6. **Encryption helpers** — round-trip + tampering rejected.
7. **Audit-log helper** — chain advances; tampering detected.

## Conventions

- Place unit tests next to the file under test:
  `src/server/services/foo.ts` → `src/server/services/foo.test.ts`.
- Use `describe` per function; `it` per scenario.
- Avoid mocking what you don't own; mock Prisma at the client level (`vi.mock`).
- Avoid time-based flakiness — use `vi.useFakeTimers()`.

## Coverage gate

CI fails if any of:

- lines < 60%
- statements < 60%
- branches < 50%
- functions < 50%

Modules under `src/lib/encryption.ts`, `src/lib/auditLog.ts`,
`src/server/services/auth/*` must remain at **100%**.

## Common mistakes

- Asserting on logger output. Don't — read the returned value or DB row.
- Network calls in unit tests. Use msw or stub the SDK.
- Snapshots for entire JSON payloads. Snapshot only the asserted property.
- Skipping the "unauthorized" case. Always include it for tRPC mutations.

## Examples

A representative unit test:

```ts
import { describe, it, expect, vi } from "vitest";
import { createCaller } from "@/server/api/root";
import { mockSession, mockPrisma } from "@/test/utils";

describe("provider.create", () => {
  it("rejects when not signed in", async () => {
    const caller = createCaller({ session: null, prisma: mockPrisma() });
    await expect(
      caller.provider.create({ npi: "1234567890", firstName: "A", lastName: "B" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("creates a provider and emits audit", async () => {
    const prisma = mockPrisma();
    const caller = createCaller({ session: mockSession({ role: "STAFF" }), prisma });
    const out = await caller.provider.create({
      npi: "1234567890",
      firstName: "A",
      lastName: "B",
    });
    expect(out.id).toBeDefined();
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });
});
```
