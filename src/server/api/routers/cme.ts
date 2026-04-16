/**
 * CME router — CME credit tracking and CV auto-generation.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog } from "@/lib/audit";

export const cmeRouter = createTRPCRouter({
  // ─── List CME credits by provider ───────────────────────────────────
  listByProvider: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.cmeCredit.findMany({
        where: { providerId: input.providerId },
        include: {
          document: {
            select: { id: true, originalFilename: true, blobUrl: true },
          },
        },
        orderBy: { completedDate: "desc" },
      });
    }),

  // ─── Create CME credit ─────────────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        activityName: z.string().min(1),
        category: z.string().default("Category 1"),
        credits: z.number().positive(),
        completedDate: z.string(),
        documentId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const credit = await ctx.db.cmeCredit.create({
        data: {
          providerId: input.providerId,
          activityName: input.activityName,
          category: input.category,
          credits: input.credits,
          completedDate: new Date(input.completedDate),
          documentId: input.documentId,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "cme.created",
        entityType: "CmeCredit",
        entityId: credit.id,
        providerId: input.providerId,
        afterState: {
          activityName: input.activityName,
          category: input.category,
          credits: input.credits,
        },
      });

      return credit;
    }),

  // ─── Update CME credit ─────────────────────────────────────────────
  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        activityName: z.string().min(1).optional(),
        category: z.string().optional(),
        credits: z.number().positive().optional(),
        completedDate: z.string().optional(),
        documentId: z.string().uuid().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.cmeCredit.findUnique({ where: { id: input.id } });
      if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "CME credit not found" });

      const data: Record<string, unknown> = {};
      if (input.activityName !== undefined) data.activityName = input.activityName;
      if (input.category !== undefined) data.category = input.category;
      if (input.credits !== undefined) data.credits = input.credits;
      if (input.completedDate !== undefined) data.completedDate = new Date(input.completedDate);
      if (input.documentId !== undefined) data.documentId = input.documentId;

      const updated = await ctx.db.cmeCredit.update({
        where: { id: input.id },
        data,
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "cme.updated",
        entityType: "CmeCredit",
        entityId: input.id,
        providerId: updated.providerId,
      });

      return updated;
    }),

  // ─── Delete CME credit ─────────────────────────────────────────────
  delete: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const credit = await ctx.db.cmeCredit.findUnique({
        where: { id: input.id },
        select: { id: true, providerId: true, activityName: true, credits: true },
      });
      if (!credit) throw new TRPCError({ code: "NOT_FOUND", message: "CME credit not found" });

      await ctx.db.cmeCredit.delete({ where: { id: input.id } });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "cme.deleted",
        entityType: "CmeCredit",
        entityId: input.id,
        providerId: credit.providerId,
        beforeState: { activityName: credit.activityName, credits: credit.credits },
      });

      return { success: true };
    }),

  // ─── Get CME summary for a provider ────────────────────────────────
  getSummary: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const credits = await ctx.db.cmeCredit.findMany({
        where: { providerId: input.providerId },
        select: { credits: true, category: true, completedDate: true },
      });

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
        requirementMet: totalCredits >= 50,
      };
    }),

  // ─── Generate auto-formatted CV ────────────────────────────────────
  generateCv: staffProcedure
    .input(z.object({ providerId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.providerId },
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

      const workHistory = await ctx.db.workHistoryVerification.findMany({
        where: { providerId: input.providerId },
        orderBy: { startDate: "desc" },
      });

      const lines: string[] = [];
      const hr = "═".repeat(60);

      // Header
      const fullName = [provider.legalFirstName, provider.legalMiddleName, provider.legalLastName]
        .filter(Boolean)
        .join(" ");
      lines.push(hr);
      lines.push(`CURRICULUM VITAE`);
      lines.push(hr);
      lines.push("");

      // Contact Info
      lines.push("CONTACT INFORMATION");
      lines.push("─".repeat(40));
      lines.push(`Name: ${fullName}`);
      if (provider.npi) lines.push(`NPI: ${provider.npi}`);
      if (provider.providerType) lines.push(`Provider Type: ${provider.providerType.name} (${provider.providerType.abbreviation})`);
      if (provider.profile?.personalEmail) lines.push(`Email: ${provider.profile.personalEmail}`);
      if (provider.profile?.mobilePhone) lines.push(`Phone: ${provider.profile.mobilePhone}`);
      lines.push("");

      // Education
      lines.push("EDUCATION");
      lines.push("─".repeat(40));
      if (provider.profile?.medicalSchoolName) {
        const country = provider.profile.medicalSchoolCountry
          ? ` (${provider.profile.medicalSchoolCountry})`
          : "";
        const gradYear = provider.profile.graduationYear ?? "N/A";
        lines.push(`${provider.profile.medicalSchoolName}${country} — Graduated ${gradYear}`);
      }
      if (provider.profile?.specialtyPrimary) {
        lines.push(`Primary Specialty: ${provider.profile.specialtyPrimary}`);
      }
      if (provider.profile?.specialtySecondary) {
        lines.push(`Secondary Specialty: ${provider.profile.specialtySecondary}`);
      }
      if (provider.profile?.ecfmgNumber) {
        lines.push(`ECFMG #: ${provider.profile.ecfmgNumber}`);
      }
      lines.push("");

      // Licenses
      lines.push("LICENSES");
      lines.push("─".repeat(40));
      if (provider.licenses.length === 0) {
        lines.push("No licenses on file.");
      } else {
        for (const lic of provider.licenses) {
          const expStr = lic.expirationDate
            ? ` — Exp: ${lic.expirationDate.toLocaleDateString("en-US")}`
            : "";
          const primary = lic.isPrimary ? " [Primary]" : "";
          lines.push(`${lic.state} ${lic.licenseType} #${lic.licenseNumber} (${lic.status})${expStr}${primary}`);
        }
      }
      lines.push("");

      // Board Certifications
      lines.push("BOARD CERTIFICATIONS");
      lines.push("─".repeat(40));
      const boardVerifications = await ctx.db.verificationRecord.findMany({
        where: {
          providerId: input.providerId,
          credentialType: { in: ["BOARD_NCCPA", "BOARD_ABIM", "BOARD_ABFM", "BOARD_OTHER"] },
        },
        orderBy: { verifiedDate: "desc" },
      });
      if (boardVerifications.length === 0) {
        lines.push("No board certifications on file.");
      } else {
        for (const board of boardVerifications) {
          const expStr = board.expirationDate
            ? ` — Exp: ${board.expirationDate.toLocaleDateString("en-US")}`
            : "";
          lines.push(`${board.credentialType.replace("BOARD_", "")} — Verified ${board.verifiedDate.toLocaleDateString("en-US")}${expStr} (${board.status})`);
        }
      }
      lines.push("");

      // Hospital Privileges
      lines.push("HOSPITAL PRIVILEGES");
      lines.push("─".repeat(40));
      if (provider.hospitalPrivileges.length === 0) {
        lines.push("No hospital privileges on file.");
      } else {
        for (const hp of provider.hospitalPrivileges) {
          const dates: string[] = [];
          if (hp.effectiveDate) dates.push(`Effective: ${hp.effectiveDate.toLocaleDateString("en-US")}`);
          if (hp.expirationDate) dates.push(`Exp: ${hp.expirationDate.toLocaleDateString("en-US")}`);
          lines.push(`${hp.facilityName} — ${hp.privilegeType} (${hp.status})${dates.length ? " — " + dates.join(", ") : ""}`);
        }
      }
      lines.push("");

      // Work History
      lines.push("WORK HISTORY");
      lines.push("─".repeat(40));
      if (workHistory.length === 0) {
        lines.push("No work history on file.");
      } else {
        for (const wh of workHistory) {
          const startStr = wh.startDate ? wh.startDate.toLocaleDateString("en-US") : "N/A";
          const endStr = wh.endDate ? wh.endDate.toLocaleDateString("en-US") : "Present";
          const posStr = wh.position ? ` — ${wh.position}` : "";
          lines.push(`${wh.employerName}${posStr} (${startStr} – ${endStr})`);
        }
      }
      lines.push("");

      // CME Credits
      lines.push("CME CREDITS");
      lines.push("─".repeat(40));
      if (provider.cmeCredits.length === 0) {
        lines.push("No CME credits on file.");
      } else {
        let totalCme = 0;
        for (const cme of provider.cmeCredits) {
          totalCme += cme.credits;
          lines.push(
            `${cme.completedDate.toLocaleDateString("en-US")} — ${cme.activityName} (${cme.category}, ${cme.credits} credits)`
          );
        }
        lines.push(`\nTotal CME Credits: ${totalCme}`);
      }
      lines.push("");
      lines.push(hr);
      lines.push(`Generated: ${new Date().toLocaleDateString("en-US")}`);
      lines.push(hr);

      return lines.join("\n");
    }),
});
