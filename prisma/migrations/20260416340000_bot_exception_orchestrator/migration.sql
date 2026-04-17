-- P3 Gap #20 — Autonomous AI agent orchestrator on Playwright bots
-- Creates BotExceptionVerdict for the orchestrator's per-run recommendations.

CREATE TYPE "BotExceptionAction" AS ENUM (
  'RETRY_NOW',
  'RETRY_LATER',
  'ESCALATE_TO_STAFF',
  'MARK_REQUIRES_MANUAL',
  'RAISE_ALERT',
  'DEFER_NO_ACTION'
);

CREATE TYPE "BotExceptionVerdictStatus" AS ENUM (
  'PENDING_REVIEW',
  'AUTO_EXECUTED',
  'ACCEPTED',
  'OVERRIDDEN',
  'RESOLVED'
);

CREATE TABLE "bot_exception_verdicts" (
  "id"                 TEXT                         PRIMARY KEY,
  "bot_run_id"         TEXT                         NOT NULL,
  "provider_id"        TEXT                         NOT NULL,
  "trigger_reason"     TEXT                         NOT NULL,
  "recommended_action" "BotExceptionAction"         NOT NULL,
  "rationale"          TEXT                         NOT NULL,
  "confidence"         DOUBLE PRECISION             NOT NULL DEFAULT 0.5,
  "evidence"           JSONB                        NOT NULL DEFAULT '{}'::jsonb,
  "source"             TEXT                         NOT NULL DEFAULT 'rules',
  "model_used"         TEXT,
  "status"             "BotExceptionVerdictStatus"  NOT NULL DEFAULT 'PENDING_REVIEW',
  "resolved_at"        TIMESTAMP(3),
  "resolved_by_id"     TEXT,
  "resolution_note"    TEXT,
  "ai_decision_log_id" TEXT,
  "created_at"         TIMESTAMP(3)                 NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"         TIMESTAMP(3)                 NOT NULL,

  CONSTRAINT "bot_exception_verdicts_bot_run_id_fkey"
    FOREIGN KEY ("bot_run_id") REFERENCES "bot_runs"("id") ON DELETE CASCADE,
  CONSTRAINT "bot_exception_verdicts_provider_id_fkey"
    FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE CASCADE,
  CONSTRAINT "bot_exception_verdicts_resolved_by_id_fkey"
    FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL
);

CREATE INDEX "bot_exception_verdicts_provider_id_idx" ON "bot_exception_verdicts"("provider_id");
CREATE INDEX "bot_exception_verdicts_status_idx" ON "bot_exception_verdicts"("status");
CREATE INDEX "bot_exception_verdicts_bot_run_id_idx" ON "bot_exception_verdicts"("bot_run_id");
CREATE INDEX "bot_exception_verdicts_created_at_idx" ON "bot_exception_verdicts"("created_at");

-- Seed an AiModelCard for the orchestrator so it shows in governance dashboard.
INSERT INTO "ai_model_cards" (
  "id", "name", "version", "vendor", "modality", "purpose", "intended_use",
  "out_of_scope_use", "features", "riskLevel", "status", "hosting_environment",
  "data_residency", "training_data_policy", "no_training_on_customer_data",
  "contract_clause_ref", "contract_effective_date", "known_limitations",
  "fairness_notes", "human_review_required", "documentation_url",
  "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(),
  'Bot Exception Orchestrator (Azure OpenAI GPT-4o)',
  '2026-04',
  'Microsoft Azure',
  'reasoning/classification',
  'Triages failed/flagged PSV bot runs and recommends a corrective action (retry, escalate, mark manual, raise alert).',
  'Used after a Playwright PSV bot finishes in FAILED, REQUIRES_MANUAL, or returns a flagged verification, to recommend a next action for staff review.',
  'Never auto-executes adverse credentialing decisions; recommendations are advisory and require human acceptance unless they are simple retries.',
  ARRAY['exception_routing','rationale_generation','confidence_scoring'],
  'MEDIUM',
  'ACTIVE',
  'Azure OpenAI - East US 2',
  'United States',
  'Azure OpenAI Service - customer data is not used to train base models per Azure OpenAI data, privacy & security commitments.',
  TRUE,
  'MSA Schedule A §6.3 (Azure OpenAI Service Terms)',
  '2025-01-01T00:00:00Z',
  'May misclassify novel error types; deterministic rule-based fallback runs when LLM is unavailable.',
  'No protected-class attributes are sent to the model; reasoning operates on bot error messages and structured run metadata only.',
  TRUE,
  'https://learn.microsoft.com/en-us/azure/ai-services/openai/concepts/legal-and-regulatory',
  NOW(),
  NOW()
)
ON CONFLICT ("name") DO NOTHING;
