"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { RowActions } from "@/components/shared/RowActions";

interface ExpirableRowActionsProps {
  expirableId: string;
  providerName: string;
  credentialType: string;
  providerId: string;
}

export function ExpirableRowActions({
  expirableId,
  providerName,
  credentialType,
  providerId,
}: ExpirableRowActionsProps) {
  const router = useRouter();
  const deleteMutation = api.expirable.delete.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <RowActions
      viewHref={`/providers/${providerId}?tab=expirables`}
      editHref={`/providers/${providerId}?tab=expirables&renew=${expirableId}`}
      onDelete={() => deleteMutation.mutate({ id: expirableId })}
      deleteLabel="Delete"
      deleteConfirmMessage={`Delete the ${credentialType} record for ${providerName}? This cannot be undone.`}
      isDeleting={deleteMutation.isPending}
    />
  );
}
