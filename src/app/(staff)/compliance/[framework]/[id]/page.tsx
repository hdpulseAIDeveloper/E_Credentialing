/**
 * Staff: Compliance control detail — P3 Gap #23.
 *
 * Shows everything an assessor needs about one control: status, owner,
 * maturity, test procedure, evidence binder, and gap log.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import type { ComplianceFramework } from "@prisma/client";
import { ControlActions } from "./ControlActions";

const SLUG_TO_FRAMEWORK: Record<string, ComplianceFramework> = {
  hitrust: "HITRUST_R2",
  soc2: "SOC2_TYPE_II",
};

interface PageProps {
  params: Promise<{ framework: string; id: string }>;
}

export default async function ComplianceControlDetail({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");
  const { framework: slug, id } = await params;
  const framework = SLUG_TO_FRAMEWORK[slug.toLowerCase()];
  if (!framework) notFound();

  const control = await db.complianceControl.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, displayName: true, email: true } },
      evidence: {
        include: {
          addedBy: { select: { id: true, displayName: true } },
        },
        orderBy: { addedAt: "desc" },
      },
      gaps: {
        include: { owner: { select: { id: true, displayName: true } } },
        orderBy: [{ status: "asc" }, { severity: "desc" }],
      },
    },
  });
  if (!control || control.framework !== framework) notFound();

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <header>
        <Link
          href={`/compliance/${slug}`}
          className="text-xs text-blue-600 hover:underline"
        >
          ← {framework.replace("_", " ")} catalog
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          <span className="font-mono text-base text-gray-500 mr-2">
            {control.controlRef}
          </span>
          {control.title}
        </h1>
        {control.category && (
          <p className="text-xs text-gray-500 mt-1">
            Category: {control.category}
          </p>
        )}
      </header>

      <section className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Status</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">
            {control.status.replace(/_/g, " ")}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Maturity</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">
            {control.maturity}
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <div className="text-xs uppercase text-gray-500">Owner</div>
          <div className="text-sm font-semibold text-gray-800 mt-1">
            {control.owner?.displayName ?? "Unassigned"}
          </div>
        </div>
      </section>

      {control.description && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Description</h2>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
            {control.description}
          </p>
        </section>
      )}

      {control.testProcedure && (
        <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Test procedure</h2>
          <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
            {control.testProcedure}
          </p>
        </section>
      )}

      <ControlActions control={{ id: control.id, status: control.status, maturity: control.maturity, notes: control.notes ?? "" }} />

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Evidence ({control.evidence.length})
          </h2>
        </header>
        {control.evidence.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No evidence linked. Attach policies, screenshots, log exports,
            and tickets that demonstrate this control is operating.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Type</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Period</th>
                <th className="px-4 py-2 text-left">Added by</th>
                <th className="px-4 py-2 text-left">Link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {control.evidence.map((e) => (
                <tr key={e.id}>
                  <td className="px-4 py-2 text-xs text-gray-700">{e.type}</td>
                  <td className="px-4 py-2 text-xs text-gray-800">{e.title}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {e.periodStart && e.periodEnd
                      ? `${e.periodStart.toISOString().slice(0, 10)} → ${e.periodEnd.toISOString().slice(0, 10)}`
                      : "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {e.addedBy?.displayName ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {e.url ? (
                      <a
                        href={e.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        Open
                      </a>
                    ) : e.blobPath ? (
                      <span className="text-gray-700">{e.blobPath}</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="bg-white border border-gray-200 rounded-lg shadow-sm">
        <header className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">
            Gaps ({control.gaps.length})
          </h2>
        </header>
        {control.gaps.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">
            No gaps logged for this control.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Severity</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {control.gaps.map((g) => (
                <tr key={g.id}>
                  <td className="px-4 py-2 text-xs">
                    <span
                      className={`px-2 py-0.5 rounded-full font-medium ${
                        g.severity === "CRITICAL"
                          ? "bg-red-100 text-red-700"
                          : g.severity === "HIGH"
                          ? "bg-orange-100 text-orange-700"
                          : g.severity === "MODERATE"
                          ? "bg-amber-100 text-amber-800"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {g.severity}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {g.status.replace(/_/g, " ")}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-800">
                    {g.description}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {g.owner?.displayName ?? "—"}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {g.dueDate ? g.dueDate.toISOString().slice(0, 10) : "—"}
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
