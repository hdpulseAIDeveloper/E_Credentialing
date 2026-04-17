"use client";

/**
 * AiChatLauncher — floating bottom-right launcher that toggles the
 * AiChatPanel as a popover. Used in both the provider portal layout and
 * staff layouts so the assistant is always one click away.
 */

import { useState } from "react";
import { AiChatPanel } from "./AiChatPanel";

interface Props {
  mode: "PROVIDER" | "STAFF_COACH";
  providerId?: string;
}

export function AiChatLauncher({ mode, providerId }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={open ? "Close AI assistant" : "Open AI assistant"}
        onClick={() => setOpen((o) => !o)}
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700"
      >
        {open ? "×" : "AI"}
      </button>
      {open && (
        <div className="fixed bottom-20 right-5 z-40 w-[380px] max-w-[calc(100vw-2rem)]">
          <AiChatPanel mode={mode} providerId={providerId} />
        </div>
      )}
    </>
  );
}
