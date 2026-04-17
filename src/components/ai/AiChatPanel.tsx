"use client";

/**
 * AiChatPanel — conversational AI widget used in two contexts:
 *   • PROVIDER mode: provider portal sidebar / page bottom
 *   • STAFF_COACH mode: staff dashboard / provider detail page
 *
 * Self-contained client component. Talks to /api/ai/chat. No tRPC dependency
 * because we want a tiny, embeddable surface that works on the public-token
 * provider portal too.
 */

import { useEffect, useRef, useState } from "react";

interface Citation {
  index: number;
  source: string;
  heading: string;
}

interface ChatTurn {
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[];
}

interface Props {
  mode: "PROVIDER" | "STAFF_COACH";
  providerId?: string;
  initialPrompt?: string;
  className?: string;
}

const SUGGESTIONS_PROVIDER = [
  "What's the status of my application?",
  "Which documents are still missing?",
  "How do I update my CAQH attestation?",
  "When does my license expire and what should I do next?",
];

const SUGGESTIONS_STAFF = [
  "What does NCQA require for primary source verification turnaround?",
  "Walk me through this provider's outstanding committee items.",
  "Why might a SAM.gov hit be a false positive?",
  "How do I launch the recredentialing cycle for a provider?",
];

export function AiChatPanel({
  mode,
  providerId,
  initialPrompt,
  className,
}: Props) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState(initialPrompt ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const suggestions =
    mode === "PROVIDER" ? SUGGESTIONS_PROVIDER : SUGGESTIONS_STAFF;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, pending]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || pending) return;
    setPending(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "user", content: trimmed }]);
    setInput("");

    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId,
          mode,
          providerId,
          message: trimmed,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const detail = data?.detail ?? data?.error ?? `HTTP ${res.status}`;
        setError(typeof detail === "string" ? detail : JSON.stringify(detail));
        return;
      }
      setConversationId(data.conversationId);
      setTurns((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.reply,
          citations: data.citations ?? [],
        },
      ]);
    } catch (err) {
      setError(`Network error: ${String(err)}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className={`flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm ${
        className ?? ""
      }`}
    >
      <header className="flex items-center justify-between border-b border-gray-200 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">
            {mode === "PROVIDER"
              ? "Provider Assistant"
              : "Compliance Coach"}
          </span>
          <span className="text-[10px] uppercase tracking-wide text-gray-500">
            beta · decision-support only
          </span>
        </div>
        {turns.length > 0 && (
          <button
            type="button"
            className="text-[11px] text-gray-500 hover:text-gray-700"
            onClick={() => {
              setTurns([]);
              setConversationId(null);
              setError(null);
            }}
          >
            New chat
          </button>
        )}
      </header>

      <div
        ref={scrollRef}
        className="flex-1 min-h-[280px] max-h-[460px] overflow-y-auto px-3 py-3 space-y-3 text-sm"
      >
        {turns.length === 0 && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500">
              {mode === "PROVIDER"
                ? "Ask about your application, missing documents, license renewals, or how to update your information. The assistant cannot make credentialing decisions."
                : "Ask about NCQA requirements, this provider's status, or how to use a feature in the platform. The coach cannot take actions on your behalf."}
            </p>
            <div className="space-y-1.5">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Try asking
              </p>
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="block w-full text-left text-xs text-blue-700 hover:text-blue-900 hover:underline"
                  onClick={() => void send(s)}
                  disabled={pending}
                >
                  → {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div
            key={i}
            className={
              t.role === "user"
                ? "flex justify-end"
                : "flex justify-start"
            }
          >
            <div
              className={`max-w-[85%] rounded-md px-3 py-2 ${
                t.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-900"
              }`}
            >
              <div className="whitespace-pre-wrap">{t.content}</div>
              {t.citations && t.citations.length > 0 && (
                <div className="mt-2 border-t border-gray-300/40 pt-1.5 text-[10px] text-gray-600">
                  <div className="font-medium uppercase tracking-wide">
                    Sources
                  </div>
                  <ul className="mt-0.5 space-y-0.5">
                    {t.citations.map((c) => (
                      <li key={c.index}>
                        [doc:{c.index}] {c.source}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ))}

        {pending && (
          <div className="flex justify-start">
            <div className="rounded-md bg-gray-100 px-3 py-2 text-xs text-gray-500">
              Thinking…
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="border-t border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <form
        className="flex gap-2 border-t border-gray-200 px-3 py-2"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            pending
              ? "Waiting for response…"
              : mode === "PROVIDER"
                ? "Ask about your application…"
                : "Ask the compliance coach…"
          }
          disabled={pending}
          className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-gray-100"
        />
        <button
          type="submit"
          disabled={pending || input.trim().length === 0}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-gray-300"
        >
          Send
        </button>
      </form>
    </div>
  );
}
