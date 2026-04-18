/**
 * src/server/services/sanctions.ts
 *
 * OIG/SAM sanctions service. Owns the queue interaction for OIG/SAM probes
 * plus the audit-log writes. Wave 2.1 extraction from
 * `src/server/api/routers/sanctions.ts`.
 *
 * Notes:
 *   - Sanctions hits are a P0 compliance event (NCQA CR-3 + JC NPG-12), so
 *     `acknowledge()` is restricted to managers at the router boundary AND
 *     writes an audit row here so the chain of custody is intact even if a
 *     future caller forgets the role check.
 *   - Queue add failure here is intentionally NOT fatal — sanctions probes
 *     are also re-driven by a daily cron, so a transient Redis blip leaves
 *     the row in QUEUED to be picked up later. This matches the original
 *     router behavior; do not "fix" it without re-reading
 *     docs/dev/runbooks/sanctions-failover.md (W4.3 deliverable).
 */
import type { PrismaClient } from "@prisma/client";
import type { Queue } from "bullmq";
import { TRPCError } from "@trpc/server";
import type { ServiceActor, AuditWriter } from "./document";

export interface SanctionsServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
  queue: Pick<Queue, "add"> | null;
}

export type SanctionsSource = "OIG" | "SAM_GOV";

export class SanctionsService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;
  private readonly queue: Pick<Queue, "add"> | null;

  constructor(deps: SanctionsServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
    this.queue = deps.queue;
  }

  async listByProvider(providerId: string) {
    return this.db.sanctionsCheck.findMany({
      where: { providerId },
      include: {
        triggeredByUser: { select: { id: true, displayName: true } },
        acknowledgedBy: { select: { id: true, displayName: true } },
        botRun: { select: { id: true, status: true } },
      },
      orderBy: { runDate: "desc" },
    });
  }

  async getFlagged() {
    return this.db.sanctionsCheck.findMany({
      where: { result: "FLAGGED", isAcknowledged: false },
      include: {
        provider: { select: { id: true, legalFirstName: true, legalLastName: true } },
        botRun: { select: { id: true, status: true } },
      },
      orderBy: { runDate: "desc" },
    });
  }

  async triggerCheck(providerId: string, source: SanctionsSource) {
    const provider = await this.db.provider.findUnique({ where: { id: providerId } });
    if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

    const botRun = await this.db.botRun.create({
      data: {
        providerId,
        botType: source === "OIG" ? "OIG_SANCTIONS" : "SAM_SANCTIONS",
        triggeredBy: "MANUAL",
        triggeredByUserId: this.actor.id,
        status: "QUEUED",
        attemptCount: 0,
        inputData: {
          npi: provider.npi,
          firstName: provider.legalFirstName,
          lastName: provider.legalLastName,
        },
      },
    });

    if (this.queue) {
      try {
        await this.queue.add(
          source === "OIG" ? "oig-sanctions" : "sam-sanctions",
          { botRunId: botRun.id, providerId },
          { priority: 2, attempts: 3 },
        );
      } catch (error) {
        // Intentionally non-fatal — see header comment.
        console.error("[SanctionsService] Failed to enqueue bot job:", error);
      }
    }

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "sanctions.check.triggered",
      entityType: "BotRun",
      entityId: botRun.id,
      providerId,
      afterState: { source, botRunId: botRun.id },
    });
    return botRun;
  }

  async acknowledge(id: string) {
    const check = await this.db.sanctionsCheck.findUnique({ where: { id } });
    if (!check) throw new TRPCError({ code: "NOT_FOUND" });

    const updated = await this.db.sanctionsCheck.update({
      where: { id },
      data: {
        isAcknowledged: true,
        acknowledgedById: this.actor.id,
        acknowledgedAt: new Date(),
      },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "sanctions.acknowledged",
      entityType: "SanctionsCheck",
      entityId: id,
      providerId: check.providerId,
    });
    return updated;
  }
}
