/**
 * Root tRPC router — combines all sub-routers.
 */

import { createTRPCRouter } from "@/server/api/trpc";
import { providerRouter } from "@/server/api/routers/provider";
import { documentRouter } from "@/server/api/routers/document";
import { committeeRouter } from "@/server/api/routers/committee";
import { enrollmentRouter } from "@/server/api/routers/enrollment";
import { expirableRouter } from "@/server/api/routers/expirable";
import { sanctionsRouter } from "@/server/api/routers/sanctions";
import { npdbRouter } from "@/server/api/routers/npdb";
import { botRouter } from "@/server/api/routers/bot";
import { adminRouter } from "@/server/api/routers/admin";
import { taskRouter } from "@/server/api/routers/task";
import { communicationRouter } from "@/server/api/routers/communication";
import { medicaidRouter } from "@/server/api/routers/medicaid";

export const appRouter = createTRPCRouter({
  provider: providerRouter,
  document: documentRouter,
  committee: committeeRouter,
  enrollment: enrollmentRouter,
  expirable: expirableRouter,
  sanctions: sanctionsRouter,
  npdb: npdbRouter,
  bot: botRouter,
  admin: adminRouter,
  task: taskRouter,
  communication: communicationRouter,
  medicaid: medicaidRouter,
});

export type AppRouter = typeof appRouter;
