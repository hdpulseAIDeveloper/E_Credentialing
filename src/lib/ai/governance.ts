/**
 * P2 Gap #19 — AI governance logging helpers.
 *
 * Every AI feature in the platform should call `logAiDecision` immediately
 * after producing an output, so the AiDecisionLog tells a faithful story
 * of which model produced which suggestion, with what confidence, on what
 * provider, and how a human ultimately resolved it. This keeps us on the
 * right side of NCQA / ONC HTI-1 / CMS AI accountability expectations.
 */

import type { AiHumanDecision, PrismaClient } from "@prisma/client";

export interface LogAiDecisionInput {
  feature: string; // dotted feature key, e.g. "document.classify"
  modelName?: string; // resolved against AiModelCard.name when present
  providerId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  promptSummary?: string | null;
  responseSummary?: string | null;
  suggestedAction?: string | null;
  rationale?: string | null;
  citations?: unknown[];
  confidenceScore?: number | null;
  containsPhi?: boolean;
  promptTokens?: number | null;
  completionTokens?: number | null;
  latencyMs?: number | null;
  /** If the action was applied automatically (no human gate), pass ACCEPTED. */
  initialDecision?: AiHumanDecision;
  initialDecisionById?: string | null;
}

const SUMMARY_MAX = 4000;

function truncate(value: string | null | undefined): string | null {
  if (!value) return null;
  if (value.length <= SUMMARY_MAX) return value;
  return `${value.slice(0, SUMMARY_MAX - 3)}...`;
}

/**
 * Persist a single AI decision with safe summary truncation.
 * Never throws — logging failures must not break the calling feature.
 */
export async function logAiDecision(
  db: PrismaClient,
  input: LogAiDecisionInput
): Promise<string | null> {
  try {
    let modelCardId: string | null = null;
    if (input.modelName) {
      const card = await db.aiModelCard.findUnique({
        where: { name: input.modelName },
        select: { id: true },
      });
      modelCardId = card?.id ?? null;
    }

    const log = await db.aiDecisionLog.create({
      data: {
        modelCardId,
        feature: input.feature,
        providerId: input.providerId ?? null,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        promptSummary: truncate(input.promptSummary ?? null),
        responseSummary: truncate(input.responseSummary ?? null),
        suggestedAction: truncate(input.suggestedAction ?? null),
        rationale: truncate(input.rationale ?? null),
        citations: (input.citations ?? []) as unknown as object,
        confidenceScore: input.confidenceScore ?? null,
        containsPhi: input.containsPhi ?? false,
        promptTokens: input.promptTokens ?? null,
        completionTokens: input.completionTokens ?? null,
        latencyMs: input.latencyMs ?? null,
        humanDecision: input.initialDecision ?? "PENDING",
        humanDecisionById: input.initialDecisionById ?? null,
        humanDecisionAt: input.initialDecision && input.initialDecision !== "PENDING"
          ? new Date()
          : null,
      },
      select: { id: true },
    });
    return log.id;
  } catch (error) {
    console.error("[AiGovernance] failed to log AI decision:", error);
    return null;
  }
}

export async function recordHumanDecision(
  db: PrismaClient,
  logId: string,
  decision: AiHumanDecision,
  byUserId: string,
  note?: string | null
): Promise<void> {
  await db.aiDecisionLog.update({
    where: { id: logId },
    data: {
      humanDecision: decision,
      humanDecisionById: byUserId,
      humanDecisionAt: new Date(),
      humanNote: note ?? null,
    },
  });
}

export interface GovernanceSummary {
  totalLogs: number;
  pending: number;
  accepted: number;
  rejected: number;
  modelsActive: number;
  modelsRequiringContractReview: number;
  vendorsWithoutNoTrainingClause: number;
}

export async function getGovernanceSummary(
  db: PrismaClient
): Promise<GovernanceSummary> {
  const now = new Date();
  const [
    totalLogs,
    pending,
    accepted,
    rejected,
    modelsActive,
    modelsRequiringContractReview,
    vendorsWithoutNoTrainingClause,
  ] = await Promise.all([
    db.aiDecisionLog.count(),
    db.aiDecisionLog.count({ where: { humanDecision: "PENDING" } }),
    db.aiDecisionLog.count({ where: { humanDecision: "ACCEPTED" } }),
    db.aiDecisionLog.count({ where: { humanDecision: "REJECTED" } }),
    db.aiModelCard.count({ where: { status: "ACTIVE" } }),
    db.aiModelCard.count({
      where: {
        status: { in: ["ACTIVE", "PILOT"] },
        OR: [
          { contractReviewDueDate: { lt: now } },
          { contractReviewDueDate: null },
        ],
      },
    }),
    db.aiModelCard.count({
      where: {
        status: { in: ["ACTIVE", "PILOT"] },
        noTrainingOnCustomerData: false,
      },
    }),
  ]);
  return {
    totalLogs,
    pending,
    accepted,
    rejected,
    modelsActive,
    modelsRequiringContractReview,
    vendorsWithoutNoTrainingClause,
  };
}
