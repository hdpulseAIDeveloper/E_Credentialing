/**
 * P2 Gap #16 — Provider Directory admin router.
 *
 * Manages Organization, Location, Endpoint, and PractitionerRole rows that
 * back the FHIR R4 provider directory exposed at /api/fhir/* for
 * CMS-0057-F compliance.
 *
 * The router itself is staff-restricted (only credentialing managers and
 * admins should be able to mutate directory data), while the FHIR routes
 * are public-but-API-key-gated for downstream payer/EHR consumers.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  staffProcedure,
  managerProcedure,
} from "@/server/api/trpc";
import {
  DirectoryEndpointType,
  DirectoryOrganizationType,
} from "@prisma/client";
import { writeAuditLog } from "@/lib/audit";

const stateCode = z.string().length(2).transform((s) => s.toUpperCase());

// ─── Organizations ───────────────────────────────────────────────────────
const organizationInput = z.object({
  name: z.string().min(1).max(200),
  alias: z.string().optional().nullable(),
  type: z.nativeEnum(DirectoryOrganizationType).default("PROV"),
  npi: z.string().optional().nullable(),
  taxId: z.string().optional().nullable(),
  active: z.boolean().default(true),
  partOfId: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable(),
  website: z.string().url().optional().nullable(),
});

// ─── Locations ───────────────────────────────────────────────────────────
const locationInput = z.object({
  name: z.string().min(1).max(200),
  alias: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  status: z.enum(["active", "suspended", "inactive"]).default("active"),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: stateCode.optional().nullable(),
  postalCode: z.string().optional().nullable(),
  country: z.string().optional().default("US"),
  phone: z.string().optional().nullable(),
  fax: z.string().optional().nullable(),
  managingOrgId: z.string().optional().nullable(),
});

// ─── Endpoints ───────────────────────────────────────────────────────────
const endpointInput = z.object({
  name: z.string().min(1).max(200),
  status: z.enum(["active", "suspended", "error"]).default("active"),
  connectionType: z.nativeEnum(DirectoryEndpointType),
  payloadType: z.string().optional().nullable(),
  address: z.string().min(1),
  managingOrgId: z.string().optional().nullable(),
});

// ─── PractitionerRole ────────────────────────────────────────────────────
const roleInput = z.object({
  providerId: z.string(),
  organizationId: z.string(),
  locationId: z.string().optional().nullable(),
  active: z.boolean().default(true),
  specialty: z.string().optional().nullable(),
  startDate: z.string().datetime().optional().nullable(),
  endDate: z.string().datetime().optional().nullable(),
  acceptingNewPatients: z.boolean().optional().nullable(),
});

export const directoryRouter = createTRPCRouter({
  // ─── Organizations ──────────────────────────────────────────────────
  listOrganizations: staffProcedure.query(({ ctx }) =>
    ctx.db.directoryOrganization.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { locations: true, practitionerRoles: true, endpoints: true } } },
    })
  ),

  upsertOrganization: managerProcedure
    .input(organizationInput.extend({ id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const org = id
        ? await ctx.db.directoryOrganization.update({ where: { id }, data })
        : await ctx.db.directoryOrganization.create({ data });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: id ? "directory.organization.updated" : "directory.organization.created",
        entityType: "DirectoryOrganization",
        entityId: org.id,
      });
      return org;
    }),

  deleteOrganization: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.directoryOrganization.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "directory.organization.deleted",
        entityType: "DirectoryOrganization",
        entityId: input.id,
      });
      return { success: true };
    }),

  // ─── Locations ──────────────────────────────────────────────────────
  listLocations: staffProcedure.query(({ ctx }) =>
    ctx.db.directoryLocation.findMany({
      orderBy: { name: "asc" },
      include: { managingOrg: { select: { id: true, name: true } } },
    })
  ),

  upsertLocation: managerProcedure
    .input(locationInput.extend({ id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const loc = id
        ? await ctx.db.directoryLocation.update({ where: { id }, data })
        : await ctx.db.directoryLocation.create({ data });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: id ? "directory.location.updated" : "directory.location.created",
        entityType: "DirectoryLocation",
        entityId: loc.id,
      });
      return loc;
    }),

  deleteLocation: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.directoryLocation.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "directory.location.deleted",
        entityType: "DirectoryLocation",
        entityId: input.id,
      });
      return { success: true };
    }),

  // ─── Endpoints ──────────────────────────────────────────────────────
  listEndpoints: staffProcedure.query(({ ctx }) =>
    ctx.db.directoryEndpoint.findMany({
      orderBy: { name: "asc" },
      include: { managingOrg: { select: { id: true, name: true } } },
    })
  ),

  upsertEndpoint: managerProcedure
    .input(endpointInput.extend({ id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const ep = id
        ? await ctx.db.directoryEndpoint.update({ where: { id }, data })
        : await ctx.db.directoryEndpoint.create({ data });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: id ? "directory.endpoint.updated" : "directory.endpoint.created",
        entityType: "DirectoryEndpoint",
        entityId: ep.id,
      });
      return ep;
    }),

  deleteEndpoint: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.db.directoryEndpoint.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "directory.endpoint.deleted",
        entityType: "DirectoryEndpoint",
        entityId: input.id,
      });
      return { success: true };
    }),

  // ─── PractitionerRole ───────────────────────────────────────────────
  listRolesByProvider: staffProcedure
    .input(z.object({ providerId: z.string() }))
    .query(({ ctx, input }) =>
      ctx.db.directoryPractitionerRole.findMany({
        where: { providerId: input.providerId },
        include: {
          organization: { select: { id: true, name: true } },
          location: { select: { id: true, name: true } },
        },
        orderBy: { active: "desc" },
      })
    ),

  upsertRole: staffProcedure
    .input(roleInput.extend({ id: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, startDate, endDate, ...rest } = input;
      const data = {
        ...rest,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
      };
      const role = id
        ? await ctx.db.directoryPractitionerRole.update({ where: { id }, data })
        : await ctx.db.directoryPractitionerRole.create({ data });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: id ? "directory.role.updated" : "directory.role.created",
        entityType: "DirectoryPractitionerRole",
        entityId: role.id,
        providerId: input.providerId,
      });
      return role;
    }),

  deleteRole: staffProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const role = await ctx.db.directoryPractitionerRole.findUnique({
        where: { id: input.id },
      });
      if (!role) throw new TRPCError({ code: "NOT_FOUND" });
      await ctx.db.directoryPractitionerRole.delete({ where: { id: input.id } });
      await writeAuditLog({
        actorId: ctx.session!.user.id,
        actorRole: ctx.session!.user.role,
        action: "directory.role.deleted",
        entityType: "DirectoryPractitionerRole",
        entityId: input.id,
        providerId: role.providerId,
      });
      return { success: true };
    }),
});
