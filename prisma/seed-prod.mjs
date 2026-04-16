/**
 * Production seed — pure ESM JavaScript (no tsx / ts-node required).
 *
 * Seeds the rows every production install needs:
 *   • provider types (MD, DO, PA, NP, LCSW, LMHC)
 *   • document requirements per provider type
 *   • staff users (mirrored from the current dev database so the same
 *     credentials work in both environments)
 *
 * Zero demo provider data, zero PHI. Safe to run repeatedly (all writes are
 * upserts). Invoked inside the prod web container where @prisma/client is
 * available. Password hashes are pre-computed with bcryptjs so this script
 * does not depend on bcryptjs being resolvable from the standalone runner.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// bcrypt hash for "Users1!@#$%^" — regenerated fresh so prod admin matches the
// documented bootstrap password. To rotate:
//   node -e "console.log(require('bcryptjs').hashSync('Users1!@#$%^', 12))"
const ADMIN_PASSWORD_HASH_USERS1 =
  "$2b$12$60SckXCZlf4MNurN5jjTLeNyN00rqPlzSTXVUcBFU3LgvoRjUG7Jm";

// Staff roster mirrored from dev. Password hashes are copied verbatim from dev
// so the same passwords log in on both environments. The admin hash is
// overridden to the fresh Users1!@#$%^ hash above (per prod bootstrap policy).
const STAFF_USERS = [
  {
    email: "admin@hdpulseai.com",
    displayName: "System Administrator",
    role: "ADMIN",
    passwordHash: ADMIN_PASSWORD_HASH_USERS1,
  },
  {
    email: "hdave@essenmed.com",
    displayName: "Hiren Dave",
    role: "ADMIN",
    passwordHash: "$2b$12$hZorIh1ysiD.qQl1OpypkeZqXYzQwYxHyo2quwvmRJEb/0Kt03ZSi",
  },
  {
    email: "sarah.johnson@essenmed.com",
    displayName: "Sarah Johnson",
    role: "SPECIALIST",
    passwordHash: "$2b$12$mNITNjuSPWfJiDge68eywuyjWdMMsv1vv.2D0pqTUpA1prWRsRx.C",
  },
  {
    email: "michael.chen@essenmed.com",
    displayName: "Michael Chen",
    role: "SPECIALIST",
    passwordHash: "$2b$12$mNITNjuSPWfJiDge68eywuyjWdMMsv1vv.2D0pqTUpA1prWRsRx.C",
  },
  {
    email: "lisa.rodriguez@essenmed.com",
    displayName: "Lisa Rodriguez",
    role: "MANAGER",
    passwordHash: "$2b$12$mNITNjuSPWfJiDge68eywuyjWdMMsv1vv.2D0pqTUpA1prWRsRx.C",
  },
  {
    email: "dr.patel@essenmed.com",
    displayName: "Dr. Anita Patel",
    role: "COMMITTEE_MEMBER",
    passwordHash: "$2b$12$mNITNjuSPWfJiDge68eywuyjWdMMsv1vv.2D0pqTUpA1prWRsRx.C",
  },
  {
    email: "dr.williams@essenmed.com",
    displayName: "Dr. Charles Williams",
    role: "COMMITTEE_MEMBER",
    passwordHash: "$2b$12$mNITNjuSPWfJiDge68eywuyjWdMMsv1vv.2D0pqTUpA1prWRsRx.C",
  },
];

// Any stale bootstrap admins from earlier seed runs we want to clean up on upsert.
const LEGACY_ADMIN_EMAILS = ["admin@essenhealth.com"];

const PROVIDER_TYPES = [
  { abbreviation: "MD", name: "Doctor of Medicine" },
  { abbreviation: "DO", name: "Doctor of Osteopathic Medicine" },
  { abbreviation: "PA", name: "Physician Assistant" },
  { abbreviation: "NP", name: "Nurse Practitioner" },
  { abbreviation: "LCSW", name: "Licensed Clinical Social Worker" },
  { abbreviation: "LMHC", name: "Licensed Mental Health Counselor" },
];

// DocumentType values must exactly match the enum in prisma/schema.prisma.
const COMMON_REQUIRED = [
  "PHOTO_ID",
  "CV_RESUME",
  "PROFESSIONAL_LIABILITY_INSURANCE",
  "ORIGINAL_LICENSE",
  "LICENSE_REGISTRATION",
];

const REQUIREMENTS_BY_TYPE = {
  MD: [
    ...COMMON_REQUIRED,
    "DEA_CERTIFICATE",
    "BOARD_CERTIFICATION",
    "MEDICAL_SCHOOL_DIPLOMA",
    "RESIDENCY_CERTIFICATE",
  ],
  DO: [
    ...COMMON_REQUIRED,
    "DEA_CERTIFICATE",
    "BOARD_CERTIFICATION",
    "MEDICAL_SCHOOL_DIPLOMA",
    "RESIDENCY_CERTIFICATE",
  ],
  PA: [
    ...COMMON_REQUIRED,
    "DEA_CERTIFICATE",
    "BOARD_CERTIFICATION",
    "GRADUATE_CERTIFICATE",
  ],
  NP: [
    ...COMMON_REQUIRED,
    "DEA_CERTIFICATE",
    "BOARD_CERTIFICATION",
    "GRADUATE_CERTIFICATE",
  ],
  LCSW: [...COMMON_REQUIRED, "GRADUATE_CERTIFICATE"],
  LMHC: [...COMMON_REQUIRED, "GRADUATE_CERTIFICATE"],
};

async function safeUpsertDocumentRequirement(providerTypeId, documentType) {
  try {
    await prisma.documentRequirement.upsert({
      where: { providerTypeId_documentType: { providerTypeId, documentType } },
      update: {},
      create: { providerTypeId, documentType, requirement: "REQUIRED" },
    });
    return true;
  } catch (err) {
    // DocumentType enum may not include every placeholder above; skip unknowns.
    if (String(err).includes("Invalid") || String(err).includes("enum")) {
      console.warn(`    ⚠ skipped ${documentType}: not in DocumentType enum`);
      return false;
    }
    throw err;
  }
}

async function main() {
  console.log("→ Seeding provider types…");
  const typeIds = {};
  for (const pt of PROVIDER_TYPES) {
    const row = await prisma.providerType.upsert({
      where: { abbreviation: pt.abbreviation },
      update: { name: pt.name, isActive: true },
      create: { abbreviation: pt.abbreviation, name: pt.name, isActive: true },
    });
    typeIds[pt.abbreviation] = row.id;
    console.log(`  ✓ ${pt.abbreviation}`);
  }

  console.log("→ Seeding document requirements…");
  for (const [abbrev, docs] of Object.entries(REQUIREMENTS_BY_TYPE)) {
    const ptId = typeIds[abbrev];
    if (!ptId) continue;
    let applied = 0;
    for (const doc of docs) {
      if (await safeUpsertDocumentRequirement(ptId, doc)) applied++;
    }
    console.log(`  ✓ ${abbrev}: ${applied} requirements`);
  }

  console.log("→ Seeding staff users…");
  for (const u of STAFF_USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {
        displayName: u.displayName,
        role: u.role,
        passwordHash: u.passwordHash,
        isActive: true,
      },
      create: {
        email: u.email,
        displayName: u.displayName,
        role: u.role,
        passwordHash: u.passwordHash,
        isActive: true,
      },
    });
    console.log(`  ✓ ${u.email.padEnd(32)} ${u.role}`);
  }

  console.log("→ Deactivating legacy bootstrap accounts…");
  for (const email of LEGACY_ADMIN_EMAILS) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) {
      console.log(`  • ${email} (not present — skip)`);
      continue;
    }
    // Keep the row (foreign-key safety) but disable it so it can't sign in.
    await prisma.user.update({
      where: { email },
      data: { isActive: false, passwordHash: null },
    });
    console.log(`  ✓ ${email} deactivated`);
  }

  console.log("\n✓ Production seed complete.");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
