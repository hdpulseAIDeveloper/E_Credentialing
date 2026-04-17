/**
 * Staff: Compliance framework catalog — P3 Gap #23.
 *
 * Lists every control for the selected framework with status, maturity,
 * owner, and evidence/gap counts.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/server/db";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import type { ComplianceFramework } from "@prisma/client";

const SLUG_TO_FRAMEWORK: Record<string, ComplianceFramework> = {
  hitrust: "HITRUST_R2",
  soc2: "SOC2_TYPE_II",
};

const FRAMEWORK_LABEL: Record<ComplianceFramework, string> = {
  HITRUST_R2: "HITRUST CSF v11 r2",
  SOC2_TYPE_II: "SOC 2 Type II (TSC)",
};

const STATUS_COLORS: Record<string, string> = {
  IMPLEMENTED: "bg-green-100 text-green-700",
  PARTIAL: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  NOT_STARTED: "bg-gray-100 text-gray-600",
  NOT_APPLICABLE: "bg-gray-100 text-gray-500",
};

interface PageProps {
  params: Promise<{ framework: string }>;
}

export default async function ComplianceFrameworkPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/api/auth/signin");

  const { framework: slug } = await params;
  const framework = SLUG_TO_FRAMEWORK[slug.toLowerCase()];
  if (!framework) notFound();

  const controls = await db.complianceControl.findMany({
    where: { framework },
    include: {
      owner: { select: { id: true, displayName: true } },
      _count: { select: { evidence: true, gaps: { where: { status: { not: "CLOSED" } } } } },
    },
    orderBy: { controlRef: "asc" },
  });

  const grouped = controls.reduce<Record<string, typeof controls>>((acc, c) => {
    const cat = c.category ?? "Uncategorized";
    (acc[cat] ??= []).push(c);
    return acc;
  }, {});
  const categories = Object.keys(grouped).sort();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <header>
        <Link href="/compliance" className="text-xs text-blue-600 hover:underline">
          ← Readiness dashboard
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-1">
          {FRAMEWORK_LABEL[framework]}
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          {controls.length} controls in catalog. Click a control to manage
          evidence, owner, and gaps.
        </p>
      </header>

      {categories.map((cat) => (
        <section
          key={cat}
          className="bg-white border border-gray-200 rounded-lg shadow-sm"
        >
          <header className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900">
              {cat}{" "}
              <span className="text-gray-400">
                ({grouped[cat].length})
              </span>
            </h2>
          </header>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Ref</th>
                <th className="px-4 py-2 text-left">Title</th>
                <th className="px-4 py-2 text-left">Owner</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Maturity</th>
                <th className="px-4 py-2 text-left">Evidence</th>
                <th className="px-4 py-2 text-left">Open gaps</th>
                <th className="px-4 py-2 text-left">Last review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grouped[cat].map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-xs font-mono text-gray-700">
                    <Link
                      href={`/compliance/${slug}/${c.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {c.controlRef}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-800">{c.title}</td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {c.owner?.displayName ?? <span className="text-gray-400">Unassigned</span>}
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        STATUS_COLORS[c.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {c.maturity}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {c._count.evidence}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {c._count.gaps > 0 ? (
                      <span className="text-red-700 font-semibold">
                        {c._count.gaps}
                      </span>
                    ) : (
                      <span className="text-gray-400">0</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-xs text-gray-700">
                    {c.lastReviewedAt
                      ? c.lastReviewedAt.toISOString().slice(0, 10)
                      : <span className="text-gray-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
