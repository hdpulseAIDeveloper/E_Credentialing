import Link from "next/link";
import type { Provider, ProviderType, User } from "@prisma/client";
import { ProviderStatusBadge } from "./ProviderStatusBadge";
import { formatDistanceToNow } from "date-fns";

interface Props {
  provider: Provider & {
    providerType: ProviderType;
    assignedSpecialist?: Pick<User, "id" | "displayName"> | null;
  };
}

export function ProviderCard({ provider }: Props) {
  const daysSinceUpdate = formatDistanceToNow(provider.updatedAt, { addSuffix: true });

  return (
    <Link href={`/providers/${provider.id}`} className="block">
      <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-gray-900">
              {provider.legalFirstName} {provider.legalLastName}
            </h3>
            <div className="text-sm text-gray-500 mt-0.5">{provider.providerType.name}</div>
          </div>
          <ProviderStatusBadge status={provider.status} />
        </div>

        <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
          {provider.npi && <span>NPI: {provider.npi}</span>}
          {provider.assignedSpecialist && (
            <span>Specialist: {provider.assignedSpecialist.displayName}</span>
          )}
          <span>Updated {daysSinceUpdate}</span>
        </div>
      </div>
    </Link>
  );
}
