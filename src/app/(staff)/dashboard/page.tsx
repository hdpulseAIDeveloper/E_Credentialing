import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { PipelineTable } from "@/components/dashboard/PipelineTable";
import { TaskList } from "@/components/dashboard/TaskList";
import {
  PSV_SLA_INITIAL_DAYS,
  PSV_SLA_RECRED_DAYS,
} from "@/lib/psv-sla";

const STATUS_COLORS: Record<string, string> = {
  INVITED: "#94a3b8",
  ONBOARDING_IN_PROGRESS: "#60a5fa",
  DOCUMENTS_PENDING: "#f59e0b",
  VERIFICATION_IN_PROGRESS: "#a78bfa",
  COMMITTEE_READY: "#fbbf24",
  COMMITTEE_IN_REVIEW: "#fb923c",
  APPROVED: "#34d399",
  DENIED: "#f87171",
  DEFERRED: "#d1d5db",
  INACTIVE: "#9ca3af",
};

const STATUS_LABELS: Record<string, string> = {
  INVITED: "Invited",
  ONBOARDING_IN_PROGRESS: "Onboarding",
  DOCUMENTS_PENDING: "Docs Pending",
  VERIFICATION_IN_PROGRESS: "Verification",
  COMMITTEE_READY: "Committee Ready",
  COMMITTEE_IN_REVIEW: "In Review",
  APPROVED: "Approved",
  DENIED: "Denied",
  DEFERRED: "Deferred",
  INACTIVE: "Inactive",
};

function daysUntil(date: Date): number {
  const now = new Date();
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function daysOverdue(date: Date): number {
  const now = new Date();
  return Math.ceil((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) return null;

  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  // P0 Gap #7 — NCQA PSV SLA breach windows.
  // Initial: app submitted ≥ 90 days ago AND not yet approved → overdue.
  // Initial at-risk: app submitted ≥ 60 days ago AND not yet approved.
  // Recred: cycle started ≥ 120 days ago AND not yet completed → overdue.
  // Recred at-risk: cycle started ≥ 90 days ago AND not yet completed.
  const now = new Date();
  const initialOverdueCutoff = new Date(
    now.getTime() - PSV_SLA_INITIAL_DAYS * 24 * 60 * 60 * 1000
  );
  const initialAtRiskCutoff = new Date(
    now.getTime() - (PSV_SLA_INITIAL_DAYS - 30) * 24 * 60 * 60 * 1000
  );
  const recredOverdueCutoff = new Date(
    now.getTime() - PSV_SLA_RECRED_DAYS * 24 * 60 * 60 * 1000
  );
  const recredAtRiskCutoff = new Date(
    now.getTime() - (PSV_SLA_RECRED_DAYS - 30) * 24 * 60 * 60 * 1000
  );

  const [
    providers,
    tasks,
    totalProviders,
    inOnboarding,
    inVerification,
    committeeReady,
    approved,
    expiringCount,
    statusDistribution,
    upcomingExpirations,
    overdueFollowUps,
    recentActivity,
    recredOverdue,
    evalsDueSoon,
    workHistoryPending,
    referencesPending,
  ] = await Promise.all([
    db.provider.findMany({
      where: {
        status: { notIn: ["APPROVED", "DENIED", "INACTIVE"] },
      },
      include: {
        providerType: true,
        assignedSpecialist: { select: { id: true, displayName: true } },
        checklistItems: { select: { status: true } },
      },
      orderBy: { updatedAt: "desc" },
      take: 50,
    }),
    db.task.findMany({
      where: {
        assignedToId: session.user.id,
        status: { in: ["OPEN", "IN_PROGRESS"] },
      },
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
      },
      orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      take: 10,
    }),
    db.provider.count(),
    db.provider.count({
      where: { status: { in: ["INVITED", "ONBOARDING_IN_PROGRESS", "DOCUMENTS_PENDING"] } },
    }),
    db.provider.count({ where: { status: "VERIFICATION_IN_PROGRESS" } }),
    db.provider.count({ where: { status: "COMMITTEE_READY" } }),
    db.provider.count({ where: { status: "APPROVED" } }),
    db.expirable.count({
      where: {
        status: { not: "RENEWED" },
        expirationDate: { gte: new Date(), lte: thirtyDaysFromNow },
      },
    }),
    db.provider.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    db.expirable.findMany({
      where: {
        status: { not: "RENEWED" },
        expirationDate: { gte: new Date() },
      },
      orderBy: { expirationDate: "asc" },
      take: 5,
      include: {
        provider: { select: { legalFirstName: true, legalLastName: true } },
      },
    }),
    db.enrollment.findMany({
      where: {
        followUpDueDate: { lt: new Date() },
        status: { notIn: ["ENROLLED", "DENIED", "WITHDRAWN"] },
      },
      take: 5,
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
      },
      orderBy: { followUpDueDate: "asc" },
    }),
    db.auditLog.findMany({
      include: {
        actor: { select: { displayName: true } },
        provider: { select: { legalFirstName: true, legalLastName: true } },
      },
      orderBy: { timestamp: "desc" },
      take: 10,
    }),
    // New module integration queries
    db.recredentialingCycle.count({
      where: {
        status: "OVERDUE",
      },
    }),
    db.practiceEvaluation.count({
      where: {
        status: { in: ["SCHEDULED", "OVERDUE"] },
        dueDate: {
          lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    db.workHistoryVerification.count({
      where: {
        status: "SENT",
        requestSentAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
    db.professionalReference.count({
      where: {
        status: "SENT",
        requestSentAt: {
          lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        },
      },
    }),
  ]);

  // P1 Gap #9 — Continuous monitoring alert counts (open + new in last 24h).
  const [
    monitoringCritical,
    monitoringWarning,
    monitoringNew24h,
  ] = await Promise.all([
    db.monitoringAlert.count({
      where: { status: "OPEN", severity: "CRITICAL" },
    }),
    db.monitoringAlert.count({
      where: { status: "OPEN", severity: "WARNING" },
    }),
    db.monitoringAlert.count({
      where: { detectedAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
    }),
  ]);

  // PSV SLA breach metrics — separate query block so the dashboard renders
  // even if these counts are 0. We exclude already-approved providers from
  // initial breaches and already-completed cycles from recred breaches.
  const [
    initialPsvOverdue,
    initialPsvAtRisk,
    recredPsvOverdue,
    recredPsvAtRisk,
  ] = await Promise.all([
    db.provider.count({
      where: {
        applicationSubmittedAt: { lte: initialOverdueCutoff, not: null },
        approvedAt: null,
        status: { notIn: ["DENIED", "INACTIVE", "DEFERRED"] },
      },
    }),
    db.provider.count({
      where: {
        applicationSubmittedAt: {
          lte: initialAtRiskCutoff,
          gt: initialOverdueCutoff,
        },
        approvedAt: null,
        status: { notIn: ["DENIED", "INACTIVE", "DEFERRED"] },
      },
    }),
    db.recredentialingCycle.count({
      where: {
        startedAt: { lte: recredOverdueCutoff, not: null },
        completedAt: null,
        status: { notIn: ["COMPLETED"] },
      },
    }),
    db.recredentialingCycle.count({
      where: {
        startedAt: {
          lte: recredAtRiskCutoff,
          gt: recredOverdueCutoff,
        },
        completedAt: null,
        status: { notIn: ["COMPLETED"] },
      },
    }),
  ]);

  const statusMap = new Map(
    statusDistribution.map((s) => [s.status, s._count.status])
  );
  const totalForBar = statusDistribution.reduce((sum, s) => sum + s._count.status, 0);

  const statCards = [
    { label: "Total Providers", value: totalProviders, color: "text-gray-800", bg: "bg-gray-50", border: "border-gray-200" },
    { label: "In Onboarding", value: inOnboarding, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
    { label: "In Verification", value: inVerification, color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
    { label: "Committee Ready", value: committeeReady, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
    { label: "Approved", value: approved, color: "text-green-600", bg: "bg-green-50", border: "border-green-200" },
    { label: "Expiring (30d)", value: expiringCount, color: "text-red-600", bg: "bg-red-50", border: "border-red-200" },
  ];

  const orderedStatuses = [
    "INVITED",
    "ONBOARDING_IN_PROGRESS",
    "DOCUMENTS_PENDING",
    "VERIFICATION_IN_PROGRESS",
    "COMMITTEE_READY",
    "COMMITTEE_IN_REVIEW",
    "APPROVED",
    "DENIED",
    "DEFERRED",
    "INACTIVE",
  ] as const;

  const statusMapStr = new Map(
    statusDistribution.map((s) => [s.status as string, s._count.status])
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Credentialing Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Provider credentialing operations overview</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`${card.bg} rounded-lg border ${card.border} px-3 py-2.5`}
          >
            <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Status Distribution Bar */}
      {totalForBar > 0 && (
        <div className="bg-white rounded-lg border px-4 py-3">
          <h2 className="text-xs font-medium text-gray-700 mb-2">Provider Status Distribution</h2>
          <div className="flex rounded-full overflow-hidden h-6">
            {orderedStatuses.map((status) => {
              const count = statusMapStr.get(status) ?? 0;
              if (count === 0) return null;
              const pct = (count / totalForBar) * 100;
              return (
                <div
                  key={status}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: STATUS_COLORS[status],
                    minWidth: count > 0 ? "8px" : undefined,
                  }}
                  className="relative group transition-opacity hover:opacity-80"
                  title={`${STATUS_LABELS[status]}: ${count}`}
                >
                  {pct > 8 && (
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white drop-shadow-sm">
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2">
            {orderedStatuses.map((status) => {
              const count = statusMapStr.get(status) ?? 0;
              if (count === 0) return null;
              return (
                <div key={status} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: STATUS_COLORS[status] }}
                  />
                  {STATUS_LABELS[status]} ({count})
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content: Pipeline + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Pipeline Table */}
        <div className="lg:col-span-2">
          <PipelineTable providers={providers as Parameters<typeof PipelineTable>[0]["providers"]} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* My Tasks */}
          <TaskList tasks={tasks as Parameters<typeof TaskList>[0]["tasks"]} />

          {/* Upcoming Expirations */}
          <div className="bg-white rounded-lg border">
            <div className="px-3 py-2 border-b">
              <a href="/expirables" className="text-xs font-semibold text-gray-900 hover:text-blue-600">Upcoming Expirations →</a>
            </div>
            {upcomingExpirations.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">
                No upcoming expirations
              </div>
            ) : (
              <ul className="divide-y">
                {upcomingExpirations.map((exp) => {
                  const days = daysUntil(exp.expirationDate);
                  const urgency =
                    days <= 7 ? "text-red-600 bg-red-50" :
                    days <= 14 ? "text-orange-600 bg-orange-50" :
                    "text-yellow-600 bg-yellow-50";
                  return (
                    <li key={exp.id} className="px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {exp.provider.legalFirstName} {exp.provider.legalLastName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {exp.expirableType.replace(/_/g, " ")} &middot; {formatDate(exp.expirationDate)}
                        </div>
                      </div>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${urgency}`}>
                        {days}d left
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Overdue Follow-ups */}
          <div className="bg-white rounded-lg border">
            <div className="px-3 py-2 border-b">
              <a href="/enrollments?status=overdue" className="text-xs font-semibold text-gray-900 hover:text-blue-600">Overdue Follow-ups →</a>
            </div>
            {overdueFollowUps.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">
                No overdue follow-ups
              </div>
            ) : (
              <ul className="divide-y">
                {overdueFollowUps.map((enr) => {
                  const overdue = daysOverdue(enr.followUpDueDate!);
                  return (
                    <li key={enr.id} className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">
                            {enr.provider.legalFirstName} {enr.provider.legalLastName}
                          </div>
                          <div className="text-xs text-gray-500">
                            {enr.payerName} &middot; {enr.status.replace(/_/g, " ")}
                          </div>
                        </div>
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap text-red-600 bg-red-50">
                          {overdue}d overdue
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* PSV SLA Health (NCQA CR 4) */}
          <div className="bg-white rounded-lg border">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <h2 className="text-xs font-semibold text-gray-900">
                PSV SLA Health
                <span className="ml-1 font-normal text-gray-400">
                  · 90d initial / 120d recred
                </span>
              </h2>
            </div>
            <ul className="divide-y">
              <li className="px-3 py-2">
                <a
                  href="/providers?slaBreach=initial"
                  className="flex items-center justify-between hover:text-blue-600"
                >
                  <span className="text-sm text-gray-900">
                    Initial PSV breached (&gt;{PSV_SLA_INITIAL_DAYS}d)
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      initialPsvOverdue > 0
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {initialPsvOverdue}
                  </span>
                </a>
              </li>
              <li className="px-3 py-2">
                <a
                  href="/providers?slaBreach=initial-at-risk"
                  className="flex items-center justify-between hover:text-blue-600"
                >
                  <span className="text-sm text-gray-900">
                    Initial PSV at risk (&lt;30d remaining)
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      initialPsvAtRisk > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {initialPsvAtRisk}
                  </span>
                </a>
              </li>
              <li className="px-3 py-2">
                <a
                  href="/recredentialing?slaBreach=overdue"
                  className="flex items-center justify-between hover:text-blue-600"
                >
                  <span className="text-sm text-gray-900">
                    Recred PSV breached (&gt;{PSV_SLA_RECRED_DAYS}d)
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      recredPsvOverdue > 0
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {recredPsvOverdue}
                  </span>
                </a>
              </li>
              <li className="px-3 py-2">
                <a
                  href="/recredentialing?slaBreach=at-risk"
                  className="flex items-center justify-between hover:text-blue-600"
                >
                  <span className="text-sm text-gray-900">
                    Recred PSV at risk (&lt;30d remaining)
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      recredPsvAtRisk > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {recredPsvAtRisk}
                  </span>
                </a>
              </li>
            </ul>
          </div>

          {/* Continuous Monitoring Alerts (P1 Gap #9) */}
          <div className="bg-white rounded-lg border">
            <div className="px-3 py-2 border-b flex items-center justify-between">
              <a
                href="/monitoring"
                className="text-xs font-semibold text-gray-900 hover:text-blue-600"
              >
                Continuous Monitoring →
              </a>
              <span className="text-[10px] text-gray-400">
                {monitoringNew24h} new in 24h
              </span>
            </div>
            <ul className="divide-y">
              <li className="px-3 py-2">
                <a
                  href="/monitoring?status=OPEN&severity=CRITICAL"
                  className="flex items-center justify-between hover:text-blue-600"
                >
                  <span className="text-sm text-gray-900">
                    Critical alerts open
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      monitoringCritical > 0
                        ? "bg-red-50 text-red-600"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {monitoringCritical}
                  </span>
                </a>
              </li>
              <li className="px-3 py-2">
                <a
                  href="/monitoring?status=OPEN&severity=WARNING"
                  className="flex items-center justify-between hover:text-blue-600"
                >
                  <span className="text-sm text-gray-900">
                    Warning alerts open
                  </span>
                  <span
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      monitoringWarning > 0
                        ? "bg-amber-50 text-amber-700"
                        : "bg-green-50 text-green-600"
                    }`}
                  >
                    {monitoringWarning}
                  </span>
                </a>
              </li>
            </ul>
          </div>

          {/* Cross-Module Alerts */}
          {(recredOverdue > 0 || evalsDueSoon > 0 || workHistoryPending + referencesPending > 0) && (
            <div className="bg-white rounded-lg border">
              <div className="px-3 py-2 border-b">
                <h2 className="text-xs font-semibold text-gray-900">Module Alerts</h2>
              </div>
              <ul className="divide-y">
                {recredOverdue > 0 && (
                  <li className="px-3 py-2">
                    <a href="/recredentialing?status=OVERDUE" className="flex items-center justify-between hover:text-blue-600">
                      <span className="text-sm text-gray-900">Recredentialing Overdue</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">{recredOverdue}</span>
                    </a>
                  </li>
                )}
                {evalsDueSoon > 0 && (
                  <li className="px-3 py-2">
                    <a href="/evaluations" className="flex items-center justify-between hover:text-blue-600">
                      <span className="text-sm text-gray-900">OPPE/FPPE Due Soon</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">{evalsDueSoon}</span>
                    </a>
                  </li>
                )}
                {workHistoryPending + referencesPending > 0 && (
                  <li className="px-3 py-2">
                    <a href="/verifications" className="flex items-center justify-between hover:text-blue-600">
                      <span className="text-sm text-gray-900">Pending Verifications (7d+)</span>
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-600">{workHistoryPending + referencesPending}</span>
                    </a>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border">
            <div className="px-3 py-2 border-b">
              <h2 className="text-xs font-semibold text-gray-900">Recent Activity</h2>
            </div>
            {recentActivity.length === 0 ? (
              <div className="px-3 py-4 text-center text-sm text-gray-400">
                No recent activity
              </div>
            ) : (
              <ul className="divide-y">
                {recentActivity.map((log) => (
                  <li key={log.id} className="px-3 py-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900">
                          <span className="font-medium">{log.actor?.displayName ?? "System"}</span>{" "}
                          {log.action.replace(/_/g, " ").toLowerCase()}{" "}
                          {log.provider && (
                            <span className="text-gray-600">
                              — {log.provider.legalFirstName} {log.provider.legalLastName}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {log.entityType} &middot; {formatDate(log.timestamp)}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
