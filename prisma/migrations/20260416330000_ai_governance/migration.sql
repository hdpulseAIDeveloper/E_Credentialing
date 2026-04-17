-- P2 Gap #19 — NCQA AI Governance scaffolding.

-- 1. Enums
CREATE TYPE "AiModelRiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'PROHIBITED');
CREATE TYPE "AiModelStatus" AS ENUM ('ACTIVE', 'PILOT', 'RETIRED');
CREATE TYPE "AiHumanDecision" AS ENUM ('ACCEPTED', 'MODIFIED', 'REJECTED', 'PENDING');

-- 2. Model cards
CREATE TABLE "ai_model_cards" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "vendor" TEXT NOT NULL,
  "modality" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "intended_use" TEXT NOT NULL,
  "out_of_scope_use" TEXT,
  "features" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "riskLevel" "AiModelRiskLevel" NOT NULL DEFAULT 'MEDIUM',
  "status" "AiModelStatus" NOT NULL DEFAULT 'PILOT',
  "hosting_environment" TEXT,
  "data_residency" TEXT,
  "training_data_policy" TEXT,
  "no_training_on_customer_data" BOOLEAN NOT NULL DEFAULT false,
  "contract_clause_ref" TEXT,
  "contract_effective_date" TIMESTAMP(3),
  "contract_review_due_date" TIMESTAMP(3),
  "known_limitations" TEXT,
  "evaluation_metrics" JSONB,
  "fairness_notes" TEXT,
  "human_review_required" BOOLEAN NOT NULL DEFAULT true,
  "last_reviewed_at" TIMESTAMP(3),
  "last_reviewed_by_id" TEXT,
  "documentation_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_model_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_model_cards_name_key" ON "ai_model_cards"("name");

ALTER TABLE "ai_model_cards"
  ADD CONSTRAINT "ai_model_cards_last_reviewed_by_id_fkey"
  FOREIGN KEY ("last_reviewed_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. Decision log
CREATE TABLE "ai_decision_logs" (
  "id" TEXT NOT NULL,
  "model_card_id" TEXT,
  "feature" TEXT NOT NULL,
  "provider_id" TEXT,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "prompt_summary" TEXT,
  "response_summary" TEXT,
  "suggested_action" TEXT,
  "rationale" TEXT,
  "citations" JSONB NOT NULL DEFAULT '[]',
  "confidence_score" DOUBLE PRECISION,
  "human_decision" "AiHumanDecision" NOT NULL DEFAULT 'PENDING',
  "human_decision_by_id" TEXT,
  "human_decision_at" TIMESTAMP(3),
  "human_note" TEXT,
  "contains_phi" BOOLEAN NOT NULL DEFAULT false,
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_decision_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_decision_logs_feature_idx" ON "ai_decision_logs"("feature");
CREATE INDEX "ai_decision_logs_provider_id_idx" ON "ai_decision_logs"("provider_id");
CREATE INDEX "ai_decision_logs_human_decision_idx" ON "ai_decision_logs"("human_decision");
CREATE INDEX "ai_decision_logs_created_at_idx" ON "ai_decision_logs"("created_at");

ALTER TABLE "ai_decision_logs"
  ADD CONSTRAINT "ai_decision_logs_model_card_id_fkey"
  FOREIGN KEY ("model_card_id") REFERENCES "ai_model_cards"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_decision_logs"
  ADD CONSTRAINT "ai_decision_logs_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ai_decision_logs"
  ADD CONSTRAINT "ai_decision_logs_human_decision_by_id_fkey"
  FOREIGN KEY ("human_decision_by_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. Seed model cards for the AI features the platform uses today.
INSERT INTO "ai_model_cards" (
  "id", "name", "version", "vendor", "modality", "purpose", "intended_use",
  "out_of_scope_use", "features", "riskLevel", "status",
  "hosting_environment", "data_residency", "training_data_policy",
  "no_training_on_customer_data", "contract_clause_ref",
  "known_limitations", "human_review_required",
  "documentation_url", "updated_at"
) VALUES
  (gen_random_uuid(), 'Azure OpenAI GPT-4o (Compliance Coach)', '2024-08-06',
   'Microsoft Azure OpenAI Service', 'text',
   'Conversational coaching for staff and self-service Q&A for providers grounded in Essen credentialing policy.',
   'Internal staff coaching, provider portal Q&A grounded in docs/ knowledge base. RAG-only; no autonomous decisions.',
   'Generating credentialing approval/denial decisions, generating PHI from external sources, or any clinical decision support.',
   ARRAY['compliance.coach','provider.portal.assistant'],
   'MEDIUM', 'ACTIVE',
   'Azure OpenAI Service - East US 2',
   'United States',
   'Microsoft contractually does not use customer prompts/completions to train OpenAI base models (Azure OpenAI Service Customer Copyright Commitment & Data, privacy & security FAQ).',
   true,
   'Azure OpenAI Service Agreement § Data, Privacy and Security',
   'Knowledge cutoff 2023-10. Hallucinations possible; outputs include citations and require human verification before action.',
   true,
   'https://learn.microsoft.com/azure/ai-services/openai/concepts/model-versions',
   CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'Azure AI Document Intelligence (Document Classifier)', '2024-07-31',
   'Microsoft Azure', 'vision',
   'Suggest the most likely credentialing document type for newly uploaded files (e.g., DEA, license, malpractice COI).',
   'Advisory classification suggestion only. Always reviewed by a credentialing specialist before persisting to a provider record.',
   'Authoritative document categorisation, OCR for clinical documents, or any unattended action.',
   ARRAY['document.classify'],
   'LOW', 'ACTIVE',
   'Azure AI Document Intelligence - East US 2',
   'United States',
   'Microsoft contractually does not use customer documents to train its prebuilt or custom models without explicit opt-in.',
   true,
   'Azure AI Services Agreement § Data, Privacy and Security',
   'Confidence varies by document quality; novel document types fall back to manual classification.',
   true,
   'https://learn.microsoft.com/azure/ai-services/document-intelligence/',
   CURRENT_TIMESTAMP);
