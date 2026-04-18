"use client";

/**
 * Wave 5.4 — client-side auditor-package download button.
 *
 * Hits /api/compliance/auditor-package, derives a filename from the
 * Content-Disposition header, and prompts the browser to save.
 */
import { useState } from "react";

export function AuditorExportButton() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastDigest, setLastDigest] = useState<string | null>(null);

  async function download() {
    setError(null);
    setLastDigest(null);
    setLoading(true);
    try {
      const res = await fetch("/api/compliance/auditor-package", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) {
        let message = `Export failed (${res.status}).`;
        try {
          const j = (await res.json()) as { message?: string; error?: string };
          message = j.message ?? j.error ?? message;
        } catch {
          // body wasn't JSON
        }
        setError(message);
        return;
      }
      const digest = res.headers.get("x-auditor-package-digest");
      if (digest) setLastDigest(digest);

      const cd = res.headers.get("content-disposition") ?? "";
      const match = /filename="([^"]+)"/.exec(cd);
      const filename = match?.[1] ?? "auditor-package.zip";

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={download}
        disabled={loading}
        className="inline-flex items-center px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50"
        data-testid="auditor-export-download"
      >
        {loading ? "Building package…" : "Download auditor package (.zip)"}
      </button>
      {lastDigest && (
        <p className="mt-2 text-xs text-gray-600">
          SHA-256: <code className="font-mono">{lastDigest}</code>
        </p>
      )}
      {error && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
