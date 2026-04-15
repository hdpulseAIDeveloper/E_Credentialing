import { PrismaClient, DocumentType, RequirementType, UserRole } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding provider types and document requirements...");

  // ─── Provider Types ────────────────────────────────────────────────────────

  const providerTypes = [
    {
      name: "Physician",
      abbreviation: "MD",
      requiresEcfmg: false,
      requiresDea: true,
      requiresBoards: true,
      boardType: "ABIM/ABFM/other",
      isActive: true,
    },
    {
      name: "Doctor of Osteopathic Medicine",
      abbreviation: "DO",
      requiresEcfmg: false,
      requiresDea: true,
      requiresBoards: true,
      boardType: "AOA/ABMS",
      isActive: true,
    },
    {
      name: "Physician Assistant",
      abbreviation: "PA",
      requiresEcfmg: false,
      requiresDea: false,
      requiresBoards: true,
      boardType: "NCCPA",
      isActive: true,
    },
    {
      name: "Nurse Practitioner",
      abbreviation: "NP",
      requiresEcfmg: false,
      requiresDea: false,
      requiresBoards: true,
      boardType: "ANCC/AANP",
      isActive: true,
    },
    {
      name: "Licensed Clinical Social Worker",
      abbreviation: "LCSW",
      requiresEcfmg: false,
      requiresDea: false,
      requiresBoards: false,
      boardType: null,
      isActive: true,
    },
    {
      name: "Licensed Mental Health Counselor",
      abbreviation: "LMHC",
      requiresEcfmg: false,
      requiresDea: false,
      requiresBoards: false,
      boardType: null,
      isActive: true,
    },
  ];

  const createdTypes: Record<string, string> = {};

  for (const pt of providerTypes) {
    const created = await prisma.providerType.upsert({
      where: { abbreviation: pt.abbreviation },
      update: pt,
      create: pt,
    });
    createdTypes[pt.abbreviation] = created.id;
    console.log(`  ✓ Provider type: ${pt.abbreviation} (${pt.name})`);
  }

  // ─── Document Requirements ─────────────────────────────────────────────────

  // Common requirements for all provider types
  const commonRequired: DocumentType[] = [
    DocumentType.PHOTO_ID,
    DocumentType.CV_RESUME,
    DocumentType.PROFESSIONAL_LIABILITY_INSURANCE,
    DocumentType.ORIGINAL_LICENSE,
    DocumentType.BLS_CARD,
    DocumentType.INFECTION_CONTROL_CERTIFICATE,
    DocumentType.CHILD_ABUSE_CERTIFICATE,
    DocumentType.PHYSICAL_EXAM_MMR,
    DocumentType.PHYSICAL_EXAM_PPD,
    DocumentType.FLU_SHOT,
  ];

  // MD-specific
  const mdRequirements: Array<{ documentType: DocumentType; requirement: RequirementType; conditionDescription?: string }> = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.DEA_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.MEDICAL_SCHOOL_DIPLOMA, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.RESIDENCY_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.BOARD_CERTIFICATION, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.ECFMG_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for international medical graduates" },
    { documentType: DocumentType.INTERNSHIP_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if internship completed separately from residency" },
    { documentType: DocumentType.FELLOWSHIP_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if fellowship training completed" },
    { documentType: DocumentType.HOSPITAL_APPOINTMENT_LETTER, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if hospital privileges requested" },
    { documentType: DocumentType.ACLS_CARD, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.PAIN_MANAGEMENT_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for prescribers" },
    { documentType: DocumentType.SSN_CARD, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if SSN not previously on file" },
  ];

  // DO requirements (same as MD)
  const doRequirements = mdRequirements.map((r) => ({ ...r }));

  // PA-specific
  const paRequirements: Array<{ documentType: DocumentType; requirement: RequirementType; conditionDescription?: string }> = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.MEDICAL_SCHOOL_DIPLOMA, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.BOARD_CERTIFICATION, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.GRADUATE_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.DEA_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if provider will prescribe controlled substances" },
    { documentType: DocumentType.FELLOWSHIP_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if fellowship completed" },
    { documentType: DocumentType.ACLS_CARD, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for procedural PAs" },
    { documentType: DocumentType.PAIN_MANAGEMENT_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for prescribers" },
  ];

  // NP-specific
  const npRequirements: Array<{ documentType: DocumentType; requirement: RequirementType; conditionDescription?: string }> = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.GRADUATE_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.BOARD_CERTIFICATION, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.DEA_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required if provider will prescribe controlled substances" },
    { documentType: DocumentType.ACLS_CARD, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for acute care NPs" },
    { documentType: DocumentType.PAIN_MANAGEMENT_CERTIFICATE, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for prescribers" },
  ];

  // LCSW-specific
  const lcswRequirements: Array<{ documentType: DocumentType; requirement: RequirementType; conditionDescription?: string }> = [
    ...commonRequired.map((d) => ({ documentType: d, requirement: RequirementType.REQUIRED })),
    { documentType: DocumentType.GRADUATE_CERTIFICATE, requirement: RequirementType.REQUIRED },
    { documentType: DocumentType.CME_CREDITS, requirement: RequirementType.CONDITIONAL, conditionDescription: "Required for license renewal documentation" },
  ];

  // LMHC-specific (same as LCSW)
  const lmhcRequirements = lcswRequirements.map((r) => ({ ...r }));

  const requirementsByType: Record<string, Array<{ documentType: DocumentType; requirement: RequirementType; conditionDescription?: string }>> = {
    MD: mdRequirements,
    DO: doRequirements,
    PA: paRequirements,
    NP: npRequirements,
    LCSW: lcswRequirements,
    LMHC: lmhcRequirements,
  };

  for (const [abbrev, requirements] of Object.entries(requirementsByType)) {
    const providerTypeId = createdTypes[abbrev];
    if (!providerTypeId) continue;

    for (const req of requirements) {
      await prisma.documentRequirement.upsert({
        where: {
          providerTypeId_documentType: {
            providerTypeId,
            documentType: req.documentType,
          },
        },
        update: {
          requirement: req.requirement,
          conditionDescription: req.conditionDescription ?? null,
        },
        create: {
          providerTypeId,
          documentType: req.documentType,
          requirement: req.requirement,
          conditionDescription: req.conditionDescription ?? null,
        },
      });
    }
    console.log(`  ✓ Document requirements for ${abbrev}: ${requirements.length} records`);
  }

  // ─── Admin User ────────────────────────────────────────────────────────────

  const adminUser = await prisma.user.upsert({
    where: { email: "admin@essenmed.com" },
    update: {},
    create: {
      email: "admin@essenmed.com",
      displayName: "System Administrator",
      role: UserRole.ADMIN,
      isActive: true,
    },
  });

  console.log(`  ✓ Admin user: ${adminUser.email}`);

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
