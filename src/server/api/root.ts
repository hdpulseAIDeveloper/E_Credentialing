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
import { recredentialingRouter } from "@/server/api/routers/recredentialing";
import { reportRouter } from "@/server/api/routers/report";
import { workHistoryRouter } from "@/server/api/routers/workHistory";
import { referenceRouter } from "@/server/api/routers/reference";
import { rosterRouter } from "@/server/api/routers/roster";
import { evaluationRouter } from "@/server/api/routers/evaluation";
import { privilegingRouter } from "@/server/api/routers/privileging";
import { cmeRouter } from "@/server/api/routers/cme";
import { apiKeyRouter } from "@/server/api/routers/apiKey";
import { trainingRouter } from "@/server/api/routers/training";

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
  recredentialing: recredentialingRouter,
  report: reportRouter,
  workHistory: workHistoryRouter,
  reference: referenceRouter,
  roster: rosterRouter,
  evaluation: evaluationRouter,
  privileging: privilegingRouter,
  cme: cmeRouter,
  apiKey: apiKeyRouter,
  training: trainingRouter,
});

export type AppRouter = typeof appRouter;
