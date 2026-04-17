-- P1 Gap #11: Conversational AI Assistants
-- Storage for provider self-service chat + staff compliance coach

CREATE TYPE "AiAssistantMode" AS ENUM ('PROVIDER', 'STAFF_COACH');

CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');

CREATE TABLE "ai_conversations" (
  "id" TEXT NOT NULL,
  "mode" "AiAssistantMode" NOT NULL,
  "user_id" TEXT,
  "provider_id" TEXT,
  "title" TEXT,
  "model_deployment" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_conversations_user_id_idx" ON "ai_conversations"("user_id");
CREATE INDEX "ai_conversations_provider_id_idx" ON "ai_conversations"("provider_id");

ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ai_conversations"
  ADD CONSTRAINT "ai_conversations_provider_id_fkey"
  FOREIGN KEY ("provider_id") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ai_messages" (
  "id" TEXT NOT NULL,
  "conversation_id" TEXT NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" TEXT NOT NULL,
  "citations" JSONB NOT NULL DEFAULT '[]',
  "prompt_tokens" INTEGER,
  "completion_tokens" INTEGER,
  "latency_ms" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_messages_conversation_id_idx" ON "ai_messages"("conversation_id");

ALTER TABLE "ai_messages"
  ADD CONSTRAINT "ai_messages_conversation_id_fkey"
  FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
