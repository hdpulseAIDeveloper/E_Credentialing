"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { formatDate } from "@/lib/format-date";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  PlayCircle,
  CheckCircle2,
  XCircle,
  UserPlus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  Clock,
  AlertTriangle,
  FileText,
  Loader2,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────────────

type SessionStatus = "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
type Decision = "APPROVED" | "DENIED" | "DEFERRED" | "CONDITIONAL";

interface ProviderEntry {
  id: string;
  agendaOrder: number;
  decision: Decision | null;
  decisionDate: string | null;
  denialReason: string | null;
  conditionalItems: string | null;
  committeeNotes: string | null;
  decisionBy: { id: string; displayName: string } | null;
  provider: {
    id: string;
    legalFirstName: string;
    legalLastName: string;
    status: string;
    providerType: { name: string };
    verificationRecords: Array<{
      id: string;
      verificationType: string;
      status: string;
      verifiedDate: string | null;
    }>;
    sanctionsChecks: Array<{
      id: string;
      checkType: string;
      result: string;
      runDate: string;
    }>;
    npdbRecords: Array<{
      id: string;
      queryDate: string;
      result: string;
    }>;
  };
}

// ─── Session Status Controls ────────────────────────────────────────────────

export function SessionStatusControls({
  sessionId,
  currentStatus,
}: {
  sessionId: string;
  currentStatus: SessionStatus;
}) {
  const router = useRouter();
  const updateStatus = api.committee.updateSessionStatus.useMutation({
    onSuccess: () => router.refresh(),
  });

  const isTerminal = currentStatus === "COMPLETED" || currentStatus === "CANCELLED";

  return (
    <div className="flex items-center gap-2">
      {currentStatus === "SCHEDULED" && (
        <Button
          size="sm"
          onClick={() => updateStatus.mutate({ id: sessionId, status: "IN_PROGRESS" })}
          disabled={updateStatus.isPending}
          className="bg-green-600 hover:bg-green-700"
        >
          {updateStatus.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <PlayCircle className="mr-1.5 h-4 w-4" />
          )}
          Start Session
        </Button>
      )}

      {currentStatus === "IN_PROGRESS" && (
        <Button
          size="sm"
          onClick={() => updateStatus.mutate({ id: sessionId, status: "COMPLETED" })}
          disabled={updateStatus.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {updateStatus.isPending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
          )}
          Complete Session
        </Button>
      )}

      {!isTerminal && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            if (confirm("Are you sure you want to cancel this session?")) {
              updateStatus.mutate({ id: sessionId, status: "CANCELLED" });
            }
          }}
          disabled={updateStatus.isPending}
          className="text-red-600 border-red-200 hover:bg-red-50"
        >
          <XCircle className="mr-1.5 h-4 w-4" />
          Cancel Session
        </Button>
      )}
    </div>
  );
}

// ─── Add Provider to Session ────────────────────────────────────────────────

export function AddProviderToSession({
  sessionId,
  existingProviderIds,
}: {
  sessionId: string;
  existingProviderIds: string[];
}) {
  const router = useRouter();
  const [selectedProviderId, setSelectedProviderId] = useState<string>("");

  const queue = api.committee.getQueue.useQuery();
  const addProvider = api.committee.addProvider.useMutation({
    onSuccess: () => {
      setSelectedProviderId("");
      router.refresh();
    },
  });

  const availableProviders = (() => {
    const data = queue.data;
    if (!data) return [];
    const all = [
      ...("initialCredentialing" in data ? data.initialCredentialing : Array.isArray(data) ? data : []),
      ...("recredentialing" in data ? data.recredentialing : []),
    ];
    return all.filter((p) => !existingProviderIds.includes(p.id));
  })();

  if (queue.isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading queue...
      </div>
    );
  }

  if (availableProviders.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No committee-ready providers available to add.
      </p>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={selectedProviderId} onValueChange={setSelectedProviderId}>
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select provider to add..." />
        </SelectTrigger>
        <SelectContent>
          {availableProviders.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.legalFirstName} {p.legalLastName} — {p.providerType.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        onClick={() => {
          if (selectedProviderId) {
            addProvider.mutate({ sessionId, providerId: selectedProviderId });
          }
        }}
        disabled={!selectedProviderId || addProvider.isPending}
      >
        {addProvider.isPending ? (
          <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="mr-1.5 h-4 w-4" />
        )}
        Add
      </Button>
    </div>
  );
}

// ─── Provider Review Card ───────────────────────────────────────────────────

const DECISION_CONFIG: Record<Decision, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  APPROVED: { label: "Approve", color: "bg-green-600 hover:bg-green-700 text-white", icon: CheckCircle2 },
  DENIED: { label: "Deny", color: "bg-red-600 hover:bg-red-700 text-white", icon: XCircle },
  DEFERRED: { label: "Defer", color: "bg-yellow-500 hover:bg-yellow-600 text-white", icon: Clock },
  CONDITIONAL: { label: "Conditional", color: "bg-orange-500 hover:bg-orange-600 text-white", icon: AlertTriangle },
};

const DECISION_BADGE_VARIANT: Record<Decision, "success" | "destructive" | "warning" | "info"> = {
  APPROVED: "success",
  DENIED: "destructive",
  DEFERRED: "warning",
  CONDITIONAL: "info",
};

export function ProviderReviewCard({
  entry,
  sessionStatus,
}: {
  entry: ProviderEntry;
  sessionStatus: SessionStatus;
}) {
  const router = useRouter();
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(entry.decision);
  const [denialReason, setDenialReason] = useState(entry.denialReason ?? "");
  const [conditionalItems, setConditionalItems] = useState(entry.conditionalItems ?? "");
  const [committeeNotes, setCommitteeNotes] = useState(entry.committeeNotes ?? "");
  const [isExpanded, setIsExpanded] = useState(!entry.decision);

  const recordDecision = api.committee.recordDecision.useMutation({
    onSuccess: () => router.refresh(),
  });

  const removeProvider = api.committee.removeProvider.useMutation({
    onSuccess: () => router.refresh(),
  });

  const canDecide = sessionStatus === "IN_PROGRESS";
  const canModify = sessionStatus === "SCHEDULED" || sessionStatus === "IN_PROGRESS";
  const p = entry.provider;

  const handleSubmitDecision = () => {
    if (!selectedDecision) return;
    recordDecision.mutate({
      entryId: entry.id,
      decision: selectedDecision,
      denialReason: selectedDecision === "DENIED" ? denialReason || undefined : undefined,
      conditionalItems: selectedDecision === "CONDITIONAL" ? conditionalItems || undefined : undefined,
      committeeNotes: committeeNotes || undefined,
    });
  };

  return (
    <Card className="overflow-hidden">
      {/* Card Header */}
      <CardHeader
        className="cursor-pointer pb-3"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold text-sm">
              {entry.agendaOrder}
            </div>
            <div>
              <CardTitle className="text-base">
                {p.legalFirstName} {p.legalLastName}
              </CardTitle>
              <p className="text-sm text-muted-foreground">{p.providerType.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {entry.decision ? (
              <Badge variant={DECISION_BADGE_VARIANT[entry.decision]}>
                {entry.decision}
              </Badge>
            ) : (
              <Badge variant="outline">Pending</Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="pt-0 space-y-4">
          <Separator />

          {/* Verification Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* PSV Verifications */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-blue-600" />
                Verifications
              </h4>
              {p.verificationRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground">No verification records</p>
              ) : (
                <div className="space-y-1">
                  {p.verificationRecords.map((v) => (
                    <div key={v.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{v.verificationType}</span>
                      <Badge
                        variant={v.status === "VERIFIED" ? "success" : v.status === "FAILED" ? "destructive" : "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {v.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Sanctions */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldAlert className="h-4 w-4 text-amber-600" />
                Sanctions
              </h4>
              {p.sanctionsChecks.length === 0 ? (
                <p className="text-xs text-muted-foreground">No sanctions checks run</p>
              ) : (
                p.sanctionsChecks.map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{s.checkType}</span>
                    <Badge
                      variant={s.result === "CLEAR" ? "success" : "destructive"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {s.result}
                    </Badge>
                  </div>
                ))
              )}
            </div>

            {/* NPDB */}
            <div className="space-y-2">
              <h4 className="text-sm font-semibold flex items-center gap-1.5">
                <FileText className="h-4 w-4 text-purple-600" />
                NPDB
              </h4>
              {p.npdbRecords.length === 0 ? (
                <p className="text-xs text-muted-foreground">No NPDB queries</p>
              ) : (
                p.npdbRecords.map((n) => (
                  <div key={n.id} className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {formatDate(n.queryDate)}
                    </span>
                    <Badge
                      variant={n.result === "CLEAR" ? "success" : "destructive"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {n.result}
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Existing Decision Info */}
          {entry.decision && entry.decisionBy && (
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <p>
                <span className="font-medium">Decided by:</span>{" "}
                {entry.decisionBy.displayName}
                {entry.decisionDate && (
                  <span className="text-muted-foreground">
                    {" "}on {formatDate(entry.decisionDate)}
                  </span>
                )}
              </p>
              {entry.denialReason && (
                <p className="mt-1">
                  <span className="font-medium">Denial reason:</span> {entry.denialReason}
                </p>
              )}
              {entry.conditionalItems && (
                <p className="mt-1">
                  <span className="font-medium">Conditions:</span> {entry.conditionalItems}
                </p>
              )}
              {entry.committeeNotes && (
                <p className="mt-1">
                  <span className="font-medium">Notes:</span> {entry.committeeNotes}
                </p>
              )}
            </div>
          )}

          {/* Decision Controls */}
          {canDecide && (
            <div className="space-y-3 border-t pt-4">
              <h4 className="text-sm font-semibold">Record Decision</h4>

              <div className="flex gap-2">
                {(Object.entries(DECISION_CONFIG) as [Decision, typeof DECISION_CONFIG[Decision]][]).map(
                  ([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelectedDecision(key)}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${
                          selectedDecision === key
                            ? config.color + " ring-2 ring-offset-2"
                            : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                        {config.label}
                      </button>
                    );
                  }
                )}
              </div>

              {selectedDecision === "DENIED" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Denial *
                  </label>
                  <textarea
                    value={denialReason}
                    onChange={(e) => setDenialReason(e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Provide reason for denial..."
                  />
                </div>
              )}

              {selectedDecision === "CONDITIONAL" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Outstanding Conditions *
                  </label>
                  <textarea
                    value={conditionalItems}
                    onChange={(e) => setConditionalItems(e.target.value)}
                    rows={2}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="List conditions that must be met..."
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Committee Notes
                </label>
                <textarea
                  value={committeeNotes}
                  onChange={(e) => setCommitteeNotes(e.target.value)}
                  rows={2}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Optional notes for the record..."
                />
              </div>

              <Button
                onClick={handleSubmitDecision}
                disabled={!selectedDecision || recordDecision.isPending}
                className="w-full"
              >
                {recordDecision.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                )}
                Record Decision
              </Button>
            </div>
          )}

          {/* Remove Button */}
          {canModify && (
            <div className="border-t pt-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => {
                  if (confirm(`Remove ${p.legalFirstName} ${p.legalLastName} from this session?`)) {
                    removeProvider.mutate({ entryId: entry.id });
                  }
                }}
                disabled={removeProvider.isPending}
              >
                {removeProvider.isPending ? (
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-1.5 h-4 w-4" />
                )}
                Remove from Session
              </Button>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Session Summary Sidebar ────────────────────────────────────────────────

export function SessionSummary({
  entries,
  notes,
  committeeMemberIds,
}: {
  entries: ProviderEntry[];
  notes: string | null;
  committeeMemberIds: string[];
}) {
  const total = entries.length;
  const decided = entries.filter((e) => e.decision).length;
  const approved = entries.filter((e) => e.decision === "APPROVED").length;
  const denied = entries.filter((e) => e.decision === "DENIED").length;
  const deferred = entries.filter((e) => e.decision === "DEFERRED").length;
  const conditional = entries.filter((e) => e.decision === "CONDITIONAL").length;
  const pending = total - decided;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Session Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Total Providers</span>
            <span className="font-medium">{total}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Decisions Made</span>
            <span className="font-medium">{decided} / {total}</span>
          </div>

          {total > 0 && (
            <>
              <Separator />
              <div className="space-y-1.5">
                {approved > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-green-500" />
                      Approved
                    </span>
                    <span className="font-medium">{approved}</span>
                  </div>
                )}
                {denied > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-red-500" />
                      Denied
                    </span>
                    <span className="font-medium">{denied}</span>
                  </div>
                )}
                {deferred > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-yellow-500" />
                      Deferred
                    </span>
                    <span className="font-medium">{deferred}</span>
                  </div>
                )}
                {conditional > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-orange-500" />
                      Conditional
                    </span>
                    <span className="font-medium">{conditional}</span>
                  </div>
                )}
                {pending > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-gray-300" />
                      Pending
                    </span>
                    <span className="font-medium">{pending}</span>
                  </div>
                )}
              </div>
            </>
          )}

          {total > 0 && (
            <>
              <Separator />
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${total > 0 ? (decided / total) * 100 : 0}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {total > 0 ? Math.round((decided / total) * 100) : 0}% complete
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {committeeMemberIds.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Committee Members</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              {committeeMemberIds.length} member{committeeMemberIds.length !== 1 ? "s" : ""} assigned
            </p>
          </CardContent>
        </Card>
      )}

      {notes && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Session Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
