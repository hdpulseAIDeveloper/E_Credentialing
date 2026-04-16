import { db } from "@/server/db";
import Link from "next/link";

interface SearchParams {
  q?: string;
  page?: string;
}

function fmt(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function scoreColor(score: number): string {
  if (score >= 90) return "text-green-700 bg-green-100";
  if (score >= 70) return "text-yellow-700 bg-yellow-100";
  return "text-red-700 bg-red-100";
}

export default async function ScorecardsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const q = params.q || "";
  const page = Math.max(1, parseInt(params.page || "1", 10));
  const PAGE_SIZE = 25;

  const where: Record<string, unknown> = { status: "APPROVED" };
  if (q) {
    where.OR = [
      { legalFirstName: { contains: q, mode: "insensitive" } },
      { legalLastName: { contains: q, mode: "insensitive" } },
    ];
  }

  const [total, providers] = await Promise.all([
    db.provider.count({ where }),
    db.provider.findMany({
      where,
      include: {
        providerType: true,
        verificationRecords: { select: { status: true } },
        sanctionsChecks: { orderBy: { runDate: "desc" }, take: 1 },
        expirables: { select: { status: true } },
        recredentialingCycles: {
          where: { status: { not: "COMPLETED" } },
          orderBy: { dueDate: "asc" },
          take: 1,
        },
        documents: { select: { id: true } },
        checklistItems: { select: { status: true } },
        npdbRecords: {
          select: { id: true, result: true, isAcknowledged: true },
          orderBy: { queryDate: "desc" as const },
          take: 1,
        },
        cmeCredits: {
          select: { credits: true },
        },
      },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      orderBy: { legalLastName: "asc" },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const scorecards = providers.map((p) => {
    const verifications = p.verificationRecords;
    const verifiedCount = verifications.filter((v) => v.status === "VERIFIED").length;
    const psvScore = verifications.length > 0 ? Math.round((verifiedCount / verifications.length) * 100) : 0;

    const sanctionsClear = p.sanctionsChecks.length > 0 && p.sanctionsChecks[0].result === "CLEAR";
    const sanctionsScore = sanctionsClear ? 100 : 0;

    const expirables = p.expirables;
    const currentExp = expirables.filter((e) => e.status === "CURRENT" || e.status === "RENEWED").length;
    const expScore = expirables.length > 0 ? Math.round((currentExp / expirables.length) * 100) : 100;

    const checklistTotal = p.checklistItems.length;
    const checklistReceived = p.checklistItems.filter((c) => c.status === "RECEIVED").length;
    const docScore = checklistTotal > 0 ? Math.round((checklistReceived / checklistTotal) * 100) : 0;

    const recredOnTime = p.recredentialingCycles.length === 0 || p.recredentialingCycles[0].status !== "OVERDUE";
    const recredScore = recredOnTime ? 100 : 0;

    const npdbScore = (() => {
      const latest = (p as any).npdbRecords?.[0];
      if (!latest) return 0;
      if (latest.result === "NO_REPORTS") return 100;
      if (latest.isAcknowledged) return 80;
      return 30;
    })();

    const cmeScore = (() => {
      const totalCredits = ((p as any).cmeCredits || []).reduce((sum: number, c: any) => sum + c.credits, 0);
      return Math.min(100, Math.round((totalCredits / 50) * 100));
    })();

    const overall = Math.round(
      (psvScore * 0.20 + sanctionsScore * 0.20 + expScore * 0.15 + docScore * 0.10 + recredScore * 0.15 + npdbScore * 0.10 + cmeScore * 0.10)
    );

    return {
      id: p.id,
      name: `${p.legalFirstName} ${p.legalLastName}`,
      type: p.providerType.abbreviation,
      npi: p.npi || "—",
      overall,
      psvScore,
      sanctionsScore,
      expScore,
      docScore,
      recredScore,
      npdbScore,
      cmeScore,
      approvedAt: p.approvedAt,
    };
  });

  function buildUrl(overrides: Record<string, string>): string {
    const p = new URLSearchParams();
    const merged = { q, page: String(page), ...overrides };
    for (const [k, v] of Object.entries(merged)) {
      if (v && !(k === "page" && v === "1")) p.set(k, v);
    }
    const qs = p.toString();
    return qs ? `/scorecards?${qs}` : "/scorecards";
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Provider Performance Scorecards</h1>
        <p className="text-gray-500 mt-1">
          Compliance scorecards for all approved providers — {total} provider{total !== 1 ? "s" : ""}
        </p>
      </div>

      <form method="get" className="flex gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label htmlFor="q" className="block text-xs font-medium text-gray-500 mb-1">Search</label>
          <input
            id="q" type="text" name="q" defaultValue={q}
            placeholder="Provider name…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">
          Search
        </button>
        {q && (
          <Link href="/scorecards" className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
            Clear
          </Link>
        )}
      </form>

      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Provider</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">NPI</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Overall</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">PSV</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Sanctions</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Expirables</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Documents</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">Recred</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">NPDB</th>
                <th className="text-center px-3 py-2 text-xs font-medium text-gray-500 uppercase">CME</th>
                <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase">Approved</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scorecards.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-3 py-6 text-center text-gray-500">
                    No approved providers found.
                  </td>
                </tr>
              ) : (
                scorecards.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">
                      <Link href={`/providers/${s.id}`} className="text-blue-600 hover:underline font-medium text-sm">
                        {s.name}
                      </Link>
                      <div className="text-[11px] text-gray-400">{s.type}</div>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-700 font-mono">{s.npi}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${scoreColor(s.overall)}`}>
                        {s.overall}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.psvScore)}`}>
                        {s.psvScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.sanctionsScore)}`}>
                        {s.sanctionsScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.expScore)}`}>
                        {s.expScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.docScore)}`}>
                        {s.docScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.recredScore)}`}>
                        {s.recredScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.npdbScore)}`}>
                        {s.npdbScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${scoreColor(s.cmeScore)}`}>
                        {s.cmeScore}%
                      </span>
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">{fmt(s.approvedAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500">Page {page} of {totalPages} ({total} total)</p>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={buildUrl({ page: String(page - 1) })} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                ← Previous
              </Link>
            ) : (
              <span className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-lg cursor-not-allowed">← Previous</span>
            )}
            {page < totalPages ? (
              <Link href={buildUrl({ page: String(page + 1) })} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                Next →
              </Link>
            ) : (
              <span className="px-4 py-2 text-sm font-medium text-gray-400 bg-gray-50 border border-gray-200 rounded-lg cursor-not-allowed">Next →</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
