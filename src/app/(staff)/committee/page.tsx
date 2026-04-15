import { db } from "@/server/db";
import { formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  CalendarDays,
  Users,
  CheckCircle2,
  Clock,
  PlayCircle,
  BarChart3,
  MapPin,
  ArrowRight,
} from "lucide-react";

export default async function CommitteeDashboardPage() {
  const [queue, activeSessions, recentCompleted, sessionCounts] = await Promise.all([
    db.provider.findMany({
      where: { status: "COMMITTEE_READY" },
      include: { providerType: true },
      orderBy: { committeeReadyAt: "asc" },
    }),
    db.committeeSession.findMany({
      where: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      include: {
        providers: {
          include: {
            provider: {
              select: { id: true, legalFirstName: true, legalLastName: true, status: true },
            },
          },
        },
      },
      orderBy: { sessionDate: "asc" },
    }),
    db.committeeSession.findMany({
      where: { status: "COMPLETED" },
      include: {
        providers: {
          include: {
            provider: {
              select: { id: true, legalFirstName: true, legalLastName: true },
            },
          },
        },
      },
      orderBy: { sessionDate: "desc" },
      take: 5,
    }),
    db.committeeSession.groupBy({
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const totalSessions = sessionCounts.reduce((acc, s) => acc + s._count.id, 0);
  const countByStatus = Object.fromEntries(
    sessionCounts.map((s) => [s.status, s._count.id])
  ) as Record<string, number>;

  const stats = [
    {
      label: "Total Sessions",
      value: totalSessions,
      icon: BarChart3,
      color: "text-gray-700",
      bg: "bg-gray-100",
    },
    {
      label: "Scheduled",
      value: countByStatus["SCHEDULED"] ?? 0,
      icon: CalendarDays,
      color: "text-blue-700",
      bg: "bg-blue-100",
    },
    {
      label: "In Progress",
      value: countByStatus["IN_PROGRESS"] ?? 0,
      icon: PlayCircle,
      color: "text-amber-700",
      bg: "bg-amber-100",
    },
    {
      label: "Completed",
      value: countByStatus["COMPLETED"] ?? 0,
      icon: CheckCircle2,
      color: "text-green-700",
      bg: "bg-green-100",
    },
    {
      label: "Providers in Queue",
      value: queue.length,
      icon: Users,
      color: "text-purple-700",
      bg: "bg-purple-100",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Committee Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Review and schedule credentialing committee sessions
          </p>
        </div>
        <a
          href="/committee/sessions/new"
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          <CalendarDays className="h-4 w-4" />
          Create Session
        </a>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${stat.bg}`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Active Sessions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <PlayCircle className="h-5 w-5 text-amber-600" />
            Active Sessions ({activeSessions.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {activeSessions.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <CalendarDays className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No active sessions</p>
              <p className="text-sm mt-1">
                Create a new session to begin reviewing providers.
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {activeSessions.map((s) => {
                const totalProviders = s.providers.length;
                const decided = s.providers.filter((p) => p.decision).length;
                const progressPct =
                  totalProviders > 0 ? Math.round((decided / totalProviders) * 100) : 0;

                return (
                  <a
                    key={s.id}
                    href={`/committee/sessions/${s.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {s.sessionDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <Badge
                          variant={s.status === "IN_PROGRESS" ? "warning" : "info"}
                          className="text-[10px]"
                        >
                          {s.status === "IN_PROGRESS" ? "In Progress" : "Scheduled"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {totalProviders} provider{totalProviders !== 1 ? "s" : ""}
                        </span>
                        {s.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {s.location}
                          </span>
                        )}
                        {totalProviders > 0 && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {decided}/{totalProviders} decided
                          </span>
                        )}
                      </div>
                      {totalProviders > 0 && (
                        <div className="mt-2 max-w-xs">
                          <Progress value={progressPct} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-4" />
                  </a>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Completed Sessions */}
      {recentCompleted.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              Recent Completed Sessions
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentCompleted.map((s) => {
                const totalProviders = s.providers.length;
                const approved = s.providers.filter((p) => p.decision === "APPROVED").length;
                const denied = s.providers.filter((p) => p.decision === "DENIED").length;

                return (
                  <a
                    key={s.id}
                    href={`/committee/sessions/${s.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors group"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">
                          {s.sessionDate.toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        <Badge variant="success" className="text-[10px]">
                          Completed
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{totalProviders} provider{totalProviders !== 1 ? "s" : ""}</span>
                        {approved > 0 && (
                          <span className="flex items-center gap-1 text-green-600">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            {approved} approved
                          </span>
                        )}
                        {denied > 0 && (
                          <span className="text-red-600">{denied} denied</span>
                        )}
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Committee Queue */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-600" />
            Ready for Committee ({queue.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {queue.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>No providers waiting for committee review</p>
            </div>
          ) : (
            <div className="divide-y">
              {queue.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between">
                  <div>
                    <a
                      href={`/providers/${p.id}`}
                      className="font-medium hover:underline text-blue-600"
                    >
                      {p.legalFirstName} {p.legalLastName}
                    </a>
                    <div className="text-sm text-muted-foreground">
                      {p.providerType.name}
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {p.committeeReadyAt
                      ? formatDistanceToNow(p.committeeReadyAt, { addSuffix: true })
                      : "—"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
