/**
 * tRPC initialization with context, auth protection, and role-based middleware.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import type { UserRole } from "@prisma/client";
import {
  captureException,
  recordCounter,
  recordHistogram,
} from "@/lib/telemetry";

// ─── Context ──────────────────────────────────────────────────────────────────

export const createTRPCContext = async (opts: { headers: Headers }) => {
  const session = await auth();

  return {
    db,
    session,
    headers: opts.headers,
  };
};

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;

// ─── tRPC Init ────────────────────────────────────────────────────────────────

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter = t.router;

// ─── Telemetry middleware (Wave 4.1) ─────────────────────────────────────────
// Counts every procedure invocation and forwards exceptions to Sentry/AI.
// Labels are kept low-cardinality (path + result) so the Prometheus
// series count stays bounded.
const telemetryMiddleware = t.middleware(async ({ path, type, next }) => {
  const start = Date.now();
  try {
    const result = await next();
    const labels = { path, type, result: result.ok ? "ok" : "error" };
    recordCounter("ecred_trpc_calls_total", 1, labels);
    recordHistogram("ecred_trpc_duration_ms", Date.now() - start, labels);
    return result;
  } catch (err) {
    recordCounter("ecred_trpc_calls_total", 1, {
      path,
      type,
      result: "throw",
    });
    recordHistogram("ecred_trpc_duration_ms", Date.now() - start, {
      path,
      type,
      result: "throw",
    });
    captureException(err, { trpcPath: path, trpcType: type });
    throw err;
  }
});

// ─── Middleware ───────────────────────────────────────────────────────────────

/** Middleware: require authenticated session */
const enforceUserIsAuthed = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: {
      ...ctx,
      session: { ...ctx.session, user: ctx.session.user },
    },
  });
});

/** Middleware: require specific roles */
const enforceUserHasRole = (roles: UserRole[]) =>
  t.middleware(({ ctx, next }) => {
    if (!ctx.session?.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    if (!roles.includes(ctx.session.user.role as UserRole)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires one of these roles: ${roles.join(", ")}`,
      });
    }
    return next({
      ctx: {
        ...ctx,
        session: { ...ctx.session, user: ctx.session.user },
      },
    });
  });

// ─── Procedure Builders ───────────────────────────────────────────────────────

/** Public procedure — no auth required */
export const publicProcedure = t.procedure.use(telemetryMiddleware);

/** Protected procedure — requires any authenticated user */
export const protectedProcedure = t.procedure
  .use(telemetryMiddleware)
  .use(enforceUserIsAuthed);

/** Staff procedure — requires non-provider role */
export const staffProcedure = t.procedure
  .use(telemetryMiddleware)
  .use(enforceUserHasRole(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"]));

/** Manager procedure — requires MANAGER or ADMIN */
export const managerProcedure = t.procedure
  .use(telemetryMiddleware)
  .use(enforceUserHasRole(["MANAGER", "ADMIN"]));

/** Admin procedure — requires ADMIN */
export const adminProcedure = t.procedure
  .use(telemetryMiddleware)
  .use(enforceUserHasRole(["ADMIN"]));

// NOTE: There is intentionally no providerProcedure. Providers authenticate via
// magic-link invite tokens (see src/lib/auth/provider-token.ts), not session
// cookies. Provider-scoped REST routes verify the token and authorize
// provider.id explicitly. A session-based providerProcedure would silently
// fail-open because no session flow creates a PROVIDER-role session.
