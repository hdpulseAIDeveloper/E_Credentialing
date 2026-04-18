/**
 * src/server/services/roster.ts
 *
 * Payer-roster service. Owns:
 *   - CSV generation from enrollments
 *   - Submission validation (NPI + effective-date checks)
 *   - State transitions: GENERATED -> VALIDATED|ERROR -> SUBMITTED -> ACKNOWLEDGED
 *   - Audit-log writes
 *
 * Wave 2.1 extraction from `src/server/api/routers/roster.ts`.
 *
 * The CSV builder is a pure helper exported for reuse by future scheduled-
 * roster jobs (e.g. the weekly Aetna/UHC/Cigna automated submission worker).
 */
import type { PrismaClient, Prisma, RosterStatus } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { ServiceActor, AuditWriter } from "./document";

export interface RosterServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
}

export interface CreateRosterInput {
  payerName: string;
  rosterFormat?: string;
  templateConfig?: Record<string, unknown>;
  submissionMethod?: string;
}

export interface UpdateRosterInput {
  id: string;
  payerName?: string;
  rosterFormat?: string;
  templateConfig?: Record<string, unknown>;
  submissionMethod?: string | null;
}

/**
 * Quote a value for CSV. Doubles embedded quotes and wraps the field — RFC
 * 4180 minimum. Exported for unit tests and for the standalone CSV worker.
 */
export function csvEscape(val: string): string {
  return `"${val.replace(/"/g, '""')}"`;
}

/** Build an RFC 4180 CSV from headers + rows of strings. */
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers.map(csvEscape).join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
}

export class RosterService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;

  constructor(deps: RosterServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
  }

  async listRosters() {
    const rosters = await this.db.payerRoster.findMany({
      include: { submissions: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { payerName: "asc" },
    });
    return rosters.map((r) => ({
      ...r,
      latestSubmission: r.submissions[0] ?? null,
      submissions: undefined,
    }));
  }

  async getRoster(id: string) {
    const roster = await this.db.payerRoster.findUnique({
      where: { id },
      include: { submissions: { orderBy: { createdAt: "desc" } } },
    });
    if (!roster) throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });
    return roster;
  }

  async createRoster(input: CreateRosterInput) {
    const roster = await this.db.payerRoster.create({
      data: {
        payerName: input.payerName,
        rosterFormat: input.rosterFormat ?? "csv",
        templateConfig: (input.templateConfig ?? {}) as unknown as Prisma.InputJsonValue,
        submissionMethod: input.submissionMethod,
      },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "roster.created",
      entityType: "PayerRoster",
      entityId: roster.id,
      afterState: {
        payerName: input.payerName,
        rosterFormat: input.rosterFormat ?? "csv",
        submissionMethod: input.submissionMethod ?? null,
      },
    });
    return roster;
  }

  async updateRoster(input: UpdateRosterInput) {
    const { id, templateConfig, ...rest } = input;
    const existing = await this.db.payerRoster.findUnique({ where: { id } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });

    return this.db.payerRoster.update({
      where: { id },
      data: {
        ...rest,
        ...(templateConfig !== undefined && {
          templateConfig: templateConfig as unknown as Prisma.InputJsonValue,
        }),
      },
    });
  }

  async deleteRoster(id: string) {
    const existing = await this.db.payerRoster.findUnique({
      where: { id },
      include: { submissions: { select: { id: true } } },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });

    await this.db.rosterSubmission.deleteMany({ where: { rosterId: id } });
    await this.db.payerRoster.delete({ where: { id } });

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "roster.deleted",
      entityType: "PayerRoster",
      entityId: id,
      beforeState: {
        payerName: existing.payerName,
        submissionCount: existing.submissions.length,
      },
    });
    return { success: true } as const;
  }

  /**
   * Generate a CSV submission for the given roster. Pulls every ENROLLED
   * enrollment whose payerName matches (case-insensitive), folds them into
   * the standard 6-column payer template, and returns the CSV plus a
   * RosterSubmission row in GENERATED state.
   */
  async generateSubmission(rosterId: string) {
    const roster = await this.db.payerRoster.findUnique({ where: { id: rosterId } });
    if (!roster) throw new TRPCError({ code: "NOT_FOUND", message: "Roster not found" });

    const enrollments = await this.db.enrollment.findMany({
      where: {
        payerName: { equals: roster.payerName, mode: "insensitive" },
        status: "ENROLLED",
      },
      include: {
        provider: {
          select: {
            legalFirstName: true,
            legalLastName: true,
            npi: true,
            dateOfBirth: true,
            profile: { select: { specialtyPrimary: true } },
          },
        },
      },
    });

    const headers = [
      "Provider Last Name",
      "Provider First Name",
      "NPI",
      "Date of Birth",
      "Specialty",
      "Effective Date",
    ];
    const rows = enrollments.map((e) => [
      e.provider.legalLastName,
      e.provider.legalFirstName,
      e.provider.npi ?? "",
      e.provider.dateOfBirth ?? "",
      e.provider.profile?.specialtyPrimary ?? "",
      e.effectiveDate ? e.effectiveDate.toISOString().split("T")[0] ?? "" : "",
    ]);
    const csv = toCsv(headers, rows);

    const submission = await this.db.rosterSubmission.create({
      data: {
        rosterId,
        status: "GENERATED" satisfies RosterStatus,
        providerCount: enrollments.length,
      },
    });
    await this.db.payerRoster.update({
      where: { id: rosterId },
      data: { lastGeneratedAt: new Date() },
    });
    return { csv, submissionId: submission.id, providerCount: enrollments.length };
  }

  /**
   * Validate every enrollment against payer-template requirements. Currently
   * checks for NPI and effective date — extend here when payer-specific rule
   * packs land (W3.4). Returns `{ valid, errors, status }` and persists the
   * resulting RosterStatus on the submission row.
   */
  async validateSubmission(submissionId: string) {
    const submission = await this.db.rosterSubmission.findUnique({
      where: { id: submissionId },
      include: { roster: true },
    });
    if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });

    const enrollments = await this.db.enrollment.findMany({
      where: {
        payerName: { equals: submission.roster.payerName, mode: "insensitive" },
        status: "ENROLLED",
      },
      include: {
        provider: {
          select: { id: true, legalFirstName: true, legalLastName: true, npi: true },
        },
      },
    });

    const errors: { providerId: string; providerName: string; issue: string }[] = [];
    for (const e of enrollments) {
      const name = `${e.provider.legalLastName}, ${e.provider.legalFirstName}`;
      if (!e.provider.npi) {
        errors.push({ providerId: e.provider.id, providerName: name, issue: "Missing NPI" });
      }
      if (!e.effectiveDate) {
        errors.push({
          providerId: e.provider.id,
          providerName: name,
          issue: "Missing effective date",
        });
      }
    }

    const newStatus: RosterStatus = errors.length > 0 ? "ERROR" : "VALIDATED";
    await this.db.rosterSubmission.update({
      where: { id: submissionId },
      data: {
        validationErrors: errors.length > 0 ? errors : undefined,
        status: newStatus,
      },
    });
    return { valid: errors.length === 0, errors, status: newStatus };
  }

  async submitRoster(submissionId: string, notes?: string) {
    const submission = await this.db.rosterSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });

    const updated = await this.db.rosterSubmission.update({
      where: { id: submissionId },
      data: {
        status: "SUBMITTED" satisfies RosterStatus,
        submittedAt: new Date(),
        submittedBy: this.actor.id,
        notes,
      },
    });
    await this.db.payerRoster.update({
      where: { id: submission.rosterId },
      data: { lastSubmittedAt: new Date() },
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "roster.submitted",
      entityType: "RosterSubmission",
      entityId: submissionId,
      afterState: {
        rosterId: submission.rosterId,
        providerCount: submission.providerCount,
        notes: notes ?? null,
      },
    });
    return updated;
  }

  async acknowledgeRoster(submissionId: string) {
    const submission = await this.db.rosterSubmission.findUnique({
      where: { id: submissionId },
    });
    if (!submission) throw new TRPCError({ code: "NOT_FOUND", message: "Submission not found" });

    return this.db.rosterSubmission.update({
      where: { id: submissionId },
      data: {
        status: "ACKNOWLEDGED" satisfies RosterStatus,
        acknowledgedAt: new Date(),
      },
    });
  }
}
