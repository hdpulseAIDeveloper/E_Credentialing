/**
 * Playwright globalSetup — logs in once as each staff role using the
 * production Credentials provider, then writes the resulting cookies to
 * `tests/e2e/.auth/<role>.json`. Each spec then opts into a role by
 * re-using the storageState, which is several orders of magnitude faster
 * than logging in per-test and matches the production cookie shape exactly
 * (so any auth bug surfaces immediately).
 *
 * Anti-weakening note (per STANDARD.md §4.2): if login fails for any role
 * this file MUST throw. Do NOT swallow the error to "let the suite run" —
 * the suite is meaningless without authenticated state.
 */

import { request, type APIRequestContext, type FullConfig } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { STAFF_ROLES, STATE_DIR, getRole, storageStateFor } from "./roles";

/**
 * Authenticate against NextAuth's Credentials provider directly via its
 * REST surface (CSRF + callback). This avoids any dependency on React
 * having finished hydrating the signin form, which made the UI-driven flow
 * brittle in dev mode.
 *
 * NextAuth v5 with `session.strategy = "jwt"` returns the session JWT in
 * the `authjs.session-token` cookie (or `__Secure-` prefix in prod). We
 * grab the cookie jar and persist it as Playwright storageState.
 */
async function loginStaffRole(
  baseURL: string,
  role: ReturnType<typeof getRole>,
): Promise<void> {
  if (!role.email || !role.password) {
    throw new Error(`Role ${role.id} has no Credentials login wired`);
  }

  const ctx: APIRequestContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: { "x-test-globalsetup": role.id },
  });

  // 1. Fetch CSRF token and pick up the csrf cookie (NextAuth ties the two
  //    together — both must be sent on the callback request).
  const csrfRes = await ctx.get("/api/auth/csrf");
  if (!csrfRes.ok()) {
    throw new Error(
      `globalSetup ${role.id}: /api/auth/csrf -> ${csrfRes.status()}`,
    );
  }
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string };
  if (!csrfToken) {
    throw new Error(`globalSetup ${role.id}: empty csrfToken`);
  }

  // 2. POST credentials to the credentials callback. NextAuth expects
  //    application/x-www-form-urlencoded with csrfToken + email + password.
  //    We must follow the redirect chain so it sets the session cookie.
  const callback = await ctx.post("/api/auth/callback/credentials", {
    form: {
      csrfToken,
      email: role.email,
      password: role.password,
      callbackUrl: `${baseURL}/dashboard`,
      json: "true",
    },
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    maxRedirects: 5,
  });

  // NextAuth v5 returns 200 with { url } on success or 200/4xx with an
  // error redirect. We confirm by hitting /api/auth/session below.
  if (!callback.ok()) {
    throw new Error(
      `globalSetup ${role.id}: callback returned ${callback.status()}`,
    );
  }

  // 3. Verify session.
  const sessionRes = await ctx.get("/api/auth/session");
  if (!sessionRes.ok()) {
    throw new Error(
      `globalSetup ${role.id}: /api/auth/session -> ${sessionRes.status()}`,
    );
  }
  const session = (await sessionRes.json()) as {
    user?: { role?: string; email?: string };
  };
  if (!session?.user?.role) {
    throw new Error(
      `globalSetup ${role.id}: session has no user.role (got ${JSON.stringify(session)})`,
    );
  }
  if (session.user.role !== role.prismaRole) {
    throw new Error(
      `globalSetup ${role.id}: expected role ${role.prismaRole}, got ${session.user.role}`,
    );
  }

  // 4. Persist storageState (cookies + origin storage). This format is
  //    consumed by Playwright's `use.storageState`.
  await ctx.storageState({ path: storageStateFor(role.id) });
  await ctx.dispose();

  // eslint-disable-next-line no-console
  console.log(
    `globalSetup: authenticated ${role.id} (${session.user.email ?? "?"}) -> ${storageStateFor(role.id)}`,
  );
}

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL =
    config.projects[0]?.use?.baseURL ?? "http://localhost:6015";

  await mkdir(STATE_DIR, { recursive: true });

  // Pre-flight: dev server must be reachable. If it's not, fail fast with a
  // clear message rather than letting Playwright stall on the first goto().
  const ctx = await request.newContext();
  try {
    const ping = await ctx.get(`${baseURL}/api/health`, {
      timeout: 5_000,
    });
    if (!ping.ok()) {
      throw new Error(
        `dev server health check returned ${ping.status()} from ${baseURL}/api/health`,
      );
    }
  } catch (err) {
    throw new Error(
      `globalSetup: dev server not reachable at ${baseURL} — ${(err as Error).message}`,
    );
  } finally {
    await ctx.dispose();
  }

  // Login each staff role serially. Parallel login causes contention against
  // the JWT signing key and produces inconsistent storageState in dev.
  for (const id of STAFF_ROLES) {
    const role = getRole(id);
    await loginStaffRole(baseURL, role);
  }

  // Warm-up: hit every static page route once with the admin storageState so
  // Next.js dev mode compiles them now, not in the middle of pillar A. This
  // is NOT a §4.2 weakening — without it the dev server hits compile-storms
  // under multi-worker load and reports timeouts that have nothing to do
  // with app correctness. Production builds skip this entirely.
  if (process.env.E2E_SKIP_WARMUP !== "1") {
    // eslint-disable-next-line no-console
    console.log("globalSetup: warming dev-server route compile cache…");
    const invPath = path.join(
      process.cwd(),
      "docs",
      "qa",
      "inventories",
      "route-inventory.json",
    );
    const inv = JSON.parse(
      await (await import("node:fs/promises")).readFile(invPath, "utf8"),
    ) as { route: string; dynamic: boolean }[];
    const adminCtx = await request.newContext({
      baseURL,
      storageState: storageStateFor("admin"),
    });
    try {
      const staticRoutes = inv
        .filter((r) => !r.dynamic && !r.route.startsWith("/application"))
        .map((r) => r.route);
      const t0 = Date.now();
      for (const route of staticRoutes) {
        try {
          await adminCtx.get(route, { timeout: 60_000 });
        } catch {
          // Warm-up failures are non-fatal — the actual smoke spec captures
          // them deterministically.
        }
      }
      // eslint-disable-next-line no-console
      console.log(
        `globalSetup: warmed ${staticRoutes.length} routes in ${Math.round((Date.now() - t0) / 1000)}s`,
      );
    } finally {
      await adminCtx.dispose();
    }
  }

  // Provider role uses token-auth — emit an empty storageState so per-role
  // projects don't fail on a missing file. Provider specs use a dedicated
  // fixture that mints a magic-link token at runtime.
  const provider = getRole("provider");
  await writeFile(
    storageStateFor(provider.id),
    JSON.stringify({ cookies: [], origins: [] }, null, 2),
    "utf8",
  );
  // eslint-disable-next-line no-console
  console.log(
    `globalSetup: wrote empty storageState for ${provider.id} (token-auth handled per-spec)`,
  );

  // Touch a marker file so we know setup ran (and when). Useful when CI
  // bisects a flake — "did setup actually run for this commit?".
  await writeFile(
    path.join(STATE_DIR, "_globalSetup.json"),
    JSON.stringify(
      { ranAt: new Date().toISOString(), baseURL },
      null,
      2,
    ),
    "utf8",
  );
}
