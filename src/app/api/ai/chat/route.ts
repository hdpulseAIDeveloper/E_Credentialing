/**
 * POST /api/ai/chat
 *
 * P1 Gap #11 — Conversational AI assistants.
 *
 * Two surfaces share this endpoint:
 *   • mode=PROVIDER       — provider self-service (scoped to their own data)
 *   • mode=STAFF_COACH    — internal compliance coach for staff
 *
 * Authorization rules:
 *   • Both modes require an authenticated session.
 *   • PROVIDER mode forces providerId = session.user.providerId. The body
 *     value is ignored; this prevents a provider from coaxing the assistant
 *     into discussing another provider.
 *   • STAFF_COACH mode is allowed for non-PROVIDER roles only. providerId is
 *     optional (a "global" coach session is allowed).
 *
 * The whole exchange (user turn + assistant turn) is persisted to
 * AiConversation / AiMessage so we have a full audit trail for NCQA AI
 * governance reviews.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import {
  chatCompletion,
  isChatConfigured,
  type ChatMessage,
} from "@/lib/ai/chat-client";
import {
  retrieveContext,
  formatContextForPrompt,
} from "@/lib/ai/knowledge-base";
import {
  systemPromptForMode,
  buildProviderContext,
} from "@/lib/ai/assistant-prompts";
import type { AiAssistantMode } from "@prisma/client";
import { logAiDecision } from "@/lib/ai/governance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const bodySchema = z.object({
  conversationId: z.string().uuid().optional(),
  mode: z.enum(["PROVIDER", "STAFF_COACH"]),
  providerId: z.string().uuid().optional(),
  message: z.string().min(1).max(4000),
});

const MAX_HISTORY_TURNS = 12;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isChatConfigured()) {
    return NextResponse.json(
      {
        error: "AI assistant not configured",
        detail:
          "Set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY (and optionally AZURE_OPENAI_CHAT_DEPLOYMENT) to enable the assistant.",
      },
      { status: 503 }
    );
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await req.json());
  } catch (err) {
    return NextResponse.json(
      { error: "Invalid request body", detail: String(err) },
      { status: 400 }
    );
  }

  const role = session.user.role;
  const userId = session.user.id;
  let mode: AiAssistantMode = parsed.mode;
  let providerId: string | undefined = parsed.providerId;

  // Force providerId for PROVIDER mode and reject staff-coach attempts.
  if (role === "PROVIDER") {
    if (mode !== "PROVIDER") {
      return NextResponse.json(
        { error: "Provider users may only use the PROVIDER assistant" },
        { status: 403 }
      );
    }
    if (!session.user.providerId) {
      return NextResponse.json(
        { error: "Your account is not linked to a provider record" },
        { status: 403 }
      );
    }
    providerId = session.user.providerId;
  } else {
    // Staff users can technically open either mode; map PROVIDER → coach to
    // avoid accidentally answering as if they were the provider themself.
    if (mode === "PROVIDER") mode = "STAFF_COACH";
  }

  // ── Load or create the conversation ───────────────────────────────────────
  let conversation = parsed.conversationId
    ? await db.aiConversation.findUnique({
        where: { id: parsed.conversationId },
        include: {
          messages: { orderBy: { createdAt: "asc" }, take: MAX_HISTORY_TURNS * 2 },
        },
      })
    : null;

  // Verify the requester owns the conversation (or is staff for staff coach).
  if (conversation) {
    if (conversation.userId && conversation.userId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      role === "PROVIDER" &&
      conversation.providerId &&
      conversation.providerId !== providerId
    ) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    conversation = await db.aiConversation.create({
      data: {
        mode,
        userId,
        providerId: providerId ?? null,
        title: parsed.message.slice(0, 80),
      },
      include: { messages: true },
    });
  }

  // ── Build the message stack ──────────────────────────────────────────────
  const ragChunks = retrieveContext(parsed.message, 5);
  const ragContext = formatContextForPrompt(ragChunks);

  const providerContext = providerId
    ? await buildProviderContext(db, providerId)
    : "";

  const systemMessages: ChatMessage[] = [
    { role: "system", content: systemPromptForMode(mode) },
  ];
  if (providerContext) {
    systemMessages.push({
      role: "system",
      content:
        `--- BEGIN STRUCTURED PROVIDER DATA ---\n${providerContext}\n--- END STRUCTURED PROVIDER DATA ---`,
    });
  }
  if (ragContext) {
    systemMessages.push({
      role: "system",
      content:
        `--- BEGIN POLICY / DOCS CONTEXT (cite as [doc:N]) ---\n${ragContext}\n--- END POLICY / DOCS CONTEXT ---`,
    });
  }

  const history: ChatMessage[] = conversation.messages
    .slice(-MAX_HISTORY_TURNS * 2)
    .filter((m) => m.role !== "SYSTEM")
    .map((m) => ({
      role: m.role === "USER" ? "user" : "assistant",
      content: m.content,
    }));

  const messages: ChatMessage[] = [
    ...systemMessages,
    ...history,
    { role: "user", content: parsed.message },
  ];

  // ── Call the model ───────────────────────────────────────────────────────
  const reply = await chatCompletion(messages, { temperature: 0.2, maxTokens: 700 });
  if (!reply) {
    return NextResponse.json(
      { error: "Assistant temporarily unavailable" },
      { status: 502 }
    );
  }

  // ── Persist both turns ───────────────────────────────────────────────────
  const citations = ragChunks.map((c, i) => ({
    index: i + 1,
    source: c.source,
    heading: c.heading,
  }));

  const [, assistantMsg] = await db.$transaction([
    db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "USER",
        content: parsed.message,
      },
    }),
    db.aiMessage.create({
      data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: reply.content,
        citations,
        promptTokens: reply.promptTokens ?? null,
        completionTokens: reply.completionTokens ?? null,
        latencyMs: reply.latencyMs,
      },
    }),
    db.aiConversation.update({
      where: { id: conversation.id },
      data: { modelDeployment: reply.modelDeployment, updatedAt: new Date() },
    }),
  ]);

  // P2 Gap #19 — log every AI conversational reply for governance.
  void logAiDecision(db, {
    feature: conversation.mode === "PROVIDER"
      ? "provider.portal.assistant"
      : "compliance.coach",
    modelName: "Azure OpenAI GPT-4o (Compliance Coach)",
    providerId: conversation.providerId,
    entityType: "AiConversation",
    entityId: conversation.id,
    promptSummary: parsed.message,
    responseSummary: reply.content,
    rationale: citations.length
      ? `Grounded by ${citations.length} doc citation(s)`
      : "No RAG citations matched",
    citations,
    promptTokens: reply.promptTokens ?? null,
    completionTokens: reply.completionTokens ?? null,
    latencyMs: reply.latencyMs,
    // Provider-scoped chats may include the provider's own PHI in context.
    containsPhi: Boolean(conversation.providerId),
  });

  return NextResponse.json({
    conversationId: conversation.id,
    messageId: assistantMsg.id,
    reply: reply.content,
    citations,
    usage: {
      promptTokens: reply.promptTokens,
      completionTokens: reply.completionTokens,
      latencyMs: reply.latencyMs,
      modelDeployment: reply.modelDeployment,
    },
  });
}
