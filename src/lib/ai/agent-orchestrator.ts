/**
 * P3 Gap #20 — Autonomous AI agent orchestrator on top of Playwright bots.
 *
 * Triages a finished bot run and produces a recommended next action with a
 * confidence score and a rationale. The orchestrator runs in two modes:
 *
 *  1. RULES (always available) — deterministic heuristics over the bot run's
 *     status, error message, and result payload. This is the safety floor:
 *     if Azure OpenAI is unavailable we still produce a sensible verdict.
 *
 *  2. LLM (Azure OpenAI) — when configured, the same evidence is sent to
 *     GPT-4o with a constrained JSON schema. The LLM's verdict overrides
 *     the rule-based one when its confidence is higher AND its action is
 *     in the allowed set.
 *
 * Every verdict is persisted to BotExceptionVerdict and mirrored to
 * AiDecisionLog so the AI Governance dashboard sees it.
 *
 * Safety guardrails:
 *   • The orchestrator NEVER auto-executes adverse credentialing decisions.
 *   • Only RETRY_NOW with high confidence is auto-executed; everything else
 *     waits for human acceptance.
 *   • PHI is excluded from the LLM prompt — only structured run metadata
 *     and the bot's own error message are sent.
 */

import type {
  BotExceptionAction,
  BotRun,
  BotStatus,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { logAiDecision } from "./governance";
import { chatCompletion, isChatConfigured } from "./chat-client";

const ORCHESTRATOR_MODEL_NAME =
  "Bot Exception Orchestrator (Azure OpenAI GPT-4o)";

export interface OrchestratorVerdict {
  recommendedAction: BotExceptionAction;
  rationale: string;
  confidence: number;
  source: "rules" | "llm";
  modelUsed?: string;
  evidence: Record<string, unknown>;
}

export interface OrchestratorInput {
  botRun: Pick<
    BotRun,
    | "id"
    | "providerId"
    | "botType"
    | "status"
    | "attemptCount"
    | "errorMessage"
    | "outputData"
    | "inputData"
    | "startedAt"
    | "completedAt"
  >;
  triggerReason: string; // "FAILED" | "REQUIRES_MANUAL" | "FLAGGED"
}

const TRANSIENT_PATTERNS: RegExp[] = [
  /\bECONN(REFUSED|RESET)\b/i,
  /\bETIMEDOUT\b/i,
  /\bEAI_AGAIN\b/i,
  /timeout/i,
  /5\d\d\b/, // 5xx HTTP status
  /service unavailable/i,
  /gateway timeout/i,
  /network/i,
];

const SITE_CHANGE_PATTERNS: RegExp[] = [
  /selector/i,
  /element not found/i,
  /no element matches/i,
  /unable to locate/i,
  /page navigation/i,
  /unexpected layout/i,
];

const BLOCKED_PATTERNS: RegExp[] = [
  /captcha/i,
  /access denied/i,
  /forbidden/i,
  /blocked/i,
  /rate ?limit/i,
  /\b403\b/,
  /\b429\b/,
];

const CREDENTIAL_PATTERNS: RegExp[] = [
  /invalid (login|credentials|password)/i,
  /authentication failed/i,
  /unauthorized/i,
  /\b401\b/,
  /expired session/i,
  /mfa/i,
  /otp/i,
];

const MISSING_DATA_PATTERNS: RegExp[] = [
  /missing/i,
  /not provided/i,
  /no .* on file/i,
  /not present/i,
  /required/i,
  /undefined/i,
];

function matchesAny(message: string, patterns: RegExp[]): boolean {
  return patterns.some((p) => p.test(message));
}

/**
 * Deterministic rule-based verdict — always available.
 */
export function ruleBasedVerdict(input: OrchestratorInput): OrchestratorVerdict {
  const { botRun, triggerReason } = input;
  const message = botRun.errorMessage ?? "";
  const attempts = botRun.attemptCount ?? 0;

  // Flagged result: don't retry, escalate so humans can verify.
  if (triggerReason === "FLAGGED") {
    return {
      recommendedAction: "RAISE_ALERT",
      rationale:
        "Bot returned a flagged verification — preserve as-is and surface " +
        "to staff for human verification before any downstream action.",
      confidence: 0.85,
      source: "rules",
      evidence: { triggerReason, attempts },
    };
  }

  if (triggerReason === "REQUIRES_MANUAL") {
    return {
      recommendedAction: "ESCALATE_TO_STAFF",
      rationale:
        "Bot self-classified as requiring manual handling — likely a stub " +
        "implementation or an unhandled edge case. Route to staff queue.",
      confidence: 0.9,
      source: "rules",
      evidence: { triggerReason, attempts },
    };
  }

  if (matchesAny(message, BLOCKED_PATTERNS)) {
    return {
      recommendedAction: "RETRY_LATER",
      rationale:
        "Source site is rate-limiting or challenging us with a captcha — " +
        "back off and retry from a different IP / time window.",
      confidence: 0.8,
      source: "rules",
      evidence: { triggerReason, attempts, signal: "blocked" },
    };
  }

  if (matchesAny(message, CREDENTIAL_PATTERNS)) {
    return {
      recommendedAction: "ESCALATE_TO_STAFF",
      rationale:
        "Authentication against the source system failed — credentials, " +
        "MFA secret, or session token may need rotation. Staff intervention " +
        "is required before further attempts.",
      confidence: 0.9,
      source: "rules",
      evidence: { triggerReason, attempts, signal: "credentials" },
    };
  }

  if (matchesAny(message, SITE_CHANGE_PATTERNS)) {
    return {
      recommendedAction: "MARK_REQUIRES_MANUAL",
      rationale:
        "Selectors/page structure don't match — the source site likely " +
        "changed. Mark as REQUIRES_MANUAL so verification can be completed " +
        "by hand while the bot is updated.",
      confidence: 0.85,
      source: "rules",
      evidence: { triggerReason, attempts, signal: "site_change" },
    };
  }

  if (matchesAny(message, MISSING_DATA_PATTERNS)) {
    return {
      recommendedAction: "ESCALATE_TO_STAFF",
      rationale:
        "Bot input appears to be missing a required field for this " +
        "credential type. Staff must collect the data before re-running.",
      confidence: 0.75,
      source: "rules",
      evidence: { triggerReason, attempts, signal: "missing_data" },
    };
  }

  if (matchesAny(message, TRANSIENT_PATTERNS)) {
    if (attempts < 3) {
      return {
        recommendedAction: "RETRY_NOW",
        rationale:
          "Error matches a known transient pattern (network/timeout/5xx) " +
          `and we have only attempted ${attempts} time(s). Safe to retry.`,
        confidence: 0.9,
        source: "rules",
        evidence: { triggerReason, attempts, signal: "transient" },
      };
    }
    return {
      recommendedAction: "RETRY_LATER",
      rationale:
        `Transient error has now repeated ${attempts} time(s); back off ` +
        "and retry on a longer schedule rather than burning more attempts.",
      confidence: 0.8,
      source: "rules",
      evidence: { triggerReason, attempts, signal: "transient_persistent" },
    };
  }

  // Default: unknown failure — escalate.
  return {
    recommendedAction: "ESCALATE_TO_STAFF",
    rationale:
      "No known failure pattern matched — escalate to staff for manual " +
      "investigation and capture the new pattern in the orchestrator.",
    confidence: 0.5,
    source: "rules",
    evidence: { triggerReason, attempts, signal: "unknown" },
  };
}

const ALLOWED_ACTIONS: BotExceptionAction[] = [
  "RETRY_NOW",
  "RETRY_LATER",
  "ESCALATE_TO_STAFF",
  "MARK_REQUIRES_MANUAL",
  "RAISE_ALERT",
  "DEFER_NO_ACTION",
];

const SYSTEM_PROMPT = `You are an autonomous credentialing bot triage agent for a hospital
credentialing platform. A Playwright PSV bot has finished its run with an
exceptional outcome (FAILED, REQUIRES_MANUAL, or returned a flagged
verification). Your job is to recommend ONE next action.

Allowed actions (choose exactly one):
  - RETRY_NOW             — transient failure, retry immediately
  - RETRY_LATER           — back off (rate limit, captcha, infra blip)
  - ESCALATE_TO_STAFF     — needs human; data/credentials issue
  - MARK_REQUIRES_MANUAL  — site changed or unsupported edge case
  - RAISE_ALERT           — looks like a real adverse finding
  - DEFER_NO_ACTION       — no action required (rare)

Output ONLY a JSON object with this exact shape:
{
  "recommendedAction": <one of the actions above>,
  "rationale": <1-3 sentences, no PII>,
  "confidence": <number between 0 and 1>
}

Rules:
  - Never recommend an action that auto-makes a credentialing decision.
  - Prefer ESCALATE_TO_STAFF when uncertain.
  - Don't include any fields beyond the three above.
  - Use only the structured evidence given; do not fabricate facts.`;

interface LlmJson {
  recommendedAction?: string;
  rationale?: string;
  confidence?: number;
}

function parseLlmReply(content: string): LlmJson | null {
  try {
    const trimmed = content.trim();
    const json = trimmed.startsWith("{")
      ? trimmed
      : trimmed.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;
    return JSON.parse(json) as LlmJson;
  } catch {
    return null;
  }
}

async function llmVerdict(
  input: OrchestratorInput
): Promise<OrchestratorVerdict | null> {
  if (!isChatConfigured()) return null;
  const { botRun, triggerReason } = input;

  const userPrompt = JSON.stringify({
    triggerReason,
    botType: botRun.botType,
    status: botRun.status,
    attemptCount: botRun.attemptCount,
    errorMessage: botRun.errorMessage ?? null,
    durationMs:
      botRun.startedAt && botRun.completedAt
        ? botRun.completedAt.getTime() - botRun.startedAt.getTime()
        : null,
  });

  const reply = await chatCompletion(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.1, maxTokens: 250 }
  );
  if (!reply?.content) return null;

  const parsed = parseLlmReply(reply.content);
  if (!parsed) return null;

  const action = parsed.recommendedAction as BotExceptionAction | undefined;
  if (!action || !ALLOWED_ACTIONS.includes(action)) return null;

  const confidence = typeof parsed.confidence === "number"
    ? Math.min(1, Math.max(0, parsed.confidence))
    : 0.6;

  return {
    recommendedAction: action,
    rationale: parsed.rationale?.trim() || "(no rationale provided)",
    confidence,
    source: "llm",
    modelUsed: reply.modelDeployment,
    evidence: {
      triggerReason,
      attempts: botRun.attemptCount,
      promptTokens: reply.promptTokens,
      completionTokens: reply.completionTokens,
      latencyMs: reply.latencyMs,
    },
  };
}

/**
 * Produce + persist a verdict for a finished bot run.
 *
 * Returns null if the BotRun does not warrant orchestrator review (e.g.
 * the run is QUEUED or successfully COMPLETED with no flag).
 */
export async function orchestrateBotException(
  db: PrismaClient,
  botRunId: string
): Promise<{ id: string; verdict: OrchestratorVerdict } | null> {
  const botRun = await db.botRun.findUnique({
    where: { id: botRunId },
    select: {
      id: true,
      providerId: true,
      botType: true,
      status: true,
      attemptCount: true,
      errorMessage: true,
      outputData: true,
      inputData: true,
      startedAt: true,
      completedAt: true,
    },
  });
  if (!botRun) return null;

  const triggerReason = resolveTriggerReason(botRun.status, botRun.outputData);
  if (!triggerReason) return null;

  // Skip if a recent verdict for this same run already exists.
  const existing = await db.botExceptionVerdict.findFirst({
    where: { botRunId },
    orderBy: { createdAt: "desc" },
  });
  if (existing && existing.status !== "RESOLVED") {
    return { id: existing.id, verdict: { ...existing, source: existing.source as "rules" | "llm", evidence: existing.evidence as Record<string, unknown>, modelUsed: existing.modelUsed ?? undefined } };
  }

  const input: OrchestratorInput = { botRun, triggerReason };

  // Run both rule-based + (optional) LLM verdicts and pick the higher
  // confidence one. Rules are the safety floor.
  const rules = ruleBasedVerdict(input);
  const llm = await llmVerdict(input).catch((err) => {
    console.error("[BotOrchestrator] LLM verdict failed:", err);
    return null;
  });

  const chosen = llm && llm.confidence > rules.confidence ? llm : rules;

  // Auto-execution: ONLY simple retries with very high confidence (>=0.85)
  // execute without a human gate. Everything else stays PENDING_REVIEW.
  const autoExecute =
    chosen.recommendedAction === "RETRY_NOW" && chosen.confidence >= 0.85;

  const aiLogId = await logAiDecision(db, {
    feature: "bot.exception.orchestrator",
    modelName: chosen.source === "llm" ? ORCHESTRATOR_MODEL_NAME : undefined,
    providerId: botRun.providerId,
    entityType: "BotRun",
    entityId: botRun.id,
    promptSummary: `Triage bot run ${botRun.botType} attempt ${botRun.attemptCount}`,
    responseSummary: chosen.rationale,
    suggestedAction: chosen.recommendedAction,
    rationale: chosen.rationale,
    citations: [],
    confidenceScore: chosen.confidence,
    initialDecision: autoExecute ? "ACCEPTED" : "PENDING",
    containsPhi: false,
  });

  const created = await db.botExceptionVerdict.create({
    data: {
      botRunId,
      providerId: botRun.providerId,
      triggerReason,
      recommendedAction: chosen.recommendedAction,
      rationale: chosen.rationale,
      confidence: chosen.confidence,
      evidence: chosen.evidence as Prisma.InputJsonValue,
      source: chosen.source,
      modelUsed: chosen.modelUsed ?? null,
      status: autoExecute ? "AUTO_EXECUTED" : "PENDING_REVIEW",
      aiDecisionLogId: aiLogId,
    },
    select: { id: true },
  });

  return { id: created.id, verdict: chosen };
}

function resolveTriggerReason(
  status: BotStatus,
  outputData: Prisma.JsonValue | null
): string | null {
  if (status === "FAILED") return "FAILED";
  if (status === "REQUIRES_MANUAL") return "REQUIRES_MANUAL";
  if (
    status === "COMPLETED" &&
    outputData &&
    typeof outputData === "object" &&
    !Array.isArray(outputData) &&
    (outputData as Record<string, unknown>).isFlagged === true
  ) {
    return "FLAGGED";
  }
  return null;
}
