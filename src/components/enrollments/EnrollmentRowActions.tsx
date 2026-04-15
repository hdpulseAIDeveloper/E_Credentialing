"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { RowActions } from "@/components/shared/RowActions";

interface EnrollmentRowActionsProps {
  enrollmentId: string;
  payerName: string;
}

export function EnrollmentRowActions({ enrollmentId, payerName }: EnrollmentRowActionsProps) {
  const router = useRouter();
  const deleteMutation = api.enrollment.delete.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <RowActions
      viewHref={`/enrollments/${enrollmentId}`}
      editHref={`/enrollments/${enrollmentId}?edit=true`}
      onDelete={() => deleteMutation.mutate({ id: enrollmentId })}
      deleteLabel="Withdraw"
      deleteConfirmMessage={`Withdraw the ${payerName} enrollment? Status will be set to Withdrawn.`}
      isDeleting={deleteMutation.isPending}
    />
  );
}
