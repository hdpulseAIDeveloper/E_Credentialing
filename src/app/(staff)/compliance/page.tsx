import { auth } from "@/server/auth";
import { db } from "@/server/db";
import Link from "next/link";

function ComplianceCard({
  title,
  description,
  compliant,
  total,
  status,
}: {
  title: string;
  description: string;
  compliant: number;
  total: number;
  status: "compliant" | "non-compliant" | "partial";
}) {
  const pct = total > 0 ? Math.round((compliant / total) * 100) : 0;
  const statusConfig = {
    compliant: { label: "Compliant", bg: "bg-green-50", border: "border-green-200", text: "text-green-700", dot: "bg-green-500" },
    "non-compliant": { label: "Non-Compliant", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", dot: "bg-red-500" },
    partial: { label: "Partial", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", dot: "bg-yellow-500" },
  }[status];

  return (
    <div className={`rounded-lg border ${statusConfig.border} ${statusConfig.bg} p-4`}>
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <span className={`flex items-center gap-1.5 text-xs font-medium ${statusConfig.text}`}>
          <span className={`w-2 h-2 rounded-full ${statusConfig.dot}`} />
          {statusConfig.label}
        </span>
      </div>
      <p className="text-xs text-gray-600 mb-3">{description}</p>
      <div className="flex items-center gap-3">
        <div className="flex-1 bg-white rounded-full h-2 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              status === "compliant" ? "bg-green-500" : status === "partial" ? "bg-yellow-500" : "bg-red-500"
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs font-medium text-gray-700 whitespace-nowrap">
          {compliant}/{total} ({pct}%)
        </span>
      </div>
    </div>
  );
}

export default async function CompliancePage() {
  const session = await auth();
  if (!session?.user) return null;

  const approvedProviders = await db.provider.findMany({
    where: { status: "APPROVED" },
    select: {
      id: true,
      legalFirstName: true,
      legalLastName: true,
      createdAt: true,
      approvedAt: true,
      initialApprovalDate: true,
      verificationRecords: {
        select: { credentialType: true, status: true },
      },
      sanctionsChecks: {
        select: { runDate: true, source: true },
        orderBy: { runDate: "desc" },
      },
      npdbRecords: {
        select: { queryDate: true, queryType: true },
      },
      checklistItems: {
        select: { status: true },
      },
      recredentialingCycles: {
        select: { status: true, dueDate: true },
        orderBy: { dueDate: "desc" },
      },
    },
  });

  const allProviders = await db.provider.findMany({
    where: { status: { notIn: ["DENIED", "INACTIVE"] } },
    select: { id: true, createdAt: true, status: true, approvedAt: true },
  });

  const totalApproved = approvedProviders.length;

  // 1. PSV completeness: license, DEA, and board verification records
  const psvComplete = approvedProviders.filter((p) => {
    const types = new Set(
      p.verificationRecords
        .filter((v) => v.status === "VERIFIED")
        .map((v) => v.credentialType)
    );
    return types.has("LICENSE") || types.has("DEA") || types.has("BOARD_NCCPA") || types.has("BOARD_ABIM") || types.has("BOARD_ABFM");
  }).length;

  // 2. Sanctions monitoring: at least one OIG + one SAM check in the last 31 days
  const thirtyOneDaysAgo = new Date();
  thirtyOneDaysAgo.setDate(thirtyOneDaysAgo.getDate() - 31);

  const sanctionsCompliant = approvedProviders.filter((p) => {
    const recentOig = p.sanctionsChecks.some(
      (s) => s.source === "OIG" && s.runDate >= thirtyOneDaysAgo
    );
    const recentSam = p.sanctionsChecks.some(
      (s) => s.source === "SAM_GOV" && s.runDate >= thirtyOneDaysAgo
    );
    return recentOig && recentSam;
  }).length;

  // 3. NPDB: all approved providers have at least one initial query
  const npdbComplete = approvedProviders.filter((p) =>
    p.npdbRecords.some((n) => n.queryType === "INITIAL")
  ).length;

  // 4. Application within 180 days: providers not yet approved whose createdAt > 180 days ago
  const oneEightyDaysAgo = new Date();
  oneEightyDaysAgo.setDate(oneEightyDaysAgo.getDate() - 180);

  const pendingProviders = allProviders.filter(
    (p) => p.status !== "APPROVED" && p.status !== "DENIED" && p.status !== "INACTIVE"
  );
  const withinTimeline = pendingProviders.filter(
    (p) => p.createdAt >= oneEightyDaysAgo
  ).length;
  const totalPending = pendingProviders.length;

  // 5. Recredentialing: all approved providers have at least one active cycle
  const recredActive = approvedProviders.filter((p) =>
    p.recredentialingCycles.some(
      (c) => c.status !== "COMPLETED" && c.status !== "OVERDUE"
    )
  ).length;

  // 6. File completeness: all checklist items are RECEIVED
  const filesComplete = approvedProviders.filter((p) =>
    p.checklistItems.length > 0 &&
    p.checklistItems.every((c) => c.status === "RECEIVED")
  ).length;

  const checks = [
    {
      title: "Primary Source Verification",
      description: "All approved providers must have at least one verified PSV record (license, DEA, or board) from primary sources.",
      compliant: psvComplete,
      total: totalApproved,
      status: psvComplete === totalApproved ? "compliant" : psvComplete > totalApproved * 0.8 ? "partial" : "non-compliant",
    },
    {
      title: "OIG/SAM Sanctions Monitoring",
      description: "Weekly OIG and SAM.gov exclusion checks required for all approved providers.",
      compliant: sanctionsCompliant,
      total: totalApproved,
      status: sanctionsCompliant === totalApproved ? "compliant" : sanctionsCompliant > totalApproved * 0.8 ? "partial" : "non-compliant",
    },
    {
      title: "NPDB Queries",
      description: "All approved providers must have an initial NPDB query on file.",
      compliant: npdbComplete,
      total: totalApproved,
      status: npdbComplete === totalApproved ? "compliant" : npdbComplete > totalApproved * 0.8 ? "partial" : "non-compliant",
    },
    {
      title: "Application Within 180 Days",
      description: "Applications must be processed within 180 calendar days of initiation.",
      compliant: withinTimeline,
      total: totalPending,
      status: totalPending === 0 ? "compliant" : withinTimeline === totalPending ? "compliant" : withinTimeline > totalPending * 0.8 ? "partial" : "non-compliant",
    },
    {
      title: "Recredentialing Every 36 Months",
      description: "All approved providers must have an active recredentialing cycle within the 36-month window.",
      compliant: recredActive,
      total: totalApproved,
      status: recredActive === totalApproved ? "compliant" : recredActive > totalApproved * 0.8 ? "partial" : "non-compliant",
    },
    {
      title: "Provider File Completeness",
      description: "All approved provider credential files must have all required documents received.",
      compliant: filesComplete,
      total: totalApproved,
      status: filesComplete === totalApproved ? "compliant" : filesComplete > totalApproved * 0.8 ? "partial" : "non-compliant",
    },
  ] as const;

  const totalChecks = checks.length;
  const compliantChecks = checks.filter((c) => c.status === "compliant").length;
  const partialChecks = checks.filter((c) => c.status === "partial").length;
  const overallScore = Math.round(
    ((compliantChecks + partialChecks * 0.5) / totalChecks) * 100
  );

  const overallColor =
    overallScore >= 90 ? "text-green-600" :
    overallScore >= 70 ? "text-yellow-600" :
    "text-red-600";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">NCQA Compliance Readiness</h1>
          <p className="text-gray-500 text-sm mt-0.5">CVO standards compliance dashboard</p>
        </div>
        <Link
          href="/reports"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          View Reports →
        </Link>
      </div>

      {/* Overall Score */}
      <div className="bg-white rounded-lg border p-6 flex items-center gap-6">
        <div className="relative w-24 h-24">
          <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="8" />
            <circle
              cx="50" cy="50" r="40" fill="none"
              stroke={overallScore >= 90 ? "#22c55e" : overallScore >= 70 ? "#eab308" : "#ef4444"}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${overallScore * 2.51} 251`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className={`text-2xl font-bold ${overallColor}`}>{overallScore}%</span>
          </div>
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Overall Readiness Score</h2>
          <p className="text-sm text-gray-500 mt-1">
            {compliantChecks} of {totalChecks} requirements fully compliant
            {partialChecks > 0 && `, ${partialChecks} partially compliant`}
          </p>
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Compliant ({compliantChecks})
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" /> Partial ({partialChecks})
            </span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Non-Compliant ({totalChecks - compliantChecks - partialChecks})
            </span>
          </div>
        </div>
      </div>

      {/* Compliance Checks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {checks.map((check) => (
          <ComplianceCard key={check.title} {...check} />
        ))}
      </div>
    </div>
  );
}
