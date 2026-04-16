/**
 * Provider router — CRUD, status transitions, invite/resend, list with filters.
 */

import { z } from "zod";
import { createTRPCRouter, staffProcedure, managerProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { writeAuditLog, auditProviderStatusChange } from "@/lib/audit";
import { encryptOptional } from "@/lib/encryption";
import type { Prisma } from "@prisma/client";
import {
  CoiStatus,
  OnsiteMeetingStatus,
  HospitalPrivilegeStatus,
  ProviderStatus as ProviderStatusEnum,
} from "@prisma/client";
import { SignJWT } from "jose";
import { addHours } from "date-fns";
import { canTransition } from "@/server/services/provider-status";

export const providerRouter = createTRPCRouter({
  // ─── List providers with filters ─────────────────────────────────────────
  list: staffProcedure
    .input(
      z.object({
        status: z.nativeEnum(ProviderStatusEnum).optional(),
        providerTypeId: z.string().optional(),
        assignedSpecialistId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(25),
      })
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ProviderWhereInput = {};

      if (input.status) where.status = input.status;
      if (input.providerTypeId) where.providerTypeId = input.providerTypeId;
      if (input.assignedSpecialistId) where.assignedSpecialistId = input.assignedSpecialistId;
      if (input.search) {
        where.OR = [
          { legalFirstName: { contains: input.search, mode: "insensitive" } },
          { legalLastName: { contains: input.search, mode: "insensitive" } },
          { npi: { contains: input.search } },
          { caqhId: { contains: input.search } },
        ];
      }

      const [total, providers] = await Promise.all([
        ctx.db.provider.count({ where }),
        ctx.db.provider.findMany({
          where,
          include: {
            providerType: true,
            assignedSpecialist: { select: { id: true, displayName: true, email: true } },
          },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          orderBy: { createdAt: "desc" },
        }),
      ]);

      return { providers, total, page: input.page, limit: input.limit };
    }),

  // ─── Get by ID ──────────────────────────────────────────────────────────
  getById: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.id },
        include: {
          providerType: true,
          assignedSpecialist: { select: { id: true, displayName: true, email: true } },
          profile: true,
          licenses: true,
          checklistItems: { include: { document: true } },
          tasks: {
            where: { status: { not: "COMPLETED" } },
            include: { assignedTo: { select: { id: true, displayName: true } } },
            orderBy: { createdAt: "desc" },
            take: 10,
          },
        },
      });

      if (!provider) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });
      }

      return provider;
    }),

  // ─── Create provider ────────────────────────────────────────────────────
  create: staffProcedure
    .input(
      z.object({
        legalFirstName: z.string().min(1),
        legalLastName: z.string().min(1),
        legalMiddleName: z.string().optional(),
        providerTypeId: z.string().uuid(),
        npi: z.string().length(10).optional(),
        assignedSpecialistId: z.string().uuid().optional(),
        personalEmail: z.string().email().optional(),
        mobilePhone: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.create({
        data: {
          legalFirstName: input.legalFirstName,
          legalLastName: input.legalLastName,
          legalMiddleName: input.legalMiddleName,
          providerTypeId: input.providerTypeId,
          npi: input.npi,
          assignedSpecialistId: input.assignedSpecialistId,
          status: "INVITED",
          createdById: ctx.session!.user.id,
          updatedById: ctx.session!.user.id,
          profile: input.personalEmail || input.mobilePhone ? {
            create: {
              personalEmail: input.personalEmail,
              mobilePhone: input.mobilePhone,
            },
          } : undefined,
        },
        include: { providerType: true },
      });

      // Initialize checklist items based on provider type document requirements
      const requirements = await ctx.db.documentRequirement.findMany({
        where: { providerTypeId: input.providerTypeId },
      });

      if (requirements.length > 0) {
        await ctx.db.checklistItem.createMany({
          data: requirements.map((req) => ({
            providerId: provider.id,
            documentType: req.documentType,
            status: "PENDING" as const,
          })),
        });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.created",
        entityType: "Provider",
        entityId: provider.id,
        providerId: provider.id,
        afterState: { status: "INVITED", name: `${input.legalFirstName} ${input.legalLastName}` },
      });

      return provider;
    }),

  // ─── Update provider ────────────────────────────────────────────────────
  update: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        legalFirstName: z.string().optional(),
        legalLastName: z.string().optional(),
        legalMiddleName: z.string().optional(),
        npi: z.string().optional(),
        deaNumber: z.string().optional(),
        caqhId: z.string().optional(),
        icimsId: z.string().optional(),
        medicarePtan: z.string().optional(),
        medicaidId: z.string().optional(),
        assignedSpecialistId: z.string().uuid().nullable().optional(),
        notes: z.string().optional(),
        // Encrypted PHI fields
        ssn: z.string().optional(),
        dateOfBirth: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ssn, dateOfBirth, ...rest } = input;

      const before = await ctx.db.provider.findUnique({ where: { id } });
      if (!before) throw new TRPCError({ code: "NOT_FOUND" });

      const updated = await ctx.db.provider.update({
        where: { id },
        data: {
          ...rest,
          ssn: ssn ? encryptOptional(ssn) : undefined,
          dateOfBirth: dateOfBirth ? encryptOptional(dateOfBirth) : undefined,
          updatedById: ctx.session!.user.id,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.updated",
        entityType: "Provider",
        entityId: id,
        providerId: id,
        beforeState: { legalFirstName: before.legalFirstName, legalLastName: before.legalLastName },
        afterState: { legalFirstName: updated.legalFirstName, legalLastName: updated.legalLastName },
      });

      return updated;
    }),

  // ─── Transition status ────────────────────────────────────────────────
  transitionStatus: staffProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        newStatus: z.nativeEnum(ProviderStatusEnum),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.id } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      if (!canTransition(provider.status, input.newStatus)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot transition from ${provider.status} to ${input.newStatus}`,
        });
      }

      const updateData: Prisma.ProviderUncheckedUpdateInput = {
        status: input.newStatus,
        updatedById: ctx.session!.user.id,
      };

      if (input.newStatus === "COMMITTEE_READY") {
        updateData.committeeReadyAt = new Date();
      }
      if (input.newStatus === "APPROVED") {
        updateData.approvedAt = new Date();
        updateData.approvedBy = ctx.session!.user.id;
      }
      if (input.reason && (input.newStatus === "DENIED" || input.newStatus === "DEFERRED")) {
        updateData.denialReason = input.reason;
      }

      const updated = await ctx.db.provider.update({
        where: { id: input.id },
        data: updateData,
      });

      await auditProviderStatusChange({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        providerId: input.id,
        fromStatus: provider.status,
        toStatus: input.newStatus,
        reason: input.reason,
      });

      return updated;
    }),

  // ─── Send invite ─────────────────────────────────────────────────────
  sendInvite: staffProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({
        where: { id: input.id },
        include: { profile: true },
      });

      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });

      // Generate magic link JWT token (72 hour expiry)
      const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
      const token = await new SignJWT({
        providerId: provider.id,
        email: provider.profile?.personalEmail ?? "",
        type: "magic-link",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setExpirationTime("72h")
        .sign(secret);

      const expiresAt = addHours(new Date(), 72);
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/application?token=${token}`;

      await ctx.db.provider.update({
        where: { id: input.id },
        data: {
          inviteToken: token,
          inviteTokenExpiresAt: expiresAt,
          inviteSentAt: new Date(),
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.invite.sent",
        entityType: "Provider",
        entityId: input.id,
        providerId: input.id,
        afterState: { inviteSentAt: new Date(), expiresAt },
      });

      return { inviteUrl, expiresAt };
    }),

  // ─── Get audit trail ────────────────────────────────────────────────
  getAuditTrail: staffProcedure
    .input(
      z.object({
        providerId: z.string().uuid(),
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(50),
      })
    )
    .query(async ({ ctx, input }) => {
      const [total, logs] = await Promise.all([
        ctx.db.auditLog.count({ where: { providerId: input.providerId } }),
        ctx.db.auditLog.findMany({
          where: { providerId: input.providerId },
          include: { actor: { select: { id: true, displayName: true, role: true } } },
          orderBy: { timestamp: "desc" },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
      ]);

      return { logs, total };
    }),

  // ─── Soft-delete provider (set INACTIVE) ─────────────────────────────
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.id } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND", message: "Provider not found" });

      await ctx.db.provider.update({
        where: { id: input.id },
        data: { status: "INACTIVE" },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.deactivated",
        entityType: "Provider",
        entityId: input.id,
        providerId: input.id,
        beforeState: { status: provider.status },
        afterState: { status: "INACTIVE" },
      });

      return { success: true };
    }),

  // ─── COI tracking ─────────────────────────────────────────────────────
  updateCoi: staffProcedure
    .input(
      z.object({
        providerId: z.string(),
        coiStatus: z.nativeEnum(CoiStatus).optional(),
        coiBrokerName: z.string().optional(),
        coiRequestedDate: z.string().optional(),
        coiObtainedDate: z.string().optional(),
        coiExpirationDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Prisma.ProviderUpdateInput = {};
      if (input.coiStatus !== undefined) data.coiStatus = input.coiStatus;
      if (input.coiBrokerName !== undefined) data.coiBrokerName = input.coiBrokerName;
      if (input.coiRequestedDate) data.coiRequestedDate = new Date(input.coiRequestedDate);
      if (input.coiObtainedDate) data.coiObtainedDate = new Date(input.coiObtainedDate);
      if (input.coiExpirationDate) data.coiExpirationDate = new Date(input.coiExpirationDate);

      const updated = await ctx.db.provider.update({
        where: { id: input.providerId },
        data,
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.coi.updated",
        entityType: "Provider",
        entityId: input.providerId,
        providerId: input.providerId,
        afterState: {
          coiStatus: input.coiStatus ?? null,
          coiBrokerName: input.coiBrokerName ?? null,
          coiRequestedDate: input.coiRequestedDate ?? null,
          coiObtainedDate: input.coiObtainedDate ?? null,
          coiExpirationDate: input.coiExpirationDate ?? null,
        },
      });

      return updated;
    }),

  // ─── Onsite meeting tracking ──────────────────────────────────────────
  updateOnsiteMeeting: staffProcedure
    .input(
      z.object({
        providerId: z.string(),
        onsiteMeetingStatus: z.nativeEnum(OnsiteMeetingStatus).optional(),
        onsiteMeetingDate: z.string().optional(),
        onsiteMeetingNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Prisma.ProviderUpdateInput = {};
      if (input.onsiteMeetingStatus !== undefined) data.onsiteMeetingStatus = input.onsiteMeetingStatus;
      if (input.onsiteMeetingDate) data.onsiteMeetingDate = new Date(input.onsiteMeetingDate);
      if (input.onsiteMeetingNotes !== undefined) data.onsiteMeetingNotes = input.onsiteMeetingNotes;

      return ctx.db.provider.update({
        where: { id: input.providerId },
        data,
      });
    }),

  // ─── iCIMS import ─────────────────────────────────────────────────────
  importFromIcims: staffProcedure
    .input(z.object({ icimsId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const { fetchProviderFromIcims } = await import("@/lib/integrations/icims");
      const icimsData = await fetchProviderFromIcims(input.icimsId);

      const existing = await ctx.db.provider.findFirst({ where: { icimsId: input.icimsId } });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Provider with this iCIMS ID already exists" });

      const defaultType = await ctx.db.providerType.findFirst({ where: { abbreviation: "MD" } });

      const provider = await ctx.db.provider.create({
        data: {
          legalFirstName: icimsData.firstName,
          legalLastName: icimsData.lastName,
          legalMiddleName: icimsData.middleName ?? null,
          icimsId: input.icimsId,
          npi: icimsData.npi ?? null,
          status: "INVITED",
          providerTypeId: defaultType!.id,
          createdById: ctx.session!.user.id,
        },
      });

      if (icimsData.facility || icimsData.specialty) {
        await ctx.db.providerProfile.create({
          data: {
            providerId: provider.id,
            facilityAssignment: icimsData.facility ?? null,
            specialtyPrimary: icimsData.specialty ?? null,
            department: icimsData.department ?? null,
            jobTitle: icimsData.jobTitle ?? null,
            personalEmail: icimsData.email ?? null,
            mobilePhone: icimsData.phone ?? null,
            hireDate: icimsData.hireDate ? new Date(icimsData.hireDate) : null,
            icimsDataSnapshot: icimsData as unknown as Prisma.InputJsonValue,
          },
        });
      }

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.imported.icims",
        entityType: "Provider",
        entityId: provider.id,
        providerId: provider.id,
        afterState: { icimsId: input.icimsId },
      });

      return provider;
    }),

  // ─── CAQH data sync ───────────────────────────────────────────────────
  pullCaqhData: staffProcedure
    .input(z.object({ providerId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const provider = await ctx.db.provider.findUnique({ where: { id: input.providerId } });
      if (!provider) throw new TRPCError({ code: "NOT_FOUND" });
      if (!provider.caqhId) throw new TRPCError({ code: "BAD_REQUEST", message: "Provider has no CAQH ID" });

      const { pullProviderData } = await import("@/lib/integrations/caqh");
      const caqhData = await pullProviderData(provider.caqhId);

      await ctx.db.providerProfile.upsert({
        where: { providerId: input.providerId },
        update: { caqhDataSnapshot: caqhData as unknown as Prisma.InputJsonValue },
        create: {
          providerId: input.providerId,
          caqhDataSnapshot: caqhData as unknown as Prisma.InputJsonValue,
        },
      });

      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "provider.caqh.synced",
        entityType: "Provider",
        entityId: input.providerId,
        providerId: input.providerId,
      });

      return { success: true };
    }),

  // ─── Hospital privilege status update ──────────────────────────────────
  updateHospitalPrivilege: staffProcedure
    .input(
      z.object({
        id: z.string(),
        status: z.nativeEnum(HospitalPrivilegeStatus).optional(),
        notes: z.string().optional(),
        approvedDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const data: Prisma.HospitalPrivilegeUpdateInput = {};
      if (input.status) data.status = input.status;
      if (input.notes !== undefined) data.notes = input.notes;
      if (input.approvedDate) data.approvedDate = new Date(input.approvedDate);

      return ctx.db.hospitalPrivilege.update({
        where: { id: input.id },
        data,
      });
    }),
});
