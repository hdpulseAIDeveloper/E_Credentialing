/**
 * src/server/services/recredentialing.ts
 *
 * Recredentialing cycle service. Owns:
 *   - cycle-number assignment (max+1 per provider)
 *   - status transition side-effects (startedAt / completedAt)
 *   - bulk-initiate logic (NCQA CR-1: 36-month cycle)
 *   - DELETE preconditions (only PENDING cycles deletable)
 *
 * Wave 2.1: extracted from `src/server/api/routers/recredentialing.ts`.
 *
 * NOTE: There is a separate `recredentialing-cycle.ts` helper alongside this
 * file that provides pure date-math utilities for status derivation. This
 * service intentionally does NOT depend on it; the helper is consumed
 * directly by the workers and the dashboard SQL view. Keeping the two
 * decoupled means a future overhaul of the date math doesn't ripple through
 * mutations.
 */
import type { PrismaClient, RecredentialingStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { ServiceActor, AuditWriter } from "./document";

export interface RecredentialingServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
}

export interface ListCyclesInput {
  providerId?: string;
  status?: string;
  dueDateBefore?: string;
  dueDateAfter?: string;
  page?: number;
  limit?: number;
}

export interface CreateCycleInput {
  providerId: string;
  dueDate: string;
  cycleLengthMonths?: number;
  notes?: string;
}

export type CycleStatus =
  | "PENDING"
  | "APPLICATION_SENT"
  | "IN_PROGRESS"
  | "PSV_RUNNING"
  | "COMMITTEE_READY"
  | "COMPLETED"
  | "OVERDUE";

export interface UpdateCycleStatusInput {
  id: string;
  status: CycleStatus;
  notes?: string;
}

const ACTIVE_STATUSES: RecredentialingStatus[] = [
  "PENDING",
  "IN_PROGRESS",
  "APPLICATION_SENT",
  "PSV_RUNNING",
  "COMMITTEE_READY",
];

export class RecredentialingService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;

  constructor(deps: RecredentialingServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
  }

  async list(input: ListCyclesInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (input.providerId) where.providerId = input.providerId;
    if (input.status) where.status = input.status as RecredentialingStatus;
    if (input.dueDateBefore || input.dueDateAfter) {
      const dueDate: Record<string, Date> = {};
      if (input.dueDateBefore) dueDate.lte = new Date(input.dueDateBefore);
      if (input.dueDateAfter) dueDate.gte = new Date(input.dueDateAfter);
      where.dueDate = dueDate;
    }
    const [total, cycles] = await Promise.all([
      this.db.recredentialingCycle.count({ where }),
      this.db.recredentialingCycle.findMany({
        where,
        include: {
          provider: {
            select: {
              id: true,
              legalFirstName: true,
              legalLastName: true,
              providerType: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueDate: "asc" },
      }),
    ]);
    return { cycles, total };
  }

  async getById(id: string) {
    const cycle = await this.db.recredentialingCycle.findUnique({
      where: { id },
      include: {
        provider: { include: { providerType: true } },
        committeeSession: true,
      },
    });
    if (!cycle) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recredentialing cycle not found" });
    }
    return cycle;
  }

  async getByProvider(providerId: string) {
    return this.db.recredentialingCycle.findMany({
      where: { providerId },
      include: { committeeSession: true },
      orderBy: { cycleNumber: "desc" },
    });
  }

  /**
   * Compute the next cycle number for a provider. Exposed (not just a private
   * helper) because the bulk-initiate flow needs to call it for every
   * eligible provider.
   */
  async nextCycleNumber(providerId: string): Promise<number> {
    const max = await this.db.recredentialingCycle.aggregate({
      where: { providerId },
      _max: { cycleNumber: true },
    });
    return (max._max.cycleNumber ?? 0) + 1;
  }

  async create(input: CreateCycleInput) {
    const provider = await this.db.provider.findUnique({ where: { id: input.providerId } });
    if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

    const cycleNumber = await this.nextCycleNumber(input.providerId);
    const cycle = await this.db.recredentialingCycle.create({
      data: {
        providerId: input.providerId,
        dueDate: new Date(input.dueDate),
        cycleLengthMonths: input.cycleLengthMonths ?? 36,
        cycleNumber,
        notes: input.notes,
        status: "PENDING",
      },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "recredentialing.created",
      entityType: "RecredentialingCycle",
      entityId: cycle.id,
      providerId: input.providerId,
      afterState: {
        cycleNumber,
        dueDate: input.dueDate,
        cycleLengthMonths: input.cycleLengthMonths ?? 36,
      },
    });
    return cycle;
  }

  /**
   * Status transition with side-effects:
   *   - IN_PROGRESS sets startedAt the first time
   *   - COMPLETED sets completedAt every time it transitions in
   *   - notes is updated only if explicitly provided
   */
  async updateStatus(input: UpdateCycleStatusInput) {
    const before = await this.db.recredentialingCycle.findUnique({ where: { id: input.id } });
    if (!before) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recredentialing cycle not found" });
    }

    const data: Record<string, unknown> = { status: input.status };
    if (input.notes !== undefined) data.notes = input.notes;
    if (input.status === "IN_PROGRESS" && !before.startedAt) data.startedAt = new Date();
    if (input.status === "COMPLETED") data.completedAt = new Date();

    const updated = await this.db.recredentialingCycle.update({
      where: { id: input.id },
      data,
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "recredentialing.status.changed",
      entityType: "RecredentialingCycle",
      entityId: input.id,
      providerId: before.providerId,
      beforeState: { status: before.status },
      afterState: { status: input.status },
    });
    return updated;
  }

  async getDashboard() {
    const now = new Date();
    const in30 = new Date(); in30.setDate(now.getDate() + 30);
    const in60 = new Date(); in60.setDate(now.getDate() + 60);
    const in90 = new Date(); in90.setDate(now.getDate() + 90);

    const [overdue, dueSoon30, dueSoon60, dueSoon90, inProgress, completed] = await Promise.all([
      this.db.recredentialingCycle.count({
        where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
      }),
      this.db.recredentialingCycle.count({
        where: { dueDate: { gte: now, lte: in30 }, status: "PENDING" },
      }),
      this.db.recredentialingCycle.count({
        where: { dueDate: { gte: in30, lte: in60 }, status: "PENDING" },
      }),
      this.db.recredentialingCycle.count({
        where: { dueDate: { gte: in60, lte: in90 }, status: "PENDING" },
      }),
      this.db.recredentialingCycle.count({ where: { status: "IN_PROGRESS" } }),
      this.db.recredentialingCycle.count({ where: { status: "COMPLETED" } }),
    ]);
    return { overdue, dueSoon30, dueSoon60, dueSoon90, inProgress, completed };
  }

  /**
   * Bulk-initiate cycles for every approved provider whose last initial
   * approval was 33+ months ago and who has no active cycle. NCQA CR-1
   * requires recredentialing every 36 months, so we trigger the cycle 3
   * months before the deadline to give staff a working window.
   *
   * Returns count of cycles created. Idempotent — calling twice in a row
   * creates zero on the second call because the just-created cycles
   * become "active".
   */
  async initiateBulk(): Promise<{ created: number }> {
    const now = new Date();
    const thresholdDate = new Date();
    thresholdDate.setMonth(thresholdDate.getMonth() - 33);

    const eligibleProviders = await this.db.provider.findMany({
      where: {
        status: "APPROVED",
        initialApprovalDate: { lte: thresholdDate },
      },
      select: { id: true, initialApprovalDate: true },
    });

    let createdCount = 0;
    for (const provider of eligibleProviders) {
      const existingActive = await this.db.recredentialingCycle.findFirst({
        where: { providerId: provider.id, status: { in: ACTIVE_STATUSES } },
      });
      if (existingActive) continue;

      const dueDate = new Date(provider.initialApprovalDate!);
      dueDate.setMonth(dueDate.getMonth() + 36);
      const effectiveDueDate =
        dueDate > now
          ? dueDate
          : (() => {
              const d = new Date(now);
              d.setMonth(d.getMonth() + 3);
              return d;
            })();

      const cycleNumber = await this.nextCycleNumber(provider.id);
      const cycle = await this.db.recredentialingCycle.create({
        data: {
          providerId: provider.id,
          dueDate: effectiveDueDate,
          cycleLengthMonths: 36,
          cycleNumber,
          status: "PENDING",
        },
      });
      await this.audit({
        actorId: this.actor.id,
        actorRole: this.actor.role,
        action: "recredentialing.created",
        entityType: "RecredentialingCycle",
        entityId: cycle.id,
        providerId: provider.id,
        afterState: {
          cycleNumber,
          dueDate: effectiveDueDate.toISOString(),
          bulk: true,
        },
      });
      createdCount += 1;
    }
    return { created: createdCount };
  }

  /**
   * Delete a cycle. Strict precondition: only PENDING cycles can be deleted.
   * Anything past PENDING is part of the audit trail and must be retained
   * (NCQA CR-1 evidence). Attempting to delete a non-PENDING cycle is a
   * 412 PRECONDITION_FAILED, never silently no-op'd.
   */
  async delete(id: string): Promise<{ success: true }> {
    const cycle = await this.db.recredentialingCycle.findUnique({
      where: { id },
      select: { id: true, providerId: true, status: true, cycleNumber: true },
    });
    if (!cycle) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Recredentialing cycle not found" });
    }
    if (cycle.status !== "PENDING") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Only PENDING cycles can be deleted",
      });
    }
    await this.db.recredentialingCycle.delete({ where: { id } });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "recredentialing.deleted",
      entityType: "RecredentialingCycle",
      entityId: id,
      providerId: cycle.providerId,
      beforeState: { status: cycle.status, cycleNumber: cycle.cycleNumber },
    });
    return { success: true };
  }
}
