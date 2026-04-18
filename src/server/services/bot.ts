/**
 * src/server/services/bot.ts
 *
 * Bot orchestration service. Owns the queue interaction (BullMQ),
 * input-payload assembly from a Provider, and the audit-log writes for
 * bot triggers and verification flag acknowledgements.
 *
 * Wave 2.1: extracted from `src/server/api/routers/bot.ts` so that:
 *   - Cron and BullMQ workers can re-trigger bots via the same code path.
 *   - The router becomes a thin pass-through.
 *   - We can unit-test queue interaction without a live Redis.
 *
 * The queue dependency is injected so tests can pass a fake. In production
 * `botService()` (factory) wires the singleton `psv-bot` Queue.
 */
import type { PrismaClient, BotType } from "@prisma/client";
import type { Queue } from "bullmq";
import { TRPCError } from "@trpc/server";
import type { AuditLogParams } from "@/lib/audit";
import type { ServiceActor, AuditWriter } from "./document";

export const TRIGGERABLE_BOT_TYPES = [
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
  "EDUCATION_ACGME",
] as const;
export type TriggerableBotType = (typeof TRIGGERABLE_BOT_TYPES)[number];

/**
 * Maps tRPC-friendly enum values onto the worker job names registered in
 * `src/workers/index.ts`. If you add a bot type, you MUST update both this
 * map and the worker switch — the typecheck will catch the missing key.
 */
export const BOT_JOB_NAME: Record<TriggerableBotType, string> = {
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
  EDUCATION_ACGME: "education-acgme",
};

const BOT_TYPES_DASHBOARD: BotType[] = [
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

export interface BotServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
  /** PSV BullMQ queue. May be null in tests that exercise db-only paths. */
  queue: Pick<Queue, "add"> | null;
}

export interface ListBotRunsInput {
  providerId: string;
  botType?: string;
  page?: number;
  limit?: number;
}

export interface TriggerBotInput {
  providerId: string;
  botType: TriggerableBotType;
  inputData?: Record<string, unknown>;
}

export class BotService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;
  private readonly queue: Pick<Queue, "add"> | null;

  constructor(deps: BotServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
    this.queue = deps.queue;
  }

  async listByProvider(input: ListBotRunsInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 20;
    const where = {
      providerId: input.providerId,
      ...(input.botType && { botType: input.botType as BotType }),
    };
    const [total, runs] = await Promise.all([
      this.db.botRun.count({ where }),
      this.db.botRun.findMany({
        where,
        include: {
          triggeredByUser: { select: { id: true, displayName: true } },
          verificationRecords: {
            select: { id: true, status: true, isFlagged: true, credentialType: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { queuedAt: "desc" },
      }),
    ]);
    return { runs, total };
  }

  /**
   * Returns the latest run per bot type for a provider. Single round-trip,
   * folded client-side. Backed by the `(provider_id, bot_type, created_at)`
   * index from migration 20260308120000_bot_runs_provider_type_idx.
   */
  async getLatestByProvider(providerId: string) {
    const runs = await this.db.botRun.findMany({
      where: { providerId, botType: { in: BOT_TYPES_DASHBOARD } },
      include: {
        verificationRecords: {
          select: { id: true, status: true, isFlagged: true, verifiedDate: true },
        },
      },
      orderBy: { queuedAt: "desc" },
    });
    const latestByType = new Map<BotType, (typeof runs)[number]>();
    for (const run of runs) {
      if (!latestByType.has(run.botType)) latestByType.set(run.botType, run);
    }
    return BOT_TYPES_DASHBOARD.map((botType) => ({
      botType,
      run: latestByType.get(botType) ?? null,
    }));
  }

  async getById(id: string) {
    const run = await this.db.botRun.findUnique({
      where: { id },
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
  }

  /**
   * Create a BotRun row and enqueue a BullMQ job. If the queue add fails we
   * mark the run FAILED so the dashboard reflects reality, then re-throw a
   * tRPC INTERNAL_SERVER_ERROR. We never leave an orphan QUEUED row that
   * the worker will never pick up.
   */
  async triggerBot(input: TriggerBotInput) {
    const provider = await this.db.provider.findUnique({
      where: { id: input.providerId },
      include: { providerType: true, licenses: { where: { isPrimary: true } } },
    });
    if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

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

    const botRun = await this.db.botRun.create({
      data: {
        providerId: input.providerId,
        botType: input.botType as BotType,
        triggeredBy: "MANUAL",
        triggeredByUserId: this.actor.id,
        status: "QUEUED",
        attemptCount: 0,
        inputData: { ...defaultInputData, ...(input.inputData ?? {}) },
      },
    });

    if (this.queue) {
      try {
        const jobName = BOT_JOB_NAME[input.botType];
        await this.queue.add(
          jobName,
          { botRunId: botRun.id, providerId: input.providerId },
          {
            priority: 1,
            attempts: 3,
            backoff: { type: "exponential", delay: 5000 },
          },
        );
      } catch (error) {
        console.error("[BotService] Failed to enqueue bot job:", error);
        await this.db.botRun.update({
          where: { id: botRun.id },
          data: {
            status: "FAILED",
            errorMessage: error instanceof Error ? error.message : String(error),
            completedAt: new Date(),
          },
        });
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to enqueue bot job",
        });
      }
    }

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "bot.triggered",
      entityType: "BotRun",
      entityId: botRun.id,
      providerId: input.providerId,
      afterState: { botType: input.botType, triggeredBy: "MANUAL" },
    });
    return botRun;
  }

  /** Manager-only acknowledgement of a flagged verification record. */
  async acknowledgeFlag(verificationRecordId: string) {
    const record = await this.db.verificationRecord.findUnique({
      where: { id: verificationRecordId },
    });
    if (!record) throw new TRPCError({ code: "NOT_FOUND" });

    const updated = await this.db.verificationRecord.update({
      where: { id: verificationRecordId },
      data: {
        acknowledgedById: this.actor.id,
        acknowledgedAt: new Date(),
      },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "bot.flag.acknowledged",
      entityType: "VerificationRecord",
      entityId: verificationRecordId,
      providerId: record.providerId,
    } satisfies AuditLogParams);
    return updated;
  }
}
