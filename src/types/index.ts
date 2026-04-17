/**
 * Shared TypeScript types across the ESSEN Credentialing Platform.
 * Prisma-generated types are imported directly from @prisma/client.
 * This file contains UI-specific and utility types.
 */

import type { Provider, ProviderStatus, UserRole } from "@prisma/client";

// ─── Pagination ────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Provider list item (with relations included) ──────────────────────────
export interface ProviderListItem extends Provider {
  providerType: { id: string; name: string; code: string };
  assignedSpecialist: { id: string; displayName: string; email: string } | null;
}

// ─── Bot run status event (from Socket.io) ────────────────────────────────
export interface BotStatusEvent {
  botRunId: string;
  providerId: string;
  botType: string;
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED";
  progress?: number;
  message?: string;
  resultUrl?: string;
}

// ─── Checklist item with document ─────────────────────────────────────────
export interface ChecklistItemWithDocument {
  id: string;
  documentType: string;
  status: string;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  notes: string | null;
  document: {
    id: string;
    blobUrl: string;
    uploadedAt: Date;
    ocrStatus: string;
  } | null;
}

// ─── Audit log with actor ─────────────────────────────────────────────────
export interface AuditLogWithActor {
  id: string;
  timestamp: Date;
  action: string;
  entityType: string;
  entityId: string | null;
  beforeState: unknown;
  afterState: unknown;
  ipAddress: string | null;
  actor: {
    id: string;
    displayName: string;
    role: UserRole;
  };
}

// ─── Committee session summary ─────────────────────────────────────────────
export interface CommitteeSessionSummary {
  id: string;
  sessionDate: Date;
  location: string | null;
  status: string;
  _count: { providers: number };
}

// ─── Status badge colors ──────────────────────────────────────────────────
export const STATUS_COLORS: Record<ProviderStatus, string> = {
  INVITED: "bg-gray-100 text-gray-700",
  ONBOARDING_IN_PROGRESS: "bg-blue-100 text-blue-700",
  DOCUMENTS_PENDING: "bg-yellow-100 text-yellow-700",
  VERIFICATION_IN_PROGRESS: "bg-orange-100 text-orange-700",
  COMMITTEE_READY: "bg-purple-100 text-purple-700",
  COMMITTEE_IN_REVIEW: "bg-indigo-100 text-indigo-700",
  APPROVED: "bg-green-100 text-green-700",
  DENIED: "bg-red-100 text-red-700",
  DEFERRED: "bg-amber-100 text-amber-700",
  INACTIVE: "bg-slate-100 text-slate-700",
  TERMINATED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-200 text-gray-600",
};

export const STATUS_LABELS: Record<ProviderStatus, string> = {
  INVITED: "Invited",
  ONBOARDING_IN_PROGRESS: "Onboarding",
  DOCUMENTS_PENDING: "Docs Pending",
  VERIFICATION_IN_PROGRESS: "In Verification",
  COMMITTEE_READY: "Committee Ready",
  COMMITTEE_IN_REVIEW: "In Review",
  APPROVED: "Approved",
  DENIED: "Denied",
  DEFERRED: "Deferred",
  INACTIVE: "Inactive",
  TERMINATED: "Terminated",
  WITHDRAWN: "Withdrawn",
};

// ─── Nav items ────────────────────────────────────────────────────────────
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  roles?: UserRole[];
}
