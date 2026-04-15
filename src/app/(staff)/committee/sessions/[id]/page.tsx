import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CommitteeSessionPage({ params }: PageProps) {
  const { id } = await params;
  const session = await api.committee.getSession({ id }).catch(() => null);

  if (!session) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            Committee Session — {format(new Date(session.sessionDate), "MMMM d, yyyy")}
          </h1>
          {session.location && (
            <p className="text-muted-foreground mt-1">{session.location}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Badge variant="outline">{session.status}</Badge>
          {session.status === "SCHEDULED" && (
            <Button size="sm">Generate Agenda</Button>
          )}
        </div>
      </div>

      <Separator />

      <div className="grid gap-4">
        <h2 className="text-lg font-semibold">Providers Under Review</h2>
        {session.providers.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No providers assigned to this session.
            </CardContent>
          </Card>
        ) : (
          session.providers.map((entry) => (
            <Card key={entry.id}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  <span>
                    {entry.provider.legalFirstName} {entry.provider.legalLastName}
                  </span>
                  <Badge variant="outline">{entry.decision ?? "Pending"}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <span>{entry.provider.providerType.name}</span>
                {entry.committeeNotes && <p className="mt-1">{entry.committeeNotes}</p>}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
