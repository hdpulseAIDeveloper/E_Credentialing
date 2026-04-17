import type { ProviderStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<ProviderStatus, { label: string; className: string }> = {
  INVITED: { label: "Invited", className: "bg-gray-100 text-gray-700" },
  ONBOARDING_IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-700" },
  DOCUMENTS_PENDING: { label: "Docs Pending", className: "bg-yellow-100 text-yellow-700" },
  VERIFICATION_IN_PROGRESS: { label: "Verifying", className: "bg-purple-100 text-purple-700" },
  COMMITTEE_READY: { label: "Committee Ready", className: "bg-indigo-100 text-indigo-700" },
  COMMITTEE_IN_REVIEW: { label: "In Review", className: "bg-indigo-200 text-indigo-800" },
  APPROVED: { label: "Approved", className: "bg-green-100 text-green-700" },
  DENIED: { label: "Denied", className: "bg-red-100 text-red-700" },
  DEFERRED: { label: "Deferred", className: "bg-orange-100 text-orange-700" },
  INACTIVE: { label: "Inactive", className: "bg-gray-100 text-gray-500" },
  TERMINATED: { label: "Terminated", className: "bg-red-100 text-red-800" },
  WITHDRAWN: { label: "Withdrawn", className: "bg-gray-200 text-gray-600" },
};

interface Props {
  status: ProviderStatus;
  className?: string;
}

export function ProviderStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
