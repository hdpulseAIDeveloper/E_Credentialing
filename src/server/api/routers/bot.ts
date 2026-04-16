/**
 * Bot router — trigger bot, list runs, get status, acknowledge flagged results.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";
import { Queue } from "bullmq";
import { createRedisConnection } from "@/lib/redis";
import type { BotType } from "@prisma/client";

let _psvQueue: Queue | null = null;
function getPsvQueue(): Queue {
  if (!_psvQueue) {
    _psvQueue = new Queue("psv-bot", { connection: createRedisConnection() });
  }
  return _psvQueue;
}

// Bot types that are user-triggerable from the UI. Each must have a matching
// case in src/workers/index.ts. EXPIRABLE_RENEWAL and ENROLLMENT_SUBMISSION are
// system-triggered through dedicated workflows, not exposed here.
const TRIGGERABLE_BOT_TYPES = [
  "LICENSE_VERIFICATION",
  "DEA_VERIFICATION",
  "BOARD_NCCPA",
  "BOARD_ABIM",
  "BOARD_ABFM",
  "OIG_SANCTIONS",
  "SAM_SANCTIONS",
  "NPDB",
  "EMEDRAL_ETIN",
  "EDUCATION_AMA",
  "EDUCATION_ECFMG",
] as const;
type TriggerableBotType = (typeof TRIGGERABLE_BOT_TYPES)[number];

const BOT_TYPE_MAP: Record<TriggerableBotType, string> = {
  LICENSE_VERIFICATION: "license-verification",
  DEA_VERIFICATION: "dea-verification",
  BOARD_NCCPA: "board-nccpa",
  BOARD_ABIM: "board-abim",
  BOARD_ABFM: "board-abfm",
  OIG_SANCTIONS: "oig-sanctions",
  SAM_SANCTIONS: "sam-sanctions",
  NPDB: "npdb-query",
  EMEDRAL_ETIN: "emedral-enrollment",
  EDUCATION_AMA: "education-ama",
  EDUCATION_ECFMG: "education-ecfmg",
};

export const botRouter = createTRPCRouter({
  // ─── List bot runs for a provider ─────────────────────────────────────
  listByProvider: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        botType: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(50).default(20),
      })
    )
    .query(async ({ ctx, input }) => {
      const where = {
        providerId: input.providerId,
        ...(input.botType && { botType: input.botType as BotType }),
      };

      const [total, runs] = await Promise.all([
        ctx.db.botRun.count({ where }),
        ctx.db.botRun.findMany({
          where,
          include: {
            triggeredByUser: { select: { id: true, displayName: true } },
            verificationRecords: {
              select: { id: true, status: true, isFlagged: true, credentialType: true },
            },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { queuedAt: "desc" },
        }),
      ]);

      return { runs, total };
    }),

  // ─── Get latest bot run per type for a provider ───────────────────────
  getLatestByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      // Get latest run per bot type
      const botTypes: BotType[] = [
        "LICENSE_VERIFICATION",
        "DEA_VERIFICATION",
        "BOARD_NCCPA",
        "BOARD_ABIM",
        "BOARD_ABFM",
        "OIG_SANCTIONS",
        "SAM_SANCTIONS",
        "NPDB",
        "EMEDRAL_ETIN",
      ];

      const results = await Promise.all(
        botTypes.map(async (botType) => {
          const run = await ctx.db.botRun.findFirst({
            where: { providerId: input.providerId, botType },
            include: {
              verificationRecords: {
                select: { id: true, status: true, isFlagged: true, verifiedDate: true },
              },
            },
            orderBy: { queuedAt: "desc" },
          });
          return { botType, run };
        })
      );

      return results;
    }),

  // ─── Get single bot run ────────────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const run = await ctx.db.botRun.findUnique({
        where: { id: input.id },
        include: {
          triggeredByUser: { select: { id: true, displayName: true } },
          verificationRecords: {
            include: { acknowledgedBy: { select: { id: true, displayName: true } } },
          },
          sanctionsChecks: true,
          npdbRecords: true,
        },
      });

      if (!run) throw new TRPCError({ code: "NOT_FOUND" });
      return run;
    }),

  // ─── Trigger a bot ────────────────────────────────────────────────────
  triggerBot: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        botType: z.enum(TRIGGERABLE_BOT_TYPES),
        inputData: z.record(z.unknown()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
        include: { providerType: true, licenses: { where: { isPrimary: true } } },
      });

      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      // Build input data
      const defaultInputData = {
        npi: provider.npi,
        firstName: provider.legalFirstName,
        lastName: provider.legalLastName,
        providerType: provider.providerType.abbreviation,
        primaryLicense: provider.licenses[0]
          ? {
              state: provider.licenses[0].state,
              licenseNumber: provider.licenses[0].licenseNumber,
            }
          : null,
      };

      const botRun = await ctx.db.botRun.create({
        data: {
          providerId: input.providerId,
          botType: input.botType as BotType,
          triggeredBy: "MANUAL",
          triggeredByUserId: ctx.session!.user.id,
          status: "QUEUED",
          attemptCount: 0,
          inputData: { ...defaultInputData, ...(input.inputData ?? {}) },
        },
      });

      try {
        const queue = getPsvQueue();
        const jobName = BOT_TYPE_MAP[input.botType];
        await queue.add(jobName, { botRunId: botRun.id, providerId: input.providerId }, {
          priority: 1,
          attempts: 3,
          backoff: { type: "exponential", delay: 5000 },
        });
      } catch (error) {
        console.error("[Bot] Failed to enqueue bot job:", error);
        await ctx.db.botRun.update({
          where: { id: botRun.id },
          data: { status: "FAILED", errorMessage: error instanceof Error ? error.message : String(error), completedAt: new Date() },
        });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Failed to enqueue bot job" });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "bot.triggered",
        entityType: "BotRun",
        entityId: botRun.id,
        providerId: input.providerId,
        afterState: { botType: input.botType, triggeredBy: "MANUAL" },
      });

      return botRun;
    }),

  // ─── Acknowledge flagged verification result ──────────────────────────
  acknowledgeFlag: managerProcedure
    .input(z.object({ verificationRecordId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const record = await ctx.db.verificationRecord.findUnique({
        where: { id: input.verificationRecordId },
      });

      if (!record) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.verificationRecord.update({
        where: { id: input.verificationRecordId },
        data: {
          acknowledgedById: ctx.session!.user.id,
          acknowledgedAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "bot.flag.acknowledged",
        entityType: "VerificationRecord",
        entityId: input.verificationRecordId,
        providerId: record.providerId,
      });

      return updated;
    }),
});
