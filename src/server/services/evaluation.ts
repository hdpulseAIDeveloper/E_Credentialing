/**
 * src/server/services/evaluation.ts
 *
 * Practice-evaluation domain service (OPPE / FPPE). Owns the business rules
 * the Joint Commission Medical Staff standards require:
 *
 *   MS.08.01.01 — Focused Professional Practice Evaluation (FPPE) is required
 *                 for every newly granted clinical privilege so competence is
 *                 demonstrably evaluated within a defined post-grant window.
 *   MS.08.01.03 — Ongoing Professional Practice Evaluation (OPPE) is required
 *                 on a routine basis for every credentialed practitioner with
 *                 active privileges (industry convention is every 6 months).
 *
 * Wave 3.1 service-layer extraction. Replaces the inline logic that used to
 * live in `src/server/api/routers/evaluation.ts` (CRUD) plus
 * `src/lib/fppe.ts` (auto-FPPE) and the schedule body of
 * `src/workers/jobs/oppe-auto-schedule.ts` (auto-OPPE).
 *
 * Test surface: `tests/unit/server/services/evaluation-service.test.ts`.
 */

import type {
  EvaluationStatus,
  EvaluationType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { AuditWriter, ServiceActor } from "./document";

export interface EvaluationServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
}

/**
 * Joint Commission convention: 6-month OPPE cycle.
 */
export const OPPE_PERIOD_MONTHS = 6;

/**
 * Joint Commission convention: 90-day FPPE window after a privilege grant.
 */
export const FPPE_DEFAULT_PERIOD_DAYS = 90;

/**
 * How far ahead we pre-schedule the next OPPE so it never lapses. Default
 * is 30 days — meaning we'll create the next-cycle OPPE when the current
 * cycle has 30 or fewer days left.
 */
export const OPPE_LOOKAHEAD_DAYS = 30;

export interface ListEvaluationsInput {
  providerId?: string;
  evaluationType?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface CreateEvaluationInput {
  providerId: string;
  evaluationType: "OPPE" | "FPPE";
  privilegeId?: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  evaluatorId?: string;
}

export interface UpdateEvaluationInput {
  id: string;
  status?: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "OVERDUE";
  findings?: string;
  recommendation?: string;
  indicators?: Record<string, unknown>;
  documentBlobUrl?: string;
}

export interface AutoOppeSummary {
  providersConsidered: number;
  oppesCreated: number;
  errors: number;
}

export interface CreateAutoFppeOptions {
  /** Override default 90-day window. */
  periodDays?: number;
  /** Override the stored trigger label. */
  trigger?: string;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export class EvaluationService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;

  constructor(deps: EvaluationServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
  }

  // ─── List ────────────────────────────────────────────────────────────────

  async list(input: ListEvaluationsInput) {
    const page = input.page ?? 1;
    const limit = input.limit ?? 50;
    const where: Record<string, unknown> = {};
    if (input.providerId) where.providerId = input.providerId;
    if (input.evaluationType) where.evaluationType = input.evaluationType as EvaluationType;
    if (input.status) where.status = input.status as EvaluationStatus;

    const [total, evaluations] = await Promise.all([
      this.db.practiceEvaluation.count({ where }),
      this.db.practiceEvaluation.findMany({
        where,
        include: {
          provider: {
            select: { id: true, legalFirstName: true, legalLastName: true },
          },
          evaluator: {
            select: { id: true, displayName: true },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dueDate: "asc" },
      }),
    ]);
    return { evaluations, total };
  }

  async getById(id: string) {
    const evaluation = await this.db.practiceEvaluation.findUnique({
      where: { id },
      include: {
        provider: {
          select: {
            id: true,
            legalFirstName: true,
            legalLastName: true,
            providerType: true,
          },
        },
        evaluator: {
          select: { id: true, displayName: true, email: true },
        },
        hospitalPrivilege: true,
      },
    });
    if (!evaluation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });
    }
    return evaluation;
  }

  async listByProvider(providerId: string) {
    return this.db.practiceEvaluation.findMany({
      where: { providerId },
      include: {
        evaluator: { select: { id: true, displayName: true } },
        hospitalPrivilege: { select: { id: true, facilityName: true } },
      },
      orderBy: { dueDate: "asc" },
    });
  }

  // ─── Create ──────────────────────────────────────────────────────────────

  async create(input: CreateEvaluationInput) {
    const provider = await this.db.provider.findUnique({
      where: { id: input.providerId },
      select: { id: true },
    });
    if (!provider) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    }

    // Cross-tenant safety: a privilegeId must belong to the same provider.
    if (input.privilegeId) {
      const priv = await this.db.hospitalPrivilege.findUnique({
        where: { id: input.privilegeId },
        select: { id: true, providerId: true },
      });
      if (!priv) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Linked privilege not found",
        });
      }
      if (priv.providerId !== input.providerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Privilege does not belong to that provider",
        });
      }
    }

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);
    const dueDate = new Date(input.dueDate);

    if (Number.isNaN(periodStart.getTime()) || Number.isNaN(periodEnd.getTime())) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid period dates" });
    }
    if (periodEnd <= periodStart) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "periodEnd must be after periodStart",
      });
    }

    const evaluation = await this.db.practiceEvaluation.create({
      data: {
        providerId: input.providerId,
        evaluationType: input.evaluationType,
        privilegeId: input.privilegeId,
        periodStart,
        periodEnd,
        dueDate,
        evaluatorId: input.evaluatorId,
      },
    });

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "evaluation.created",
      entityType: "PracticeEvaluation",
      entityId: evaluation.id,
      providerId: input.providerId,
      afterState: {
        evaluationType: input.evaluationType,
        dueDate: input.dueDate,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    });

    return evaluation;
  }

  // ─── Update ──────────────────────────────────────────────────────────────

  async update(input: UpdateEvaluationInput) {
    const before = await this.db.practiceEvaluation.findUnique({
      where: { id: input.id },
    });
    if (!before) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });
    }

    if (before.status === "COMPLETED" && input.status && input.status !== "COMPLETED") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Cannot reopen a COMPLETED evaluation; create a new evaluation instead",
      });
    }

    const data: Record<string, unknown> = {};
    if (input.status !== undefined) data.status = input.status;
    if (input.findings !== undefined) data.findings = input.findings;
    if (input.recommendation !== undefined) data.recommendation = input.recommendation;
    if (input.indicators !== undefined) {
      data.indicators = input.indicators as unknown as Prisma.InputJsonValue;
    }
    if (input.documentBlobUrl !== undefined) data.documentBlobUrl = input.documentBlobUrl;
    if (input.status === "COMPLETED" && before.status !== "COMPLETED") {
      data.completedAt = new Date();
    }

    const updated = await this.db.practiceEvaluation.update({
      where: { id: input.id },
      data,
    });

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "evaluation.updated",
      entityType: "PracticeEvaluation",
      entityId: input.id,
      providerId: before.providerId,
      beforeState: { status: before.status },
      afterState: { status: input.status ?? before.status },
    });

    return updated;
  }

  // ─── Delete ──────────────────────────────────────────────────────────────

  async delete(id: string): Promise<{ success: true }> {
    const evaluation = await this.db.practiceEvaluation.findUnique({
      where: { id },
      select: { id: true, providerId: true, status: true, evaluationType: true },
    });
    if (!evaluation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Evaluation not found" });
    }
    if (evaluation.status !== "SCHEDULED") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Only SCHEDULED evaluations can be deleted",
      });
    }
    await this.db.practiceEvaluation.delete({ where: { id } });

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "evaluation.deleted",
      entityType: "PracticeEvaluation",
      entityId: id,
      providerId: evaluation.providerId,
      beforeState: {
        status: evaluation.status,
        evaluationType: evaluation.evaluationType,
      },
    });

    return { success: true };
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────

  async getDashboard() {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const [totalScheduled, overdue, oppePending, fppePending, completedThisMonth] =
      await Promise.all([
        this.db.practiceEvaluation.count({ where: { status: "SCHEDULED" } }),
        this.db.practiceEvaluation.count({
          where: { dueDate: { lt: now }, status: { not: "COMPLETED" } },
        }),
        this.db.practiceEvaluation.count({
          where: {
            evaluationType: "OPPE",
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          },
        }),
        this.db.practiceEvaluation.count({
          where: {
            evaluationType: "FPPE",
            status: { in: ["SCHEDULED", "IN_PROGRESS"] },
          },
        }),
        this.db.practiceEvaluation.count({
          where: {
            status: "COMPLETED",
            completedAt: { gte: monthStart, lte: monthEnd },
          },
        }),
      ]);

    return { totalScheduled, overdue, oppePending, fppePending, completedThisMonth };
  }

  // ─── Joint Commission auto-FPPE on privilege grant ───────────────────────

  /**
   * Creates the auto-FPPE row for a newly granted hospital privilege per JC
   * MS.08.01.01. Idempotent: if an FPPE for this privilege already exists,
   * we return the existing id and do not create a duplicate or write a
   * second audit row. Returns `null` if the privilege does not exist.
   */
  async createAutoFppeForPrivilege(
    privilegeId: string,
    options: CreateAutoFppeOptions = {},
  ): Promise<string | null> {
    const privilege = await this.db.hospitalPrivilege.findUnique({
      where: { id: privilegeId },
      select: {
        id: true,
        providerId: true,
        facilityName: true,
        privilegeType: true,
        effectiveDate: true,
        approvedDate: true,
        status: true,
      },
    });
    if (!privilege) return null;

    const existing = await this.db.practiceEvaluation.findFirst({
      where: {
        providerId: privilege.providerId,
        privilegeId,
        evaluationType: "FPPE",
      },
      select: { id: true },
    });
    if (existing) return existing.id;

    const grantDate =
      privilege.effectiveDate ?? privilege.approvedDate ?? new Date();
    const periodDays = options.periodDays ?? FPPE_DEFAULT_PERIOD_DAYS;
    const periodEnd = addDays(grantDate, periodDays);

    const trigger =
      options.trigger ??
      `Auto-FPPE for newly granted privilege "${privilege.privilegeType}" at ${privilege.facilityName}`;

    const created = await this.db.practiceEvaluation.create({
      data: {
        providerId: privilege.providerId,
        evaluationType: "FPPE",
        privilegeId,
        periodStart: grantDate,
        periodEnd,
        dueDate: periodEnd,
        trigger,
        triggerRefId: privilegeId,
      },
      select: { id: true, providerId: true },
    });

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "evaluation.auto_fppe_created",
      entityType: "PracticeEvaluation",
      entityId: created.id,
      providerId: created.providerId,
      afterState: {
        evaluationType: "FPPE",
        privilegeId,
        periodDays,
        trigger,
      },
    });

    return created.id;
  }

  // ─── Joint Commission OPPE auto-scheduling sweep ─────────────────────────

  /**
   * Pure-function variant that takes a `now` so tests can pin time without
   * needing libfaketime. Iterates every APPROVED provider with at least one
   * APPROVED hospital privilege; for each one ensures there is always an
   * OPPE scheduled for the current cycle and pre-creates the next cycle
   * once the current cycle is within `OPPE_LOOKAHEAD_DAYS` of ending.
   *
   * Idempotent — re-running creates 0 rows when called twice in a row.
   */
  async runAutoOppeSchedule(now: Date = new Date()): Promise<AutoOppeSummary> {
    const summary: AutoOppeSummary = {
      providersConsidered: 0,
      oppesCreated: 0,
      errors: 0,
    };

    const providers = await this.db.provider.findMany({
      where: {
        status: "APPROVED",
        hospitalPrivileges: { some: { status: "APPROVED" } },
      },
      select: {
        id: true,
        practiceEvaluations: {
          where: { evaluationType: "OPPE" },
          orderBy: { periodEnd: "desc" },
          take: 5,
        },
      },
    });

    for (const provider of providers) {
      summary.providersConsidered += 1;
      try {
        const latest = provider.practiceEvaluations[0];

        if (!latest) {
          // No OPPE history at all: seed the initial cycle.
          const periodStart = new Date(now);
          const periodEnd = addMonths(periodStart, OPPE_PERIOD_MONTHS);
          const created = await this.db.practiceEvaluation.create({
            data: {
              providerId: provider.id,
              evaluationType: "OPPE",
              periodStart,
              periodEnd,
              dueDate: periodEnd,
              trigger: "Auto-scheduled OPPE — initial cycle",
            },
            select: { id: true },
          });
          summary.oppesCreated += 1;
          await this.audit({
            actorId: this.actor.id,
            actorRole: this.actor.role,
            action: "evaluation.auto_oppe_created",
            entityType: "PracticeEvaluation",
            entityId: created.id,
            providerId: provider.id,
            afterState: { kind: "initial", periodMonths: OPPE_PERIOD_MONTHS },
          });
          continue;
        }

        const daysUntilLatestEnds = Math.ceil(
          (latest.periodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        if (daysUntilLatestEnds <= OPPE_LOOKAHEAD_DAYS) {
          const nextStart = addDays(latest.periodEnd, 1);
          const nextEnd = addMonths(nextStart, OPPE_PERIOD_MONTHS);

          const exists = await this.db.practiceEvaluation.findFirst({
            where: {
              providerId: provider.id,
              evaluationType: "OPPE",
              periodStart: nextStart,
            },
            select: { id: true },
          });
          if (exists) continue;

          const created = await this.db.practiceEvaluation.create({
            data: {
              providerId: provider.id,
              evaluationType: "OPPE",
              periodStart: nextStart,
              periodEnd: nextEnd,
              dueDate: nextEnd,
              trigger: "Auto-scheduled OPPE — next routine cycle",
            },
            select: { id: true },
          });
          summary.oppesCreated += 1;
          await this.audit({
            actorId: this.actor.id,
            actorRole: this.actor.role,
            action: "evaluation.auto_oppe_created",
            entityType: "PracticeEvaluation",
            entityId: created.id,
            providerId: provider.id,
            afterState: { kind: "next-cycle", periodMonths: OPPE_PERIOD_MONTHS },
          });
        }
      } catch (error) {
        summary.errors += 1;
        // Don't rethrow — we want to keep iterating other providers; the
        // worker logs the error count and the caller can alert on errors > 0.
        console.error(
          `[EvaluationService.runAutoOppeSchedule] error for provider ${provider.id}:`,
          error,
        );
      }
    }

    return summary;
  }
}
