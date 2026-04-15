/**
 * Audit log writer — creates immutable AuditLog records.
 * All state changes in the system must call writeAuditLog.
 * This table has no UPDATE or DELETE grants; records are append-only.
 */

import { db } from "@/server/db";
import type { Prisma } from "@prisma/client";

export interface AuditLogParams {
  /** ID of the user who performed the action; null for system/automated actions */
  actorId?: string | null;
  /** Role of the actor at time of action */
  actorRole?: string | null;
  /** Action identifier e.g. "provider.status.changed", "document.uploaded", "bot.run.completed" */
  action: string;
  /** Entity type e.g. "Provider", "Document", "BotRun" */
  entityType: string;
  /** ID of the affected entity */
  entityId: string;
  /** Provider this action relates to (if applicable) */
  providerId?: string | null;
  /** State before change (for update actions) */
  beforeState?: Prisma.InputJsonValue | null;
  /** State after change */
  afterState?: Prisma.InputJsonValue | null;
  /** Additional context (e.g., IP address, session ID) */
  metadata?: Prisma.InputJsonValue | null;
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        actorRole: params.actorRole ?? null,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
        providerId: params.providerId ?? null,
        beforeState: params.beforeState ?? undefined,
        afterState: params.afterState ?? undefined,
        metadata: params.metadata ?? undefined,
      },
    });
  } catch (error) {
    // Audit log failures should never crash the main operation.
    // Log to console (not to the audit log itself).
    console.error("[AuditLog] Failed to write audit log:", {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      error,
    });
  }
}

/**
 * Writes an audit log entry for a provider status transition.
 */
export async function auditProviderStatusChange(params: {
  actorId: string | null;
  actorRole: string | null;
  providerId: string;
  fromStatus: string;
  toStatus: string;
  reason?: string;
}): Promise<void> {
  await writeAuditLog({
    actorId: params.actorId,
    actorRole: params.actorRole,
    action: "provider.status.changed",
    entityType: "Provider",
    entityId: params.providerId,
    providerId: params.providerId,
    beforeState: { status: params.fromStatus },
    afterState: { status: params.toStatus },
    metadata: params.reason ? { reason: params.reason } : undefined,
  });
}
