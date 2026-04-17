"use client";

/**
 * P1 Gap #15 — Staff-facing telehealth deepening panel.
 *
 * One panel covers three concerns the credentialing team has to manage
 * for any provider doing telehealth:
 *
 *   1. Multi-state coverage analysis (declared states ⊂ active licenses + IMLC grants)
 *   2. IMLC eligibility evaluation + Letter of Qualification record
 *   3. Per-platform certification tracking (Teladoc / Amwell / etc.)
 */

import { useState } from "react";
import { api } from "@/trpc/react";

interface Props {
  providerId: string;
}

const PLATFORM_STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  IN_TRAINING: "bg-amber-100 text-amber-800",
  CERTIFIED: "bg-green-100 text-green-700",
  EXPIRED: "bg-red-100 text-red-700",
  REVOKED: "bg-red-100 text-red-700",
};

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString();
}

export function TelehealthPanel({ providerId }: Props) {
  const utils = api.useUtils();
  const certs = api.telehealth.listCerts.useQuery({ providerId });
  const coverage = api.telehealth.coverage.useQuery({ providerId });
  const imlc = api.telehealth.evaluateImlc.useQuery({ providerId });

  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState({
    platformName: "",
    certificateNumber: "",
    status: "PENDING" as "PENDING" | "IN_TRAINING" | "CERTIFIED" | "EXPIRED" | "REVOKED",
    certifiedAt: "",
    expiresAt: "",
  });

  const upsertCert = api.telehealth.upsertCert.useMutation({
    onSuccess: () => {
      setShowCertForm(false);
      setCertForm({
        platformName: "",
        certificateNumber: "",
        status: "PENDING",
        certifiedAt: "",
        expiresAt: "",
      });
      void utils.telehealth.listCerts.invalidate({ providerId });
    },
  });

  const deleteCert = api.telehealth.deleteCert.useMutation({
    onSuccess: () => utils.telehealth.listCerts.invalidate({ providerId }),
  });

  return (
    <div className="bg-white rounded-lg border p-4 space-y-5">
      <div>
        <h3 className="font-semibold text-gray-900">Telehealth credentialing</h3>
        <p className="text-[11px] text-gray-500">
          Multi-state license coverage, IMLC eligibility, and platform certifications
        </p>
      </div>

      {/* Coverage Analysis */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-800">State coverage</h4>
        {coverage.isLoading && <div className="text-xs text-gray-400">Computing…</div>}
        {coverage.data && (
          <div className="space-y-1.5 text-sm">
            {coverage.data.coveredStates.length === 0 &&
              coverage.data.uncoveredStates.length === 0 && (
                <p className="text-xs text-gray-500">
                  No telehealth states declared yet.
                </p>
              )}
            {coverage.data.coveredStates.length > 0 && (
              <div>
                <span className="text-xs font-medium text-gray-500">Covered: </span>
                {coverage.data.coveredStates.map((s) => (
                  <span
                    key={s}
                    className={`inline-block mr-1 mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                      coverage.data!.imlcCoveredStates.includes(s)
                        ? "bg-violet-50 text-violet-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                    title={
                      coverage.data!.imlcCoveredStates.includes(s)
                        ? "Covered via IMLC member-state grant"
                        : "Covered by direct state license"
                    }
                  >
                    {s}
                    {coverage.data!.imlcCoveredStates.includes(s) ? " (IMLC)" : ""}
                  </span>
                ))}
              </div>
            )}
            {coverage.data.uncoveredStates.length > 0 && (
              <div>
                <span className="text-xs font-medium text-red-600">
                  Missing licensure ({coverage.data.uncoveredStates.length}):{" "}
                </span>
                {coverage.data.uncoveredStates.map((s) => (
                  <span
                    key={s}
                    className="inline-block mr-1 mt-0.5 px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* IMLC Eligibility */}
      <section className="space-y-2 border-t pt-3">
        <h4 className="text-sm font-semibold text-gray-800">
          IMLC (Interstate Medical Licensure Compact)
        </h4>
        {imlc.isLoading && <div className="text-xs text-gray-400">Evaluating…</div>}
        {imlc.data && (
          <div className="text-sm space-y-1.5">
            {imlc.data.eligible ? (
              <div className="text-green-700 text-xs font-medium">
                Eligible — recommended State of Principal License: <strong>{imlc.data.splCandidate}</strong>
              </div>
            ) : (
              <div className="space-y-0.5">
                <div className="text-amber-700 text-xs font-medium">
                  Not currently IMLC-eligible
                </div>
                <ul className="list-disc list-inside text-[11px] text-gray-600 space-y-0.5">
                  {imlc.data.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Platform Certs */}
      <section className="space-y-2 border-t pt-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-800">Platform certifications</h4>
          {!showCertForm && (
            <button
              type="button"
              onClick={() => setShowCertForm(true)}
              className="text-xs bg-blue-600 text-white px-2.5 py-1 rounded hover:bg-blue-700"
            >
              + Platform
            </button>
          )}
        </div>

        {showCertForm && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              upsertCert.mutate({
                providerId,
                platformName: certForm.platformName,
                certificateNumber: certForm.certificateNumber || null,
                status: certForm.status,
                certifiedAt: certForm.certifiedAt
                  ? new Date(certForm.certifiedAt).toISOString()
                  : null,
                expiresAt: certForm.expiresAt
                  ? new Date(certForm.expiresAt).toISOString()
                  : null,
              });
            }}
            className="border rounded p-3 bg-gray-50 space-y-2 text-xs"
          >
            <div className="grid grid-cols-2 gap-2">
              <input
                required
                placeholder="Platform name (e.g. Teladoc)"
                value={certForm.platformName}
                onChange={(e) =>
                  setCertForm({ ...certForm, platformName: e.target.value })
                }
                className="border rounded px-2 py-1"
              />
              <input
                placeholder="Certificate # (optional)"
                value={certForm.certificateNumber}
                onChange={(e) =>
                  setCertForm({ ...certForm, certificateNumber: e.target.value })
                }
                className="border rounded px-2 py-1"
              />
              <select
                value={certForm.status}
                onChange={(e) =>
                  setCertForm({
                    ...certForm,
                    status: e.target.value as typeof certForm.status,
                  })
                }
                className="border rounded px-2 py-1"
              >
                <option value="PENDING">Pending</option>
                <option value="IN_TRAINING">In training</option>
                <option value="CERTIFIED">Certified</option>
                <option value="EXPIRED">Expired</option>
                <option value="REVOKED">Revoked</option>
              </select>
              <input
                type="date"
                placeholder="Certified date"
                value={certForm.certifiedAt}
                onChange={(e) =>
                  setCertForm({ ...certForm, certifiedAt: e.target.value })
                }
                className="border rounded px-2 py-1"
              />
              <input
                type="date"
                placeholder="Expires"
                value={certForm.expiresAt}
                onChange={(e) =>
                  setCertForm({ ...certForm, expiresAt: e.target.value })
                }
                className="border rounded px-2 py-1"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCertForm(false)}
                className="px-2.5 py-1 rounded border"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={upsertCert.isPending}
                className="px-2.5 py-1 rounded bg-blue-600 text-white disabled:opacity-50"
              >
                {upsertCert.isPending ? "Saving…" : "Save"}
              </button>
            </div>
          </form>
        )}

        {certs.data && certs.data.length === 0 && !showCertForm && (
          <p className="text-xs text-gray-400">No platform certifications recorded.</p>
        )}

        {certs.data && certs.data.length > 0 && (
          <table className="w-full text-xs">
            <thead className="text-gray-500">
              <tr className="border-b">
                <th className="text-left py-1.5 font-medium">Platform</th>
                <th className="text-left font-medium">Status</th>
                <th className="text-left font-medium">Certified</th>
                <th className="text-left font-medium">Expires</th>
                <th className="text-right font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {certs.data.map((c) => (
                <tr key={c.id} className="border-b last:border-b-0">
                  <td className="py-1.5">
                    <div className="font-medium text-gray-900">{c.platformName}</div>
                    {c.certificateNumber && (
                      <div className="text-[10px] text-gray-500">
                        #{c.certificateNumber}
                      </div>
                    )}
                  </td>
                  <td>
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        PLATFORM_STATUS_BADGE[c.status] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {c.status.replace("_", " ")}
                    </span>
                  </td>
                  <td>{fmtDate(c.certifiedAt)}</td>
                  <td>{fmtDate(c.expiresAt)}</td>
                  <td className="text-right">
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`Delete ${c.platformName} certification?`)) {
                          deleteCert.mutate({ id: c.id });
                        }
                      }}
                      className="text-red-600 hover:text-red-800 text-[10px]"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
