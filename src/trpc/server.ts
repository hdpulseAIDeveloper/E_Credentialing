/**
 * Server-side tRPC caller for use in Next.js Server Components and Route Handlers.
 * Uses createCallerFactory to call procedures directly without HTTP.
 */

import "server-only";
import { headers } from "next/headers";
import { cache } from "react";
import { createCallerFactory, createTRPCContext } from "@/server/api/trpc";
import { appRouter } from "@/server/api/root";

const createCaller = createCallerFactory(appRouter);

const createContext = cache(async () => {
  const heads = new Headers(await headers());
  heads.set("x-trpc-source", "rsc");
  return createTRPCContext({ headers: heads });
});

export const api = createCaller(createContext);
