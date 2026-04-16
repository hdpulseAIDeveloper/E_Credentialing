/**
 * Production seed — pure ESM JavaScript (no tsx / ts-node required).
 *
 * Seeds only the "system config" rows that every production install needs:
 *   • provider types (MD, DO, PA, NP, LCSW, LMHC)
 *   • document requirements per provider type
 *   • one bootstrap admin user
 *
 * Zero demo data, zero PHI. Safe to run repeatedly (all writes are upserts).
 * Invoked inside the prod web container where @prisma/client and bcryptjs
 * already live in node_modules.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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

  console.log("→ Seeding admin user…");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@essenhealth.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "Users1!@#$%^";
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isActive: true, role: "ADMIN" },
    create: {
      email: adminEmail,
      firstName: "System",
      lastName: "Administrator",
      role: "ADMIN",
      isActive: true,
      passwordHash,
    },
  });
  console.log(`  ✓ ${admin.email}`);

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
