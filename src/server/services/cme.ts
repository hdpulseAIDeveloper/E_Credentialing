/**
 * src/server/services/cme.ts
 *
 * CME credit + Curriculum Vitae service.
 *
 * Wave 3.2 (CVO platform): owns CRUD over `CmeCredit`, the per-provider
 * summary against the CME annual requirement, and the CV snapshot loader
 * that feeds the (pure) CV builder/renderers in `src/lib/cv/*`.
 *
 * The auto-CV is core CVO deliverable evidence:
 *   - NCQA CR-2 (work history)
 *   - NCQA CR-4 (education + board certifications + licensure)
 *   - JC OPPE indicator surface (CME totals are an OPPE input)
 *
 * Test surface: `tests/unit/server/services/cme-service.test.ts`.
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import type { AuditWriter, ServiceActor } from "./document";
import {
  buildCv,
  type Cv,
  type CvSnapshot,
} from "@/lib/cv/builder";
import { renderCvText } from "@/lib/cv/render-text";
import { renderCvMarkdown } from "@/lib/cv/render-markdown";
import { renderCvPdf } from "@/lib/cv/render-pdf";

/**
 * Default CME annual credit requirement. Per-state and per-specialty
 * overrides land in Wave 3.4 alongside the per-specialty OPPE cadence.
 */
export const CME_ANNUAL_REQUIREMENT_DEFAULT = 50;

export interface CmeServiceDeps {
  db: PrismaClient;
  audit: AuditWriter;
  actor: ServiceActor;
}

export interface CreateCmeInput {
  providerId: string;
  activityName: string;
  category?: string;
  credits: number;
  completedDate: string;
  documentId?: string;
}

export interface UpdateCmeInput {
  id: string;
  activityName?: string;
  category?: string;
  credits?: number;
  completedDate?: string;
  documentId?: string | null;
}

export interface CmeSummary {
  totalCredits: number;
  totalCategory1: number;
  totalCategory2: number;
  creditsByYear: Record<number, number>;
  requirementMet: boolean;
  /** The threshold the `requirementMet` flag was computed against. */
  requirement: number;
}

export class CmeService {
  private readonly db: PrismaClient;
  private readonly audit: AuditWriter;
  private readonly actor: ServiceActor;

  constructor(deps: CmeServiceDeps) {
    this.db = deps.db;
    this.audit = deps.audit;
    this.actor = deps.actor;
  }

  // ─── CRUD ───────────────────────────────────────────────────────────────

  async listByProvider(providerId: string) {
    return this.db.cmeCredit.findMany({
      where: { providerId },
      include: {
        document: {
          select: { id: true, originalFilename: true, blobUrl: true },
        },
      },
      orderBy: { completedDate: "desc" },
    });
  }

  async create(input: CreateCmeInput) {
    if (input.credits <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "credits must be greater than zero",
      });
    }
    const completedDate = new Date(input.completedDate);
    if (Number.isNaN(completedDate.getTime())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "completedDate is not a valid date",
      });
    }
    if (completedDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "completedDate cannot be in the future",
      });
    }

    const provider = await this.db.provider.findUnique({
      where: { id: input.providerId },
      select: { id: true },
    });
    if (!provider) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    }

    if (input.documentId) {
      const doc = await this.db.document.findUnique({
        where: { id: input.documentId },
        select: { id: true, providerId: true },
      });
      if (!doc) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Linked document not found",
        });
      }
      if (doc.providerId !== input.providerId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Document does not belong to that provider",
        });
      }
    }

    const credit = await this.db.cmeCredit.create({
      data: {
        providerId: input.providerId,
        activityName: input.activityName,
        category: input.category ?? "Category 1",
        credits: input.credits,
        completedDate,
        documentId: input.documentId,
      },
    });

    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "cme.created",
      entityType: "CmeCredit",
      entityId: credit.id,
      providerId: input.providerId,
      afterState: {
        activityName: input.activityName,
        category: input.category ?? "Category 1",
        credits: input.credits,
      },
    });
    return credit;
  }

  async update(input: UpdateCmeInput) {
    const existing = await this.db.cmeCredit.findUnique({
      where: { id: input.id },
    });
    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "CME credit not found" });
    }

    const data: Prisma.CmeCreditUpdateInput = {};
    if (input.activityName !== undefined) data.activityName = input.activityName;
    if (input.category !== undefined) data.category = input.category;
    if (input.credits !== undefined) {
      if (input.credits <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "credits must be greater than zero",
        });
      }
      data.credits = input.credits;
    }
    if (input.completedDate !== undefined) {
      const d = new Date(input.completedDate);
      if (Number.isNaN(d.getTime())) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "completedDate is not a valid date",
        });
      }
      data.completedDate = d;
    }
    if (input.documentId !== undefined) {
      data.document = input.documentId
        ? { connect: { id: input.documentId } }
        : { disconnect: true };
    }

    const updated = await this.db.cmeCredit.update({
      where: { id: input.id },
      data,
    });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "cme.updated",
      entityType: "CmeCredit",
      entityId: input.id,
      providerId: updated.providerId,
    });
    return updated;
  }

  async delete(id: string): Promise<{ success: true }> {
    const credit = await this.db.cmeCredit.findUnique({
      where: { id },
      select: {
        id: true,
        providerId: true,
        activityName: true,
        credits: true,
      },
    });
    if (!credit) {
      throw new TRPCError({ code: "NOT_FOUND", message: "CME credit not found" });
    }
    await this.db.cmeCredit.delete({ where: { id } });
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "cme.deleted",
      entityType: "CmeCredit",
      entityId: id,
      providerId: credit.providerId,
      beforeState: {
        activityName: credit.activityName,
        credits: credit.credits,
      },
    });
    return { success: true };
  }

  // ─── Summary ────────────────────────────────────────────────────────────

  async getSummary(
    providerId: string,
    options: { requirement?: number } = {},
  ): Promise<CmeSummary> {
    const credits = await this.db.cmeCredit.findMany({
      where: { providerId },
      select: { credits: true, category: true, completedDate: true },
    });
    return summarizeCredits(credits, options.requirement);
  }

  // ─── CV: snapshot + render ──────────────────────────────────────────────

  /**
   * Load every related row needed to render a CV. Single Prisma round-trip
   * for the provider + nested includes; one extra query for board
   * verifications and one for work history (which lives on a different
   * relation root).
   */
  async loadCvSnapshot(providerId: string): Promise<CvSnapshot> {
    const provider = await this.db.provider.findUnique({
      where: { id: providerId },
      include: {
        profile: true,
        licenses: { orderBy: { isPrimary: "desc" } },
        hospitalPrivileges: { orderBy: { effectiveDate: "desc" } },
        cmeCredits: { orderBy: { completedDate: "desc" } },
        providerType: { select: { name: true, abbreviation: true } },
      },
    });
    if (!provider) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
    }

    const [boardVerifications, workHistory] = await Promise.all([
      this.db.verificationRecord.findMany({
        where: {
          providerId,
          credentialType: {
            in: ["BOARD_NCCPA", "BOARD_ABIM", "BOARD_ABFM", "BOARD_OTHER"],
          },
        },
        orderBy: { verifiedDate: "desc" },
      }),
      this.db.workHistoryVerification.findMany({
        where: { providerId },
        orderBy: { startDate: "desc" },
      }),
    ]);

    return {
      provider: {
        legalFirstName: provider.legalFirstName,
        legalMiddleName: provider.legalMiddleName,
        legalLastName: provider.legalLastName,
        npi: provider.npi,
        providerType: provider.providerType
          ? {
              name: provider.providerType.name,
              abbreviation: provider.providerType.abbreviation,
            }
          : null,
        profile: provider.profile
          ? {
              personalEmail: provider.profile.personalEmail,
              mobilePhone: provider.profile.mobilePhone,
              medicalSchoolName: provider.profile.medicalSchoolName,
              medicalSchoolCountry: provider.profile.medicalSchoolCountry,
              graduationYear: provider.profile.graduationYear,
              specialtyPrimary: provider.profile.specialtyPrimary,
              specialtySecondary: provider.profile.specialtySecondary,
              ecfmgNumber: provider.profile.ecfmgNumber,
            }
          : null,
      },
      licenses: provider.licenses.map((l) => ({
        state: l.state,
        licenseType: l.licenseType,
        licenseNumber: l.licenseNumber,
        status: l.status,
        expirationDate: l.expirationDate,
        isPrimary: l.isPrimary,
      })),
      boardCertifications: boardVerifications.map((b) => ({
        credentialType: b.credentialType,
        status: b.status,
        verifiedDate: b.verifiedDate,
        expirationDate: b.expirationDate,
      })),
      privileges: provider.hospitalPrivileges.map((hp) => ({
        facilityName: hp.facilityName,
        privilegeType: hp.privilegeType,
        status: hp.status,
        effectiveDate: hp.effectiveDate,
        expirationDate: hp.expirationDate,
      })),
      workHistory: workHistory.map((wh) => ({
        employerName: wh.employerName,
        position: wh.position,
        startDate: wh.startDate,
        endDate: wh.endDate,
      })),
      cmeCredits: provider.cmeCredits.map((c) => ({
        activityName: c.activityName,
        category: c.category,
        credits: c.credits,
        completedDate: c.completedDate,
      })),
    };
  }

  /** Build the structured CV (no rendering). */
  async buildProviderCv(providerId: string): Promise<Cv> {
    const snapshot = await this.loadCvSnapshot(providerId);
    return buildCv(snapshot);
  }

  /** Render the CV as plain text (legacy contract). */
  async renderProviderCvText(providerId: string): Promise<string> {
    return renderCvText(await this.buildProviderCv(providerId));
  }

  /** Render the CV as Markdown. */
  async renderProviderCvMarkdown(providerId: string): Promise<string> {
    return renderCvMarkdown(await this.buildProviderCv(providerId));
  }

  /**
   * Render the CV as a PDF byte buffer. Writes an `cme.cv_generated`
   * audit row so reviewers can see exactly when and by whom a CV was
   * exported (CVO chain-of-custody requirement).
   */
  async renderProviderCvPdf(providerId: string): Promise<Uint8Array> {
    const cv = await this.buildProviderCv(providerId);
    const bytes = await renderCvPdf(cv);
    await this.audit({
      actorId: this.actor.id,
      actorRole: this.actor.role,
      action: "cme.cv_generated",
      entityType: "Provider",
      entityId: providerId,
      providerId,
      afterState: {
        format: "pdf",
        bytes: bytes.byteLength,
        sections: cv.sections.length,
      },
    });
    return bytes;
  }
}

// ─── Pure summarizer (exported for unit tests) ───────────────────────────────

export function summarizeCredits(
  credits: Array<{ credits: number; category: string; completedDate: Date }>,
  requirement: number = CME_ANNUAL_REQUIREMENT_DEFAULT,
): CmeSummary {
  let totalCredits = 0;
  let totalCategory1 = 0;
  let totalCategory2 = 0;
  const creditsByYear: Record<number, number> = {};
  for (const c of credits) {
    totalCredits += c.credits;
    if (c.category === "Category 1") {
      totalCategory1 += c.credits;
    } else {
      totalCategory2 += c.credits;
    }
    const year = c.completedDate.getFullYear();
    creditsByYear[year] = (creditsByYear[year] ?? 0) + c.credits;
  }
  return {
    totalCredits,
    totalCategory1,
    totalCategory2,
    creditsByYear,
    requirementMet: totalCredits >= requirement,
    requirement,
  };
}
