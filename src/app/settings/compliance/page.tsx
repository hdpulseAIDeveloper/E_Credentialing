/**
 * Wave 5.4 — compliance & auditor-package settings page.
 *
 * Hosts the one-click export of the auditor package and the SOC 2
 * Type I gap-analysis summary so a compliance officer can see at a
 * glance what's implemented, what's partial, and what's a gap.
 */
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { SOC2_CONTROLS, summarizeSoc2 } from "@/lib/auditor/soc2-controls";
import { AuditorExportButton } from "./auditor-export-button";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Compliance | E-Credentialing CVO Platform",
};

const ADMIN_ROLES = new Set(["ADMIN", "SUPER_ADMIN", "COMPLIANCE_OFFICER"]);

export default async function ComplianceSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/auth/signin?callbackUrl=/settings/compliance");
  const role = (session.user as { role?: string }).role ?? "";
  if (!ADMIN_ROLES.has(role)) redirect("/dashboard");

  const sum = summarizeSoc2();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Compliance</h1>
        <p className="mt-1 text-gray-600">
          Auditor-ready evidence pack and SOC 2 Type I gap analysis.
        </p>
      </header>

      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Auditor package</h2>
        <p className="mt-1 text-sm text-gray-600">
          One-click export of the chained audit log, NCQA snapshots,
          SOC 2 control evidence, and a byte-stable manifest. The same
          inputs always produce the same SHA-256 — give the digest to
          your auditor and they can re-verify any time.
        </p>
        <AuditorExportButton />
      </section>

      <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">SOC 2 Type I — gap analysis</h2>
        <div className="mt-4 grid grid-cols-3 gap-4 text-center">
          <Stat label="Implemented" value={sum.implemented} tone="green" />
          <Stat label="Partial" value={sum.partial} tone="amber" />
          <Stat label="Gap" value={sum.gap} tone="red" />
        </div>

        <h3 className="mt-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
          By category
        </h3>
        <div className="mt-2 overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-gray-500">
                <th className="py-2 pr-4">Category</th>
                <th className="py-2 pr-4 text-right">Implemented</th>
                <th className="py-2 pr-4 text-right">Partial</th>
                <th className="py-2 pr-4 text-right">Gap</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {Object.entries(sum.byCategory).map(([cat, stats]) => (
                <tr key={cat}>
                  <td className="py-2 pr-4 font-medium text-gray-900">{cat}</td>
                  <td className="py-2 pr-4 text-right">{stats.implemented}</td>
                  <td className="py-2 pr-4 text-right">{stats.partial}</td>
                  <td className="py-2 pr-4 text-right">{stats.gap}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 text-sm font-semibold text-gray-700 uppercase tracking-wider">
          Per-control status
        </h3>
        <ul className="mt-2 divide-y divide-gray-100">
          {SOC2_CONTROLS.map((c) => (
            <li
              key={c.ref}
              className="py-3 flex items-baseline justify-between gap-4"
              data-testid={`soc2-control-${c.ref}`}
            >
              <div>
                <p className="font-mono text-xs text-gray-500">{c.ref}</p>
                <p className="text-sm font-semibold text-gray-900">{c.title}</p>
                {c.notes && (
                  <p className="mt-1 text-xs text-gray-600 italic">{c.notes}</p>
                )}
              </div>
              <span
                className={`inline-flex shrink-0 px-2 py-1 rounded text-xs font-semibold ${
                  c.status === "implemented"
                    ? "bg-green-100 text-green-800"
                    : c.status === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {c.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "amber" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-200 bg-green-50 text-green-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : "border-red-200 bg-red-50 text-red-900";
  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <p className="text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs uppercase tracking-wider">{label}</p>
    </div>
  );
}
