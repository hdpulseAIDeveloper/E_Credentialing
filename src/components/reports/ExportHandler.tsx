"use client";

import { api } from "@/trpc/react";
import { useState } from "react";
import Link from "next/link";

const EXPORT_CONFIGS: Record<string, { label: string; description: string }> = {
  providers: { label: "Providers", description: "Export all providers with status, NPI, license, and facility data" },
  enrollments: { label: "Enrollments", description: "Export payer enrollment submissions, statuses, and follow-up dates" },
  expirables: { label: "Expirables", description: "Export all credential expirations with verification dates" },
  recredentialing: { label: "Recredentialing", description: "Export recredentialing cycles with due dates and completion status" },
  sanctions: { label: "Sanctions History", description: "All OIG/SAM sanctions check records" },
  evaluations: { label: "OPPE/FPPE Evaluations", description: "Practice evaluation records" },
  cme: { label: "CME Credits", description: "CME credit records for all providers" },
};

const AVAILABLE_PROCEDURES = new Set(["providers", "enrollments", "expirables", "recredentialing"]);

function triggerDownload(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportHandler({ type }: { type: string }) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const config = EXPORT_CONFIGS[type] || EXPORT_CONFIGS.providers!;
  const hasBackend = AVAILABLE_PROCEDURES.has(type);
  const timestamp = new Date().toISOString().split("T")[0];

  const providersQuery = api.report.exportProviders.useQuery(
    {},
    { enabled: false }
  );
  const enrollmentsQuery = api.report.exportEnrollments.useQuery(
    {},
    { enabled: false }
  );
  const expirablesQuery = api.report.exportExpirables.useQuery(
    {},
    { enabled: false }
  );
  const recredentialingQuery = api.report.exportRecredentialing.useQuery(
    undefined,
    { enabled: false }
  );

  async function handleDownload() {
    if (!hasBackend) {
      alert("Export coming soon");
      return;
    }
    setDownloading(true);
    setError(null);

    try {
      let result: { data?: string };

      switch (type) {
        case "providers":
          result = await providersQuery.refetch();
          break;
        case "enrollments":
          result = await enrollmentsQuery.refetch();
          break;
        case "expirables":
          result = await expirablesQuery.refetch();
          break;
        case "recredentialing":
          result = await recredentialingQuery.refetch();
          break;
        default:
          result = await providersQuery.refetch();
      }

      if (result.data) {
        triggerDownload(result.data, `${type}-export-${timestamp}.csv`);
      }
    } catch {
      setError("Failed to generate export. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/reports" className="hover:text-blue-600 transition-colors">
          Reports
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Export {config.label}</span>
      </div>

      {/* Export Card */}
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-lg border p-8 text-center">
          <div className="text-4xl mb-4">📊</div>
          <h1 className="text-xl font-bold text-gray-900">
            Export {config.label}
          </h1>
          <p className="text-sm text-gray-500 mt-2 mb-6">
            {config.description}
          </p>

          {error && (
            <div className="mb-4 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            onClick={handleDownload}
            disabled={downloading}
            className={`px-6 py-3 rounded-lg text-sm font-medium transition-colors ${
              downloading
                ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                : hasBackend
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-200 text-gray-600 hover:bg-gray-300"
            }`}
          >
            {downloading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating…
              </span>
            ) : hasBackend ? (
              "Download CSV"
            ) : (
              "Coming Soon"
            )}
          </button>

          <p className="text-xs text-gray-400 mt-4">
            File: {type}-export-{timestamp}.csv
          </p>
        </div>
      </div>

      {/* Other Export Options */}
      <div className="max-w-lg mx-auto">
        <h3 className="text-sm font-medium text-gray-500 mb-3">Other exports</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(EXPORT_CONFIGS)
            .filter(([key]) => key !== type)
            .map(([key, cfg]) => (
              <Link
                key={key}
                href={`/reports/export?type=${key}`}
                className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                {cfg.label}
              </Link>
            ))}
        </div>
      </div>
    </div>
  );
}
