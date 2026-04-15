"use client";

import { useState, useMemo } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { api } from "@/trpc/react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface AuditTrailPanelProps {
  providerId: string;
}

type AuditLog = {
  id: string;
  timestamp: Date;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  providerId: string | null;
  beforeState: Record<string, unknown> | null;
  afterState: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  actor: { id: string; displayName: string; role: string } | null;
};

// ─── Action category config ──────────────────────────────────────────────────

type ActionCategory =
  | "status"
  | "document"
  | "task"
  | "enrollment"
  | "committee"
  | "bot"
  | "sanctions"
  | "general";

const CATEGORY_CONFIG: Record<
  ActionCategory,
  { label: string; dotColor: string; bgColor: string; textColor: string; icon: string }
> = {
  status: {
    label: "Status Changes",
    dotColor: "bg-blue-500",
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    icon: "↔",
  },
  document: {
    label: "Documents",
    dotColor: "bg-green-500",
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    icon: "📄",
  },
  task: {
    label: "Tasks",
    dotColor: "bg-yellow-500",
    bgColor: "bg-yellow-50",
    textColor: "text-yellow-700",
    icon: "✓",
  },
  enrollment: {
    label: "Enrollments",
    dotColor: "bg-purple-500",
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    icon: "🏥",
  },
  committee: {
    label: "Committee",
    dotColor: "bg-indigo-500",
    bgColor: "bg-indigo-50",
    textColor: "text-indigo-700",
    icon: "👥",
  },
  bot: {
    label: "Verifications",
    dotColor: "bg-cyan-500",
    bgColor: "bg-cyan-50",
    textColor: "text-cyan-700",
    icon: "🤖",
  },
  sanctions: {
    label: "Sanctions / NPDB",
    dotColor: "bg-red-500",
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    icon: "⚠",
  },
  general: {
    label: "General",
    dotColor: "bg-gray-400",
    bgColor: "bg-gray-50",
    textColor: "text-gray-700",
    icon: "●",
  },
};

const ACTION_CATEGORY_MAP: Record<string, ActionCategory> = {
  "provider.status": "status",
  "provider.created": "general",
  "provider.updated": "general",
  "provider.invite": "general",
  "provider.application": "general",
  "document.": "document",
  "checklist.": "document",
  "task.": "task",
  "enrollment.": "enrollment",
  "committee.": "committee",
  "session.": "committee",
  "bot.": "bot",
  "verification.": "bot",
  "sanctions.": "sanctions",
  "npdb.": "sanctions",
  "oig.": "sanctions",
  "sam.": "sanctions",
  "medicaid.": "enrollment",
  "etin.": "enrollment",
};

function getCategory(action: string): ActionCategory {
  for (const [prefix, category] of Object.entries(ACTION_CATEGORY_MAP)) {
    if (action.startsWith(prefix)) return category;
  }
  return "general";
}

// ─── Human-readable descriptions ─────────────────────────────────────────────

function describeAction(log: AuditLog): string {
  const { action, beforeState, afterState, metadata } = log;
  const before = beforeState as Record<string, unknown> | null;
  const after = afterState as Record<string, unknown> | null;
  const meta = metadata as Record<string, unknown> | null;

  switch (action) {
    case "provider.created":
      return "Provider record created";
    case "provider.updated":
      return "Provider details updated";
    case "provider.status.changed": {
      const from = before?.status ?? "unknown";
      const to = after?.status ?? "unknown";
      return `Status changed from ${formatFieldValue(from)} to ${formatFieldValue(to)}`;
    }
    case "provider.invite.sent":
      return "Invitation sent to provider";
    case "provider.application.started":
      return "Provider started their application";
    case "provider.application.submitted":
      return "Provider submitted their application";
    case "task.created":
      return `Task created: ${meta?.title ?? after?.title ?? "Untitled"}`;
    case "task.updated":
      return `Task updated: ${meta?.title ?? ""}`;
    case "task.completed":
      return `Task completed: ${meta?.title ?? ""}`;
    case "task.assigned":
      return `Task assigned to ${meta?.assigneeName ?? after?.assignedToId ?? "someone"}`;
    case "enrollment.created":
      return `Enrollment created: ${meta?.payerName ?? after?.payerName ?? ""}`;
    case "enrollment.updated":
      return `Enrollment updated: ${meta?.payerName ?? ""}`;
    case "enrollment.status.changed": {
      const from = before?.status ?? "unknown";
      const to = after?.status ?? "unknown";
      return `Enrollment status: ${formatFieldValue(from)} → ${formatFieldValue(to)}`;
    }
    case "document.uploaded":
      return `Document uploaded: ${meta?.fileName ?? meta?.documentName ?? ""}`;
    case "document.verified":
      return `Document verified: ${meta?.documentName ?? ""}`;
    case "document.rejected":
      return `Document rejected: ${meta?.documentName ?? ""}`;
    case "checklist.item.completed":
      return `Checklist item completed: ${meta?.itemName ?? ""}`;
    case "committee.added":
      return "Provider added to committee session";
    case "committee.approved":
      return "Provider approved by committee";
    case "committee.deferred":
      return "Provider deferred by committee";
    case "committee.denied":
      return "Provider denied by committee";
    case "session.created":
      return "Committee session created";
    case "bot.queued":
      return `Verification bot queued: ${meta?.botType ?? meta?.credentialType ?? ""}`;
    case "bot.started":
      return `Verification bot started: ${meta?.botType ?? ""}`;
    case "bot.completed":
      return `Verification completed: ${meta?.botType ?? ""}`;
    case "bot.failed":
      return `Verification failed: ${meta?.botType ?? ""} — ${meta?.error ?? ""}`;
    case "verification.completed":
      return `Verification completed: ${meta?.credentialType ?? ""}`;
    case "sanctions.check.completed":
      return `Sanctions check completed${meta?.source ? ` (${meta.source})` : ""}`;
    case "sanctions.match.found":
      return `Sanctions match found on ${meta?.source ?? "external list"}`;
    case "npdb.query.submitted":
      return "NPDB query submitted";
    case "npdb.response.received":
      return "NPDB response received";
    default:
      return action
        .replace(/\./g, " › ")
        .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
  }
}

function formatFieldValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    return value
      .replace(/_/g, " ")
      .replace(/(^|\s)\w/g, (c) => c.toUpperCase());
  }
  return String(value);
}

// ─── Relative time helper ────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(date).toLocaleDateString();
}

// ─── Diff viewer ─────────────────────────────────────────────────────────────

function getChangedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown> | null,
): { key: string; from: unknown; to: unknown }[] {
  if (!before && !after) return [];
  if (!before && after) {
    return Object.entries(after).map(([key, to]) => ({ key, from: null, to }));
  }
  if (before && !after) return [];

  const changes: { key: string; from: unknown; to: unknown }[] = [];
  const allKeys = new Set([...Object.keys(before!), ...Object.keys(after!)]);
  for (const key of allKeys) {
    const fromVal = before![key];
    const toVal = after![key];
    if (JSON.stringify(fromVal) !== JSON.stringify(toVal)) {
      changes.push({ key, from: fromVal, to: toVal });
    }
  }
  return changes;
}

function formatFieldName(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/_/g, " ")
    .replace(/(^|\s)\w/g, (c) => c.toUpperCase())
    .trim();
}

// ─── Filter options ──────────────────────────────────────────────────────────

const FILTER_OPTIONS: { value: ActionCategory | "all"; label: string }[] = [
  { value: "all", label: "All Actions" },
  { value: "status", label: "Status Changes" },
  { value: "document", label: "Documents" },
  { value: "task", label: "Tasks" },
  { value: "enrollment", label: "Enrollments" },
  { value: "committee", label: "Committee" },
  { value: "bot", label: "Verifications" },
  { value: "sanctions", label: "Sanctions / NPDB" },
  { value: "general", label: "General" },
];

const PAGE_SIZE = 25;

// ─── Component ───────────────────────────────────────────────────────────────

export function AuditTrailPanel({ providerId }: AuditTrailPanelProps) {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<ActionCategory | "all">("all");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching } = api.provider.getAuditTrail.useQuery(
    { providerId, page: 1, limit: page * PAGE_SIZE },
    { placeholderData: keepPreviousData },
  );

  const logs = (data?.logs ?? []) as AuditLog[];
  const total = data?.total ?? 0;

  const filteredLogs = useMemo(() => {
    if (filter === "all") return logs;
    return logs.filter((log) => getCategory(log.action) === filter);
  }, [logs, filter]);

  const hasMore = logs.length < total;

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── Loading state ──
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Audit Trail</h3>
        </div>
        <div className="p-8 flex flex-col items-center gap-3">
          <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-gray-500">Loading audit trail…</span>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (total === 0) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-gray-900">Audit Trail</h3>
        </div>
        <div className="p-12 flex flex-col items-center gap-3">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center text-xl text-gray-400">
            📋
          </div>
          <p className="text-gray-500 text-sm">No audit entries recorded yet.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      {/* Header + filter */}
      <div className="p-4 border-b flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h3 className="font-semibold text-gray-900">Audit Trail</h3>
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-medium">
            {total} {total === 1 ? "entry" : "entries"}
          </span>
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as ActionCategory | "all")}
          className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          {FILTER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      <div className="px-6 py-4">
        {filteredLogs.length === 0 ? (
          <div className="py-8 text-center text-sm text-gray-500">
            No entries match the selected filter.
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-200" />

            <div className="space-y-0">
              {filteredLogs.map((log, idx) => {
                const category = getCategory(log.action);
                const config = CATEGORY_CONFIG[category];
                const changes = getChangedFields(
                  log.beforeState as Record<string, unknown> | null,
                  log.afterState as Record<string, unknown> | null,
                );
                const isExpanded = expandedIds.has(log.id);
                const isLast = idx === filteredLogs.length - 1;

                return (
                  <div key={log.id} className={`relative flex gap-4 ${isLast ? "" : "pb-6"}`}>
                    {/* Dot */}
                    <div className="relative z-10 flex-shrink-0 mt-1">
                      <div
                        className={`h-6 w-6 rounded-full ${config.dotColor} flex items-center justify-center text-white text-xs shadow-sm`}
                        title={config.label}
                      >
                        <span className="leading-none">{config.icon}</span>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          {/* Action description */}
                          <p className="text-sm font-medium text-gray-900 leading-snug">
                            {describeAction(log)}
                          </p>

                          {/* Actor + category badge */}
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {log.actor ? (
                              <span className="text-xs text-gray-600">
                                by{" "}
                                <span className="font-medium">{log.actor.displayName}</span>
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400 italic">System</span>
                            )}
                            {log.actor?.role && (
                              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase tracking-wide">
                                {log.actor.role}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${config.bgColor} ${config.textColor}`}
                            >
                              {config.label}
                            </span>
                          </div>
                        </div>

                        {/* Timestamp */}
                        <span
                          className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5 cursor-default"
                          title={new Date(log.timestamp).toLocaleString()}
                        >
                          {relativeTime(log.timestamp)}
                        </span>
                      </div>

                      {/* Expandable diff */}
                      {changes.length > 0 && (
                        <div className="mt-2">
                          <button
                            onClick={() => toggleExpand(log.id)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                          >
                            <svg
                              className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                            {changes.length} field{changes.length !== 1 ? "s" : ""} changed
                          </button>

                          {isExpanded && (
                            <div className="mt-2 rounded-md border border-gray-200 overflow-hidden text-xs">
                              <table className="w-full">
                                <thead>
                                  <tr className="bg-gray-50 text-gray-500">
                                    <th className="text-left px-3 py-1.5 font-medium">Field</th>
                                    <th className="text-left px-3 py-1.5 font-medium">Before</th>
                                    <th className="text-left px-3 py-1.5 font-medium">After</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {changes.map((change) => (
                                    <tr key={change.key}>
                                      <td className="px-3 py-1.5 font-medium text-gray-700 whitespace-nowrap">
                                        {formatFieldName(change.key)}
                                      </td>
                                      <td className="px-3 py-1.5 text-red-600 max-w-[200px] truncate">
                                        {change.from !== null && change.from !== undefined
                                          ? formatFieldValue(change.from)
                                          : <span className="text-gray-300 italic">empty</span>}
                                      </td>
                                      <td className="px-3 py-1.5 text-green-600 max-w-[200px] truncate">
                                        {change.to !== null && change.to !== undefined
                                          ? formatFieldValue(change.to)
                                          : <span className="text-gray-300 italic">empty</span>}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="px-6 pb-4 pt-0">
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching}
            className="w-full py-2.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors"
          >
            {isFetching ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                Loading…
              </span>
            ) : (
              `Load More (${logs.length} of ${total})`
            )}
          </button>
        </div>
      )}
    </div>
  );
}
