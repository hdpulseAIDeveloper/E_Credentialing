import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CalendarDays, MapPin, Clock } from "lucide-react";
import {
  SessionStatusControls,
  AddProviderToSession,
  ProviderReviewCard,
  SessionSummary,
} from "@/components/committee/SessionActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_STYLE: Record<string, { variant: "default" | "success" | "destructive" | "warning" | "info" | "outline"; label: string }> = {
  SCHEDULED: { variant: "info", label: "Scheduled" },
  IN_PROGRESS: { variant: "warning", label: "In Progress" },
  COMPLETED: { variant: "success", label: "Completed" },
  CANCELLED: { variant: "destructive", label: "Cancelled" },
};

export default async function CommitteeSessionPage({ params }: PageProps) {
  const { id } = await params;
  const session = await api.committee.getSession({ id }).catch(() => null);

  if (!session) notFound();

  const statusInfo = STATUS_STYLE[session.status] ?? { variant: "outline" as const, label: session.status };
  const existingProviderIds = session.providers.map((e) => e.provider.id);
  const isActive = session.status === "SCHEDULED" || session.status === "IN_PROGRESS";

  return (
    <div className="space-y-6">
      {/* Session Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">
              Committee Session
            </h1>
            <Badge variant={statusInfo.variant} className="text-xs">
              {statusInfo.label}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {format(new Date(session.sessionDate), "EEEE, MMMM d, yyyy")}
            </span>
            {session.sessionTime && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                {session.sessionTime}
              </span>
            )}
            {session.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {session.location}
              </span>
            )}
          </div>
        </div>

        <SessionStatusControls
          sessionId={session.id}
          currentStatus={session.status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"}
        />
      </div>

      <Separator />

      {/* Main Layout: Providers + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
        {/* Left Column: Providers */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Providers Under Review ({session.providers.length})
            </h2>
          </div>

          {/* Add Provider */}
          {isActive && (
            <div className="bg-muted/30 rounded-lg border border-dashed p-4">
              <p className="text-sm font-medium mb-2">Add Provider to Session</p>
              <AddProviderToSession
                sessionId={session.id}
                existingProviderIds={existingProviderIds}
              />
            </div>
          )}

          {/* Provider Cards */}
          {session.providers.length === 0 ? (
            <div className="rounded-lg border bg-white py-12 text-center">
              <p className="text-muted-foreground">
                No providers assigned to this session yet.
              </p>
              {isActive && (
                <p className="text-sm text-muted-foreground mt-1">
                  Use the dropdown above to add committee-ready providers.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {session.providers.map((entry) => (
                <ProviderReviewCard
                  key={entry.id}
                  entry={entry as any}
                  sessionStatus={session.status as "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED"}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Summary */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <SessionSummary
            entries={session.providers as any}
            notes={session.notes}
            committeeMemberIds={(session.committeeMemberIds as string[]) ?? []}
          />
        </div>
      </div>
    </div>
  );
}
