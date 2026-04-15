"use client";

import { useRouter } from "next/navigation";
import { api } from "@/trpc/react";
import { RowActions } from "@/components/shared/RowActions";

interface ProviderRowActionsProps {
  providerId: string;
  providerName: string;
}

export function ProviderRowActions({ providerId, providerName }: ProviderRowActionsProps) {
  const router = useRouter();
  const deleteMutation = api.provider.delete.useMutation({
    onSuccess: () => router.refresh(),
  });

  return (
    <RowActions
      viewHref={`/providers/${providerId}`}
      editHref={`/providers/${providerId}?tab=overview&edit=true`}
      botsHref={`/providers/${providerId}/bots`}
      onDelete={() => deleteMutation.mutate({ id: providerId })}
      deleteLabel="Deactivate"
      deleteConfirmMessage={`Are you sure you want to deactivate ${providerName}? They will be set to Inactive status.`}
      isDeleting={deleteMutation.isPending}
    />
  );
}
