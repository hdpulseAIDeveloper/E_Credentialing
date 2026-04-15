"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { api } from "@/trpc/react";
import "@excalidraw/excalidraw/index.css";

/* eslint-disable @typescript-eslint/no-explicit-any */
const Excalidraw = dynamic(
  async () => {
    const mod = await import("@excalidraw/excalidraw");
    return mod.Excalidraw;
  },
  { ssr: false, loading: () => <div className="flex h-full items-center justify-center text-gray-400">Loading editor…</div> }
);

interface ExcalidrawEditorProps {
  workflowId: string;
  initialData: Record<string, unknown>;
  readOnly?: boolean;
}

export function ExcalidrawEditor({ workflowId, initialData, readOnly = false }: ExcalidrawEditorProps) {
  const saveMutation = api.admin.saveWorkflow.useMutation();
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "unsaved">("saved");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestSceneRef = useRef<Record<string, unknown> | null>(null);
  const initializedRef = useRef(false);
  const changeCountRef = useRef(0);

  const doSave = useCallback(
    (sceneData: Record<string, unknown>) => {
      if (readOnly) return;
      setSaveStatus("saving");
      saveMutation.mutate(
        { id: workflowId, sceneData },
        {
          onSuccess: () => setSaveStatus("saved"),
          onError: () => setSaveStatus("unsaved"),
        }
      );
    },
    [workflowId, readOnly, saveMutation]
  );

  const handleChange = useCallback(
    (elements: any, appState: any) => {
      if (readOnly) return;
      // Excalidraw fires onChange on init — skip the first few calls
      changeCountRef.current++;
      if (changeCountRef.current <= 2) return;
      if (!initializedRef.current) {
        initializedRef.current = true;
        return;
      }

      const scene = { elements: [...elements], appState, files: {} };
      latestSceneRef.current = scene;
      setSaveStatus("unsaved");

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (latestSceneRef.current) doSave(latestSceneRef.current);
      }, 2000);
    },
    [readOnly, doSave]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const statusColor = saveStatus === "saved" ? "text-green-500" : saveStatus === "saving" ? "text-yellow-500" : "text-gray-400";
  const statusLabel = saveStatus === "saved" ? "Saved" : saveStatus === "saving" ? "Saving…" : "Unsaved changes";

  return (
    <div className="flex h-full flex-col">
      <Script id="excalidraw-asset-path" strategy="beforeInteractive">
        {`window["EXCALIDRAW_ASSET_PATH"] = window.origin;`}
      </Script>

      {!readOnly && (
        <div className="flex items-center justify-end px-3 py-1 border-b border-gray-200 bg-gray-50">
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
      )}

      <div className="flex-1 min-h-0">
        <Excalidraw
          initialData={{
            elements: (initialData.elements ?? []) as any,
            appState: {
              ...((initialData.appState ?? {}) as any),
              collaborators: new Map(),
            },
          }}
          onChange={handleChange as any}
          viewModeEnabled={readOnly}
          UIOptions={{
            canvasActions: {
              loadScene: false,
              export: { saveFileToDisk: !readOnly },
            },
          }}
        />
      </div>
    </div>
  );
}
