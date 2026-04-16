# tRPC and the Service Layer

The app uses tRPC for all typed client-server calls. Every router hangs off `src/server/api/routers/` and is composed in `src/server/api/root.ts`.

## Router pattern

```ts
// src/server/api/routers/provider.ts
export const providerRouter = createTRPCRouter({
  listMyPanel: specialistProcedure
    .input(z.object({ cursor: z.string().optional() }))
    .query(async ({ ctx, input }) => providerService.listMyPanel(ctx, input)),

  create: managerProcedure
    .input(createProviderSchema)
    .mutation(async ({ ctx, input }) => providerService.create(ctx, input)),
});
```

Procedures:

- `publicProcedure` — no auth, rarely used.
- `authenticatedProcedure` — any signed-in staff.
- `specialistProcedure` — specialist or higher.
- `managerProcedure` — manager or higher.
- `adminProcedure` — admin only.

There is intentionally no `providerProcedure` (for external provider tokens). Providers authenticate their magic-link via the REST API routes (`/api/application/save-section`, `/api/upload`, `/api/attestation`); they do not call tRPC. This keeps the tRPC surface staff-only.

## Service layer

Routers must be thin and call into a service in `src/server/services/`. Services:

- Contain all business logic.
- Wrap multi-step work in `db.$transaction(...)`.
- Call `writeAudit(...)` for every mutation.
- Use typed Prisma and throw `TRPCError` with descriptive codes.

Example:

```ts
// src/server/services/provider.ts
export const providerService = {
  async create(ctx: Ctx, input: CreateProviderInput) {
    return ctx.db.$transaction(async (tx) => {
      const provider = await tx.provider.create({ data: { ... } });
      await sendInvite({ tx, providerId: provider.id });
      await writeAudit(tx, {
        actorId: ctx.session.user.id,
        entity: "Provider",
        entityId: provider.id,
        action: "CREATE",
        after: provider,
      });
      return provider;
    });
  },
};
```

## Input validation

- Use Zod.
- Use `z.nativeEnum(EnumName)` for enums that match Prisma enums; never raw strings.
- Validate at the router boundary; services trust their inputs.
- Keep schemas in `src/server/schemas/<entity>.ts` when reused.

## Error handling

- Prefer `throw new TRPCError({ code: 'NOT_FOUND', message: 'Provider not found' })`.
- Client receives a typed error; UI uses the code to decide behavior.
- Never leak internal error text or stack traces to the client; `pino` captures them server-side.

## Pagination

Cursor-based:

```ts
input: z.object({
  cursor: z.string().optional(),
  take: z.number().int().min(1).max(100).default(25),
})
```

Return `{ items, nextCursor }` — the client cursor is the last row's ID.

## Mutations and audit

Every mutation writes an audit entry. The `writeAudit` helper accepts:

- `actorId` (user ID or system)
- `actorType` (STAFF, PROVIDER, BOT, SYSTEM)
- `entity` and `entityId`
- `action` (CREATE, UPDATE, DELETE, ACCESS, EXPORT, …)
- `before` / `after` (JSON snapshots; redacted automatically)

Audit rows are append-only — DB grants revoke UPDATE/DELETE for the application role. A tamper-evident HMAC chain ties each row to the previous one. See [Audit](../compliance/audit.md).
