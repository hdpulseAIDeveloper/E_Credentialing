/**
 * Test role registry — single source of truth for the 5 user roles the QA
 * pillars exercise. Per `docs/qa/STANDARD.md` §3 the headline block reports
 * "Roles exercised: X of N" against this list, so anything added here MUST
 * have a global-setup login flow and a per-role storageState file.
 *
 * Credentials match the seed in `prisma/seed.ts`.
 */

import path from "node:path";

export type StaffRoleId =
  | "admin"
  | "manager"
  | "specialist"
  | "committee_member";

export type RoleId = StaffRoleId | "provider";

export interface RoleDef {
  id: RoleId;
  /** UserRole enum value in Prisma */
  prismaRole:
    | "ADMIN"
    | "MANAGER"
    | "SPECIALIST"
    | "COMMITTEE_MEMBER"
    | "PROVIDER";
  /** Login email (Credentials provider) — null for token-only roles */
  email: string | null;
  /** Login password (Credentials provider) — null for token-only roles */
  password: string | null;
  /** Where the role lands after login. Smoke checks this URL is reachable. */
  homeRoute: string;
  /** Human label for reports */
  label: string;
}

export const ROLES: RoleDef[] = [
  {
    id: "admin",
    prismaRole: "ADMIN",
    email: "admin@hdpulseai.com",
    password: "Users1!@#$%^",
    homeRoute: "/dashboard",
    label: "System Administrator",
  },
  {
    id: "manager",
    prismaRole: "MANAGER",
    email: "lisa.rodriguez@essenmed.com",
    password: "Staff1!@#",
    homeRoute: "/dashboard",
    label: "Manager",
  },
  {
    id: "specialist",
    prismaRole: "SPECIALIST",
    email: "sarah.johnson@essenmed.com",
    password: "Staff1!@#",
    homeRoute: "/dashboard",
    label: "Credentialing Specialist",
  },
  {
    id: "committee_member",
    prismaRole: "COMMITTEE_MEMBER",
    email: "dr.patel@essenmed.com",
    password: "Staff1!@#",
    homeRoute: "/dashboard",
    label: "Committee Member",
  },
  {
    id: "provider",
    prismaRole: "PROVIDER",
    email: null,
    password: null,
    homeRoute: "/application",
    label: "Provider (token-auth)",
  },
];

export function getRole(id: RoleId): RoleDef {
  const r = ROLES.find((x) => x.id === id);
  if (!r) throw new Error(`Unknown role: ${id}`);
  return r;
}

export const STAFF_ROLES: StaffRoleId[] = [
  "admin",
  "manager",
  "specialist",
  "committee_member",
];

/** Where to write per-role storageState JSON files (created by globalSetup). */
export const STATE_DIR = path.join(__dirname, ".auth");
export function storageStateFor(role: RoleId): string {
  return path.join(STATE_DIR, `${role}.json`);
}
