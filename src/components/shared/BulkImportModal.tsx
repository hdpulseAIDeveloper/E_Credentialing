"use client";

import { useState, useCallback } from "react";
import { api } from "@/trpc/react";

type ImportType = "providers" | "enrollments" | "expirables";

interface ParsedRow {
  [key: string]: string;
}

interface ValidationError {
  row: number;
  field: string;
  message: string;
}

const REQUIRED_FIELDS: Record<ImportType, string[]> = {
  providers: ["firstName", "lastName", "providerType", "npi"],
  enrollments: ["providerNpi", "payerName", "enrollmentType", "submissionMethod"],
  expirables: ["providerNpi", "expirableType", "expirationDate"],
};

function parseCsv(text: string): { headers: string[]; rows: ParsedRow[] } {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
  const rows: ParsedRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: ParsedRow = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || "";
    });
    rows.push(row);
  }

  return { headers, rows };
}

function validateRows(rows: ParsedRow[], type: ImportType): ValidationError[] {
  const errors: ValidationError[] = [];
  const required = REQUIRED_FIELDS[type];

  rows.forEach((row, idx) => {
    required.forEach((field) => {
      if (!row[field]?.trim()) {
        errors.push({ row: idx + 2, field, message: `Missing required field "${field}"` });
      }
    });

    if (type === "providers" && row.npi && !/^\d{10}$/.test(row.npi)) {
      errors.push({ row: idx + 2, field: "npi", message: "NPI must be 10 digits" });
    }

    if (type === "expirables" && row.expirationDate) {
      const d = new Date(row.expirationDate);
      if (isNaN(d.getTime())) {
        errors.push({ row: idx + 2, field: "expirationDate", message: "Invalid date format" });
      }
    }
  });

  return errors;
}

export function BulkImportModal({
  type,
  onClose,
}: {
  type: ImportType;
  onClose: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<{ headers: string[]; rows: ParsedRow[] } | null>(null);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const utils = api.useUtils();

  const handleFile = useCallback(
    async (f: File) => {
      setFile(f);
      const text = await f.text();
      const data = parseCsv(text);
      setParsed(data);
      setErrors(validateRows(data.rows, type));
    },
    [type]
  );

  const providerCreate = api.provider.create.useMutation();
  const enrollmentCreate = api.enrollment.create.useMutation();
  const expirableCreate = api.expirable.create.useMutation();

  const handleImport = async () => {
    if (!parsed || errors.length > 0) return;
    setImporting(true);

    try {
      let imported = 0;
      let skipped = 0;

      for (const row of parsed.rows) {
        try {
          if (type === "providers") {
            await providerCreate.mutateAsync({
              legalFirstName: row.firstName,
              legalLastName: row.lastName,
              providerTypeId: row.providerTypeId || "",
              npi: row.npi || undefined,
              personalEmail: row.email || undefined,
              mobilePhone: row.phone || undefined,
            });
            imported++;
          } else if (type === "enrollments") {
            await enrollmentCreate.mutateAsync({
              providerId: row.providerId || "",
              payerName: row.payerName,
              enrollmentType: (row.enrollmentType || "DELEGATED") as "DELEGATED" | "FACILITY_BTC" | "DIRECT",
              submissionMethod: (row.submissionMethod || "EMAIL") as any,
            });
            imported++;
          } else if (type === "expirables") {
            await expirableCreate.mutateAsync({
              providerId: row.providerId || "",
              expirableType: row.expirableType as any,
              expirationDate: row.expirationDate,
            });
            imported++;
          }
        } catch {
          skipped++;
        }
      }

      setResult({ imported, skipped });
      await utils.invalidate();
    } catch {
      setErrors([{ row: 0, field: "", message: "Import failed. Please try again." }]);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">
              Bulk Import {type.charAt(0).toUpperCase() + type.slice(1)}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              &times;
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {result ? (
            <div className="text-center py-8">
              <div className="text-green-600 text-4xl mb-4">&#10003;</div>
              <h3 className="text-lg font-bold">Import Complete</h3>
              <p className="text-gray-500 mt-2">
                {result.imported} records imported, {result.skipped} skipped.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm text-gray-600 mb-3">
                  Upload a CSV file with the following required columns:
                </p>
                <div className="bg-gray-50 rounded-lg p-3">
                  <code className="text-xs text-gray-700">
                    {REQUIRED_FIELDS[type].join(", ")}
                  </code>
                </div>
              </div>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const f = e.dataTransfer.files[0];
                  if (f) handleFile(f);
                }}
                className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition-colors"
              >
                <input
                  type="file"
                  accept=".csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFile(f);
                  }}
                  className="hidden"
                  id="csv-upload"
                />
                <label htmlFor="csv-upload" className="cursor-pointer">
                  <div className="text-gray-400 text-3xl mb-2">&#128196;</div>
                  <p className="text-sm text-gray-600">
                    {file ? file.name : "Drop CSV file here or click to browse"}
                  </p>
                </label>
              </div>

              {parsed && (
                <div className="space-y-3">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-600">
                      {parsed.rows.length} rows found
                    </span>
                    {errors.length === 0 ? (
                      <span className="text-green-600 font-medium">All rows valid</span>
                    ) : (
                      <span className="text-red-600 font-medium">
                        {errors.length} validation error{errors.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {errors.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {errors.slice(0, 20).map((err, i) => (
                        <p key={i} className="text-xs text-red-700">
                          Row {err.row}: {err.message}
                        </p>
                      ))}
                      {errors.length > 20 && (
                        <p className="text-xs text-red-500 mt-1">
                          ... and {errors.length - 20} more errors
                        </p>
                      )}
                    </div>
                  )}

                  {parsed.rows.length > 0 && (
                    <div className="overflow-x-auto max-h-48 border rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            {parsed.headers.map((h) => (
                              <th key={h} className="px-2 py-1 text-left font-medium text-gray-500">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {parsed.rows.slice(0, 5).map((row, i) => (
                            <tr key={i}>
                              {parsed.headers.map((h) => (
                                <td key={h} className="px-2 py-1 text-gray-700 truncate max-w-32">
                                  {row[h]}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={!parsed || errors.length > 0 || importing}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {importing ? "Importing..." : `Import ${parsed?.rows.length || 0} Records`}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
