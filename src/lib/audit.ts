/**
 * Audit log writer — creates immutable, tamper-evident AuditLog records.
 *
 * Every entry is chained: hash = HMAC-SHA256(key, previous_hash || canonical_row).
 * Chain verification is performed by `verifyAuditChain()` below and in
 * the compliance reporting path.
 *
 * Writes are best-effort: a failure to persist should never crash the
 * caller, but IS reported via the structured logger so that the Security
 * team can investigate. The DB itself blocks UPDATE/DELETE/TRUNCATE via
 * triggers installed in migration 20260416130000_audit_tamper_evidence.
 */

import { createHmac } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { logger } from "@/lib/logger";

export interface AuditLogParams {
  actorId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  providerId?: string | null;
  beforeState?: Prisma.InputJsonValue | null;
  afterState?: Prisma.InputJsonValue | null;
  metadata?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
}

/**
 * Secret used for the HMAC chain. Stored in env; rotated only with the
 * documented key-rotation runbook (docs/dev/runbooks/key-rotation.md).
 * If absent, a deterministic dev-only fallback is used so tests still
 * produce valid hashes, but we log a warning once at process start.
 */
const AUDIT_HMAC_KEY = (() => {
  const key = process.env.AUDIT_HMAC_KEY;
  if (key && key.length >= 32) return key;
  if (process.env.NODE_ENV === "production") {
    logger.error(
      { configured: Boolean(key) },
      "AUDIT_HMAC_KEY is missing or too short; refusing to start in production",
    );
    throw new Error("AUDIT_HMAC_KEY must be set to a 32+ character secret in production");
  }
  logger.warn(
    "AUDIT_HMAC_KEY not set or too short; using dev fallback. Do not use in production.",
  );
  return "dev-fallback-audit-hmac-key-do-not-use-in-production";
})();

function canonicalize(row: {
  sequence: bigint;
  timestamp: Date;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  providerId: string | null;
  beforeState: Prisma.JsonValue | null;
  afterState: Prisma.JsonValue | null;
  metadata: Prisma.JsonValue | null;
}): string {
  return JSON.stringify({
    sequence: row.sequence.toString(),
    ts: row.timestamp.toISOString(),
    actor: row.actorId,
    role: row.actorRole,
    action: row.action,
    entity: `${row.entityType}:${row.entityId}`,
    provider: row.providerId,
    before: row.beforeState ?? null,
    after: row.afterState ?? null,
    meta: row.metadata ?? null,
  });
}

function computeHash(previousHash: string | null, canonical: string): string {
  const h = createHmac("sha256", AUDIT_HMAC_KEY);
  h.update(previousHash ?? "GENESIS");
  h.update("\x1e");
  h.update(canonical);
  return h.digest("hex");
}

export async function writeAuditLog(params: AuditLogParams): Promise<void> {
  try {
    await db.$transaction(async (tx) => {
      const previous = await tx.auditLog.findFirst({
        orderBy: { sequence: "desc" },
        select: { hash: true },
      });
      const created = await tx.auditLog.create({
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
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
          requestId: params.requestId ?? null,
          previousHash: previous?.hash ?? null,
        },
      });
      const canonical = canonicalize({
        sequence: created.sequence,
        timestamp: created.timestamp,
        actorId: created.actorId,
        actorRole: created.actorRole,
        action: created.action,
        entityType: created.entityType,
        entityId: created.entityId,
        providerId: created.providerId,
        beforeState: created.beforeState,
        afterState: created.afterState,
        metadata: created.metadata,
      });
      const hash = computeHash(previous?.hash ?? null, canonical);
      // The DB trigger allows a single NULL→non-NULL transition on `hash` and
      // rejects any change to the chain-input columns. This keeps the log
      // append-only while letting the application persist the computed chain
      // value here, in the same transaction as the insert.
      await tx.$executeRaw`
        UPDATE "audit_logs" SET "hash" = ${hash} WHERE "id" = ${created.id}
      `;
    });
  } catch (error) {
    logger.error(
      {
        err: (error as Error).message,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
      },
      "[AuditLog] Failed to write audit log",
    );
  }
}

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

/**
 * Verify the chain from the first sequence to the latest. Used by the
 * compliance dashboard and the auditor package generator.
 *
 * Returns { ok: true } when the chain is intact, or { ok: false,
 * brokenAt } when a mismatch is found. NULL hashes (from the fallback
 * path above) are treated as "not verified" and reported separately.
 */
export async function verifyAuditChain(): Promise<{
  ok: boolean;
  brokenAt?: { id: string; sequence: bigint };
  nullHashes: number;
  total: number;
}> {
  const batchSize = 500;
  let cursor: bigint | null = null;
  let previousHash: string | null = null;
  let nullHashes = 0;
  let total = 0;

  while (true) {
    const rows: Array<{
      id: string;
      sequence: bigint;
      timestamp: Date;
      actorId: string | null;
      actorRole: string | null;
      action: string;
      entityType: string;
      entityId: string;
      providerId: string | null;
      beforeState: Prisma.JsonValue | null;
      afterState: Prisma.JsonValue | null;
      metadata: Prisma.JsonValue | null;
      previousHash: string | null;
      hash: string | null;
    }> = await db.auditLog.findMany({
      where: cursor !== null ? { sequence: { gt: cursor } } : undefined,
      orderBy: { sequence: "asc" },
      take: batchSize,
      select: {
        id: true,
        sequence: true,
        timestamp: true,
        actorId: true,
        actorRole: true,
        action: true,
        entityType: true,
        entityId: true,
        providerId: true,
        beforeState: true,
        afterState: true,
        metadata: true,
        previousHash: true,
        hash: true,
      },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      total += 1;
      if (row.hash === null) {
        nullHashes += 1;
        previousHash = row.hash ?? previousHash;
        cursor = row.sequence;
        continue;
      }
      const canonical = canonicalize(row);
      const expected = computeHash(row.previousHash, canonical);
      if (expected !== row.hash) {
        return { ok: false, brokenAt: { id: row.id, sequence: row.sequence }, nullHashes, total };
      }
      previousHash = row.hash;
      cursor = row.sequence;
    }
  }

  return { ok: true, nullHashes, total };
}
