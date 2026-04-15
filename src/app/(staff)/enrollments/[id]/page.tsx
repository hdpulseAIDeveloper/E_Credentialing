import { notFound } from "next/navigation";
import { api } from "@/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { EnrollmentActions } from "@/components/enrollments/EnrollmentActions";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EnrollmentDetailPage({ params }: PageProps) {
  const { id } = await params;
  const enrollment = await api.enrollment.getById({ id }).catch(() => null);

  if (!enrollment) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {enrollment.payerName} — {enrollment.enrollmentType}
          </h1>
          <p className="text-muted-foreground mt-1">
            {enrollment.provider.legalFirstName} {enrollment.provider.legalLastName}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{enrollment.status}</Badge>
          <EnrollmentActions
            enrollmentId={enrollment.id}
            currentStatus={enrollment.status as "DRAFT" | "SUBMITTED" | "PENDING_PAYER" | "ENROLLED" | "DENIED" | "ERROR" | "WITHDRAWN"}
            currentFollowUpDue={enrollment.followUpDueDate ? String(enrollment.followUpDueDate) : null}
          />
        </div>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Enrollment Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Payer</span>
              <span className="font-medium">{enrollment.payerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Type</span>
              <span className="font-medium">{enrollment.enrollmentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Method</span>
              <span className="font-medium">{enrollment.submissionMethod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <span className="font-medium">{enrollment.status}</span>
            </div>
            {enrollment.submittedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Submitted</span>
                <span>{format(new Date(enrollment.submittedAt), "MMM d, yyyy")}</span>
              </div>
            )}
            {enrollment.effectiveDate && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective Date</span>
                <span>{format(new Date(enrollment.effectiveDate), "MMM d, yyyy")}</span>
              </div>
            )}
            {enrollment.payerConfirmationNumber && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Confirmation #</span>
                <span className="font-mono">{enrollment.payerConfirmationNumber}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {enrollment.payerResponseNotes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Payer Response Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {enrollment.payerResponseNotes}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {enrollment.followUps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Follow-Up History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {enrollment.followUps.map((fu) => (
                <div key={fu.id} className="border-b pb-2 text-sm last:border-0">
                  <div className="flex justify-between text-muted-foreground">
                    <span>{format(new Date(fu.followUpDate), "MMM d, yyyy")}</span>
                    <span>{fu.performedBy.displayName}</span>
                  </div>
                  <p className="mt-1">{fu.outcome}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
