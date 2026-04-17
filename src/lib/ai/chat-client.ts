/**
 * Azure OpenAI chat wrapper used by the conversational assistants
 * (provider portal bot + staff compliance coach).
 *
 * Pattern matches src/lib/ai/document-classifier.ts so we don't pull in the
 * full @azure/openai SDK — a small fetch wrapper is enough and keeps the
 * client edge-runtime friendly.
 *
 * Returns null when the environment is not configured. Callers must handle
 * that case (the UI shows a "AI assistant not available" notice).
 */

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  content: string;
  promptTokens: number | null;
  completionTokens: number | null;
  latencyMs: number;
  modelDeployment: string;
}

export function isChatConfigured(): boolean {
  return Boolean(
    process.env.AZURE_OPENAI_ENDPOINT && process.env.AZURE_OPENAI_API_KEY
  );
}

export async function chatCompletion(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {}
): Promise<ChatResponse | null> {
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const deployment =
    process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
    process.env.AZURE_OPENAI_DEPLOYMENT ??
    "gpt-4o-mini";
  const apiVersion =
    process.env.AZURE_OPENAI_API_VERSION ?? "2024-08-01-preview";
  if (!endpoint || !apiKey) return null;

  const url =
    `${endpoint.replace(/\/$/, "")}/openai/deployments/` +
    `${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;

  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": apiKey },
      body: JSON.stringify({
        messages,
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 600,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(
        `[chat] Azure OpenAI returned ${res.status}: ${text.slice(0, 300)}`
      );
      return null;
    }
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    return {
      content,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
      latencyMs: Date.now() - start,
      modelDeployment: deployment,
    };
  } catch (err) {
    console.error("[chat] Azure OpenAI call failed:", err);
    return null;
  }
}
