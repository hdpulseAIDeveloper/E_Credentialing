/**
 * tRPC initialization with context, auth protection, and role-based middleware.
 */

import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import type { UserRole } from "@prisma/client";

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
export const publicProcedure = t.procedure;

/** Protected procedure — requires any authenticated user */
export const protectedProcedure = t.procedure.use(enforceUserIsAuthed);

/** Staff procedure — requires non-provider role */
export const staffProcedure = t.procedure.use(
  enforceUserHasRole(["SPECIALIST", "MANAGER", "COMMITTEE_MEMBER", "ADMIN"])
);

/** Manager procedure — requires MANAGER or ADMIN */
export const managerProcedure = t.procedure.use(
  enforceUserHasRole(["MANAGER", "ADMIN"])
);

/** Admin procedure — requires ADMIN */
export const adminProcedure = t.procedure.use(enforceUserHasRole(["ADMIN"]));

/** Provider procedure — requires PROVIDER role */
export const providerProcedure = t.procedure.use(
  enforceUserHasRole(["PROVIDER"])
);
